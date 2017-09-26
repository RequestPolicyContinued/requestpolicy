/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
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

import {C} from "lib/utils/constants";

const {UI_TESTING} = C;

// =============================================================================
// Logger
// =============================================================================

/**
 * Provides logging methods
 */
export const Logger = (function() {
  let self = {};

  // ---------------------------------------------------------------------------
  // constants
  // ---------------------------------------------------------------------------

  const LevelEnum = Object.freeze({
    OFF: Number.MAX_VALUE, // no logging
    ERROR: 1000,
    WARNING: 900,
    INFO: 800,
    DEBUG: 700,
    ALL: Number.MIN_VALUE, // log everything
  });

  const MINIMUM_LOGGING_LEVEL = LevelEnum.ERROR;

  // ---------------------------------------------------------------------------
  // settings
  // ---------------------------------------------------------------------------

  let loggingLevel = LevelEnum.ALL;
  let loggingEnabled = true;

  browser.storage.local.get([
    "log",
    "log.level",
  ]).then(result => {
    loggingEnabled = result.log;
    loggingLevel = result["log.level"];
    return;
  }).catch(error => {
    console.error("Error initializing the Logger! Details:");
    console.dir(error);
  });

  function onStorageChange(aChanges, aAreaName) {
    if (aChanges.hasOwnProperty("log")) {
      loggingEnabled = aChanges.log.newValue;
    }
    if (aChanges.hasOwnProperty("log.level")) {
      loggingLevel = aChanges["log.level"].newValue;
    }
  }

  browser.storage.onChanged.addListener(onStorageChange);

  // ---------------------------------------------------------------------------
  // logging
  // ---------------------------------------------------------------------------

  function shouldLog(aLevel) {
    if (loggingEnabled && aLevel >= loggingLevel) {
      return true;
    }

    if (UI_TESTING && aLevel >= LevelEnum.WARNING) {
      // log even if logging is disabled
      return true;
    }

    if (aLevel >= MINIMUM_LOGGING_LEVEL) {
      // log even if logging is disabled
      return true;
    }

    return false;
  }

  function log(aLevel, aFn, aMessage, aError) {
    if (shouldLog(aLevel)) {
      let msg = `[RequestPolicy] ${aMessage}`;
      aFn(msg);
      if (aError) {
        console.dir(aError);
      }
    }
  }

  /* eslint-disable no-console */
  self.warn = log.bind(self, LevelEnum.WARNING, console.warn);
  self.info = log.bind(self, LevelEnum.INFO, console.info);
  self.debug = log.bind(self, LevelEnum.DEBUG, console.debug);
  /* eslint-enable no-console */

  self.dir = function(obj) {
    if (shouldLog(LevelEnum.DEBUG)) {
      console.dir(obj);
    }
  };

  return self;
})();
