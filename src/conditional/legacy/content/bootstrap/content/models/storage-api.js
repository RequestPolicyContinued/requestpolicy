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

import {Prefs} from "bootstrap/models/prefs";
import {Event} from "content/lib/classes/event";
import {Log} from "content/models/log";

const log = Log.extend({name: "Storage API"});

function getPref(aKey) {
  return Prefs.get(aKey);
}

const events = {};

export const StorageApi = {
  local: {
    get(aKeys) {
      if (typeof aKeys === "string") {
        return Promise.resolve(getPref(aKeys));
      }
      let keys;
      if (Array.isArray(aKeys)) {
        keys = aKeys;
      } else if (typeof aKeys === "object") {
        keys = Object.keys(aKeys);
      } else {
        keys = Prefs.ALL_KEYS;
      }
      let results = {};
      keys.forEach(key => {
        results[key] = getPref(key);
      });
      return Promise.resolve(results);
    },

    set(aKeys) {
      if (typeof aKeys !== "object") {
        let msg = "browser.storage.local.set(): aKeys must be an object!";
        log.error(msg, aKeys);
        return Promise.reject(new Error(msg));
      }
      Object.keys(aKeys).forEach(key => {
        Prefs.set(key, aKeys[key]);
      });
      Prefs.save();
      return Promise.resolve();
    },
  },
};

Event.createMultiple(["onChanged"], {
  assignEventsTo: events,
  assignEventTargetsTo: StorageApi,
});
