/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

import { Common } from "common/interfaces";
import {C} from "data/constants";

// ===========================================================================
// constants & utilities
// ===========================================================================

export enum LogLevel {
  OFF = Number.MAX_VALUE, // no logging
  ERROR = 1000,
  WARNING = 900,
  INFO = 800,
  DEBUG = 700,
  ALL = Number.MIN_VALUE, // log everything
}

type LogFnName = "dir" | "log" | "info" | "warn" | "error";

const MINIMUM_LOGGING_LEVEL = LogLevel.ERROR;

function dir(...args: any[]) {
  args.forEach((arg) => console.dir(arg));
}

// =============================================================================
// Log
// =============================================================================

interface IEnabledCondition {
  type: "C";
  C?: string;
}

interface IAllLogOptions<TAdditional = never> {
  enabled: boolean | TAdditional | Promise<boolean>;
  enabledCondition: IEnabledCondition | TAdditional;
  level: LogLevel | TAdditional;
  name: string | TAdditional;
  prefix: string | TAdditional;
}

interface ILogOptions {
  enabled?: IAllLogOptions<null>["enabled"];
  enabledCondition?: IAllLogOptions<null>["enabledCondition"];
  level?: IAllLogOptions<null>["level"] | "all";
  name?: IAllLogOptions<null>["name"];
  prefix?: IAllLogOptions<null>["prefix"];
}

interface IInternalLogOptions<TAdditional = never> {
  enabled: IAllLogOptions<TAdditional>["enabled"];
  level: IAllLogOptions<TAdditional>["level"];
  prefix: string;
}

const DEFAULT_OPTIONS: Readonly<IAllLogOptions<null>> = Object.freeze({
  enabled: null,
  enabledCondition: null,
  level: null,
  name: null,
  prefix: null,
});

const ROOT_OPTIONS: IInternalLogOptions = {
  enabled: true,
  level: MINIMUM_LOGGING_LEVEL,
  prefix: C.LOG_PREFIX,
};

type Stage2LogArgs = [LogLevel, LogFnName, string[], any[]];
interface IDelayedLogArgs {
  forceLog: boolean;
  logArgs: Stage2LogArgs;
}

export class Log implements Common.ILog {
  private ownInternalOptions: IInternalLogOptions<null> = {
    enabled: null,
    level: null,
    prefix: "",
  };
  private ownDelayedLogs: Map<Promise<boolean>, IDelayedLogArgs[]> = new Map();
  private parent: Log | null = null;

  public constructor(aOptions?: ILogOptions, aParent?: Log) {
    const options: IAllLogOptions<null> =
        Object.assign({}, DEFAULT_OPTIONS, aOptions);
    let {enabled, name} = options;
    const {enabledCondition, level, prefix} = options;

    if (enabledCondition !== null && enabled !== null) {
      console.error("Both 'enabledCondition' and 'enabled' specified! " +
          "Ignoring 'enabled'.");
      enabled = null;
    }
    if (enabled !== null) this.setEnabled(enabled);
    if (enabledCondition !== null) this.setEnabledIf(enabledCondition);

    this.setLevel(level);

    if (name !== null && prefix !== null) {
      console.error("Both 'name' and 'prefix' specified! " +
          "Ignoring 'name'.");
      name = null;
    }

    if (name !== null) this.setName(name);
    if (prefix !== null) this.setPrefix(name);

    if (aParent) this.parent = aParent;
  }

  // getter methods

  public get enabled(): boolean | Promise<boolean> {
    return this.getInternalOption("enabled");
  }

  public get level(): LogLevel {
    return this.getInternalOption("level");
  }

  public get prefix(): string {
    const parentPrefix = this.parent ? this.parent.prefix : ROOT_OPTIONS.prefix;
    return parentPrefix + this.ownInternalOptions.prefix;
  }

  // callback log methods

  public cbDir(cb: () => [string, any]) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const [msg, ...args] = cb();
    this.dir(msg, ...args);
  }

  public cbError(cb: () => ([string, any])) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const [msg, error] = cb();
    this.error(msg, error);
  }

  public cbLog(cb: () => [string]) {
    if (this.shouldLog(LogLevel.DEBUG)) return;
    const [msg, ...args] = cb();
    this.dir(msg, ...args);
  }

  public cbInfo(cb: () => [string]) {
    if (this.shouldLog(LogLevel.INFO)) return;
    const [msg, ...args] = cb();
    this.dir(msg, ...args);
  }

  public cbWarn(cb: () => [string]) {
    if (this.shouldLog(LogLevel.WARNING)) return;
    const [msg, ...args] = cb();
    this.dir(msg, ...args);
  }

  // log methods

  public dir(...args: any[]) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    dir(...args);
  }

  public error(msg: string | string[], ...errorsAndOtherDirArgs: any[]) {
    this.maybeLogInternal(LogLevel.ERROR, "error", msg, errorsAndOtherDirArgs);
  }

  public log(msg: string | string[], ...args: any[]) {
    this.maybeLogInternal(LogLevel.DEBUG, "log", msg, args);
  }

  public info(msg: string | string[], ...args: any[]) {
    this.maybeLogInternal(LogLevel.INFO, "info", msg, args);
  }

  public warn(msg: string | string[], ...args: any[]) {
    this.maybeLogInternal(LogLevel.WARNING, "warn", msg, args);
  }

  public onError(msg: string | string[], ...args: any[]) {
    return (error: any) => {
      this.error(msg, error, ...args);
    };
  }

  // setter methods

  public setEnabled(enabled: boolean | null | Promise<boolean>) {
    if (typeof (enabled as Promise<boolean>).then === "function") {
      const pEnabled = enabled as Promise<boolean>;
      const delayedLog: IDelayedLogArgs[] = [];
      this.ownDelayedLogs.set(pEnabled, delayedLog);
      pEnabled.then((finallyEnabled) => {
        if (this.ownInternalOptions.enabled === pEnabled) {
          this.ownInternalOptions.enabled = finallyEnabled;
        }
        delayedLog.forEach(({forceLog, logArgs}) => {
          if (finallyEnabled || forceLog) {
            logArgs[2][0] = `[DELAYED] ${logArgs[2][0]}`;
            this.logNowInternal.apply(this, logArgs);
          }
        });
        this.ownDelayedLogs.delete(pEnabled);
      }).catch((e) => {
        console.error(`An error occurred:`);
        console.dir(e);
      });
    }
    this.ownInternalOptions.enabled = enabled;
  }

  public setEnabledIf(condition: IEnabledCondition) {
    let conditionFulfilled: boolean;
    switch (typeof condition) {
      case "object":
        switch (condition.type) {
          case "C":
            if (typeof condition.C !== "string") {
              console.error("Log: condition.C is not a string!");
              return;
            }
            if (!(condition.C in C)) {
              console.error(`Log: Constant "${condition.C}" does not exist!`);
              return;
            }
            if (typeof C[condition.C] !== "boolean") {
              console.warn(`Log: C["${condition.C}"] is not a bool.`);
            }
            conditionFulfilled = !!C[condition.C];
            break;

          default:
            console.error("Log: Invalid condition type");
            return;
        }
        break;

      default:
        conditionFulfilled = !!condition;
        break;
    }
    this.setEnabled(conditionFulfilled);
  }

  public setLevel(level: LogLevel | null | "all") {
    if (level === "all") level = LogLevel.ALL;
    this.ownInternalOptions.level = level;
  }

  public setName(name: string | null) {
    this.ownInternalOptions.prefix = name ? `[${name}] ` : "";
  }

  public setPrefix(prefix: string | null) {
    this.ownInternalOptions.prefix = prefix || "";
  }

  public extend(options: ILogOptions) {
    return new Log(options, this);
  }

  private getInternalOption<T extends "level" | "enabled">(
      aOption: T,
  ): IAllLogOptions[T] {
    if (this.ownInternalOptions[aOption] !== null) {
      return this.ownInternalOptions[aOption] as IAllLogOptions[T];
    }
    if (this.parent !== null) {
      return this.parent[aOption];
    }
    return ROOT_OPTIONS[aOption];
  }

  private getDelayedLog(aEnabledPromise: Promise<boolean>): IDelayedLogArgs[] {
    if (this.ownDelayedLogs.has(aEnabledPromise)) {
      return this.ownDelayedLogs.get(aEnabledPromise)!;
    }
    if (this.parent !== null) {
      return this.parent.getDelayedLog(aEnabledPromise);
    }
    throw new Error(`Promise not found: ${aEnabledPromise}`);
  }

  private shouldLog(aLevel: LogLevel): boolean | Promise<boolean> {
    if (aLevel >= MINIMUM_LOGGING_LEVEL) {
      // log even if logging is disabled
      return true;
    }

    if (C.UI_TESTING && aLevel >= LogLevel.WARNING) {
      // log even if logging is disabled
      return true;
    }

    if (aLevel >= this.level) {
      const isPromise = typeof this.enabled !== "boolean";
      if (isPromise) {
        return this.enabled as Promise<boolean>;
      } else if (this.enabled) {
        return true;
      }
    }

    return false;
  }

  private maybeLogInternal(
      aLevel: LogLevel,
      aFnName: LogFnName,
      aMsg: string | string[],
      aDirArgs: any[],
  ) {
    const shouldLog = this.shouldLog(aLevel);
    if (shouldLog === false) return;

    const msgs = typeof aMsg === "object" ? aMsg : [aMsg];

    const isPromise = typeof this.enabled !== "boolean";
    if (!isPromise) {
      // shouldLog is definitely true
      return this.logNowInternal(aLevel, aFnName, msgs, aDirArgs);
    }
    const forceLog = shouldLog === true;
    const delayedLog = this.getDelayedLog(this.enabled as Promise<boolean>);
    if (!delayedLog) {
      console.error(`delayedLog for ${this.enabled} is undefined`);
      console.dir(this.enabled);
      return;
    }
    delayedLog.push({
      forceLog,
      logArgs: [aLevel, aFnName, msgs, aDirArgs],
    });
  }

  private logNowInternal(
      aLevel: LogLevel,
      aFnName: LogFnName,
      aMsgs: string[],
      aDirArgs: any[],
  ) {
    const [firstMsg, ...otherMsgs] = aMsgs;
    console[aFnName](this.prefix + firstMsg, ...otherMsgs);
    dir(...aDirArgs);
  }
}
