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

import {
  LEVEL as LOG_LEVEL,
  Logger as LoggerCls,
} from "content/lib/classes/logger";

// =============================================================================
// Logger
// =============================================================================

export const Logger = new LoggerCls({
  enabled: true,
  level: LOG_LEVEL.ALL,
});

browser.storage.local.get([
  "log",
  "log.level",
]).then(result => {
  Logger.setEnabled(result.log);
  Logger.setLevel(result["log.level"]);
  return;
}).catch(error => {
  console.error("Error initializing the Logger! Details:");
  console.dir(error);
});

function onStorageChange(aChanges, aAreaName) {
  if (aChanges.hasOwnProperty("log")) {
    Logger.setEnabled(aChanges.log.newValue);
  }
  if (aChanges.hasOwnProperty("log.level")) {
    Logger.setLevel(aChanges["log.level"].newValue);
  }
}

browser.storage.onChanged.addListener(onStorageChange);

export function createExtendedLogger(...args) {
  return Logger.extend(...args);
}
