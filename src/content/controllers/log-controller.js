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

import {Log} from "content/models/log";

function onStorageChange(aChanges, aAreaName) {
  if (aChanges.hasOwnProperty("log")) {
    Log.setEnabled(aChanges.log.newValue);
  }
  if (aChanges.hasOwnProperty("log.level")) {
    Log.setLevel(aChanges["log.level"].newValue);
  }
}

export const LogController = {
  startup() {
    browser.storage.local.get([
      "log",
      "log.level",
    ]).then(result => {
      Log.setEnabled(result.log);
      Log.setLevel(result["log.level"]);
      return;
    }).catch(e => {
      Log.error("Error initializing the Log:", e);
    });

    browser.storage.onChanged.addListener(onStorageChange);
  },
};
