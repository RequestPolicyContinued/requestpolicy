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

import {C} from "content/lib/utils/constants";

// ===========================================================================
// constants
// ===========================================================================

export const LEVEL = Object.freeze({
  OFF: Number.MAX_VALUE, // no logging
  ERROR: 1000,
  WARNING: 900,
  INFO: 800,
  DEBUG: 700,
  ALL: Number.MIN_VALUE, // log everything
});

const MINIMUM_LOGGING_LEVEL = LEVEL.ERROR;

// =============================================================================
// LogClass
// =============================================================================

export function LogClass(options) {
  this._setAll(options);
}

const defaultOptions = Object.freeze({
  enabled: null,
  enabledCondition: null,
  level: null,
  name: null,
});

LogClass.prototype = {
  _enabled: true,
  _level: MINIMUM_LOGGING_LEVEL,
  _prefix: C.LOG_PREFIX,
  _parent: null,

  _setAll(aOptions={}) {
    const options = Object.assign({}, defaultOptions, aOptions);
    const {
      enabled,
      enabledCondition,
      level,
      name,
    } = options;

    if (enabledCondition !== null && enabled !== null) {
      console.error("Both 'enabledCondition' and 'enabled' specified!");
    } else {
      if (enabled !== null) this.setEnabled(enabled);
      if (enabledCondition !== null) this.setEnabledIf(enabledCondition);
    }
    this.setLevel(level);
    this.setName(name);
  },

  _shouldLog(aLevel) {
    if (this._enabled && aLevel >= this._level) {
      return true;
    }

    if (aLevel >= MINIMUM_LOGGING_LEVEL) {
      // log even if logging is disabled
      return true;
    }

    if (C.UI_TESTING && aLevel >= LEVEL.WARNING) {
      // log even if logging is disabled
      return true;
    }

    return false;
  },

  dir(...args) {
    if (!this._shouldLog(LEVEL.DEBUG)) return;
    console.dir(...args);
  },

  error(message, error) {
    if (!this._shouldLog(LEVEL.ERROR)) return;
    console["error"](this._prefix + message);
    if (error) {
      console.dir(error);
    }
  },

  _log(aLevel, aFnName, aMsg, ...args) {
    if (!this._shouldLog(aLevel)) return;
    // eslint-disable-next-line no-console
    console[aFnName](this._prefix + aMsg, ...args);
  },

  log(...args) {
    this._log(LEVEL.DEBUG, "log", ...args);
  },

  info(...args) {
    this._log(LEVEL.INFO, "info", ...args);
  },

  warn(...args) {
    this._log(LEVEL.WARNING, "warn", ...args);
  },

  setEnabled(enabled) {
    if (enabled === null) {
      if (this.hasOwnProperty("_enabled")) {
        delete this._enabled;
      }
      return;
    }
    this._enabled = !!enabled;
  },

  setEnabledIf(condition) {
    let conditionFulfilled;
    switch (typeof condition) {
      case "object":
        switch (condition.type) {
          case "C":
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
  },

  setLevel(level) {
    if (level === null) {
      if (this.hasOwnProperty("_level")) {
        delete this._level;
      }
      return;
    }
    if (level === "all") {
      this._level = LEVEL.ALL;
      return;
    }
    this._level = level;
  },

  setName(name) {
    if (name === null) {
      if (this.hasOwnProperty("_prefix")) {
        delete this._prefix;
      }
      return;
    }
    const parentPrefix = Object.getPrototypeOf(this)._prefix;
    this._prefix = parentPrefix + `[${name}] `;
  },

  extend(options) {
    const child = Object.create(this);
    child._setAll(options);
    return child;
  },
};

// =============================================================================
// Log
// =============================================================================

export const Log = new LogClass({
  enabled: true,
  level: LEVEL.ALL,
});
