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
  enabled: boolean | TAdditional;
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

export class Log {
  private static lInstance: Log;
  public static get instance(): Log {
    if (!Log.lInstance) {
      Log.lInstance = new Log({
        enabled: true,
        level: LogLevel.ALL,
        prefix: "",
      });
    }
    return Log.lInstance;
  }

  private ownInternalOptions: IInternalLogOptions<null> = {
    enabled: null,
    level: null,
    prefix: "",
  };
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

  public get enabled(): boolean {
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
    this.logInternal(LogLevel.ERROR, "error", msg, ...errorsAndOtherDirArgs);
  }

  public log(msg: string | string[], ...args: any[]) {
    this.logInternal(LogLevel.DEBUG, "log", msg, ...args);
  }

  public info(msg: string | string[], ...args: any[]) {
    this.logInternal(LogLevel.INFO, "info", msg, ...args);
  }

  public warn(msg: string | string[], ...args: any[]) {
    this.logInternal(LogLevel.WARNING, "warn", msg, ...args);
  }

  public onError(msg: string | string[], ...args: any[]) {
    return (error: any) => {
      this.error(msg, error, ...args);
    };
  }

  // setter methods

  public setEnabled(enabled: boolean | null) {
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

  private shouldLog(aLevel: LogLevel) {
    if (this.enabled && aLevel >= this.level) {
      return true;
    }

    if (aLevel >= MINIMUM_LOGGING_LEVEL) {
      // log even if logging is disabled
      return true;
    }

    if (C.UI_TESTING && aLevel >= LogLevel.WARNING) {
      // log even if logging is disabled
      return true;
    }

    return false;
  }

  private logInternal(
      aLevel: LogLevel,
      aFnName: LogFnName,
      aMsg: string | string[],
      ...aDirArgs: any[],
  ) {
    if (!this.shouldLog(aLevel)) return;
    if (typeof aMsg !== "object") aMsg = [aMsg];
    const [firstMsg, ...otherMsgs] = aMsg;
    console[aFnName](this.prefix + firstMsg, ...otherMsgs);
    dir(...aDirArgs);
  }
}

export const log = Log.instance;
