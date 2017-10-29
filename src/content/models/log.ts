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

import {C} from "content/data/constants";

// ===========================================================================
// constants
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

// =============================================================================
// LogClass
// =============================================================================

interface IEnabledCondition {
  type: "C";
  C?: string;
}

interface IAllLogOptions {
  enabled: boolean | null;
  enabledCondition: IEnabledCondition | null;
  level: LogLevel | null;
  name: string | null;
  prefix: string | null;
}

interface ILogOptions {
  enabled?: IAllLogOptions["enabled"];
  enabledCondition?: IAllLogOptions["enabledCondition"];
  level?: IAllLogOptions["level"] | "all";
  name?: IAllLogOptions["name"];
  prefix?: IAllLogOptions["prefix"];
}

interface IInternalLogOptions {
  enabled: IAllLogOptions["enabled"];
  level: IAllLogOptions["level"];
  prefix: string;
}

const DEFAULT_OPTIONS: Readonly<IAllLogOptions> = Object.freeze({
  enabled: null,
  enabledCondition: null,
  level: null,
  name: null,
  prefix: null,
});

export class LogClass {
  private ownInternalOptions: IInternalLogOptions = {
    enabled: true,
    level: MINIMUM_LOGGING_LEVEL,
    prefix: "",
  };
  private parent: LogClass | null = null;

  constructor(aOptions: ILogOptions, aParent?: LogClass) {
    const options: IAllLogOptions =
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
    if (this.ownInternalOptions.enabled !== null) {
      return this.ownInternalOptions.enabled;
    }
    if (this.parent !== null) {
      return this.parent.enabled;
    }
    console.error("root Log does not have 'enabled' set.");
    return true;
  }

  public get level(): LogLevel {
    if (this.ownInternalOptions.level !== null) {
      return this.ownInternalOptions.level;
    }
    if (this.parent !== null) {
      return this.parent.level;
    }
    console.error("root Log does not have 'enabled' set.");
    return LogLevel.ALL;
  }

  public get prefix(): string {
    const parentPrefix = this.parent ? this.parent.prefix : "";
    return parentPrefix + this.ownInternalOptions.prefix;
  }

  // log methods

  public dir(...args: any[]) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.dir(...args);
  }

  public error(message: string, error: any) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    console.error(this.prefix + message);
    if (error) {
      console.dir(error);
    }
  }

  public log(msg: string, ...args: any[]) {
    this.logInternal(LogLevel.DEBUG, "log", msg, ...args);
  }

  public info(msg: string, ...args: any[]) {
    this.logInternal(LogLevel.INFO, "info", msg, ...args);
  }

  public warn(msg: string, ...args: any[]) {
    this.logInternal(LogLevel.WARNING, "warn", msg, ...args);
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
    return new LogClass(options, this);
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
      aMsg: string,
      ...args: any[],
  ) {
    if (!this.shouldLog(aLevel)) return;
    console[aFnName](this.prefix + aMsg, ...args);
  }
}

// =============================================================================
// Log
// =============================================================================

export const Log = new LogClass({
  enabled: true,
  level: LogLevel.ALL,
  prefix: C.LOG_PREFIX,
});
