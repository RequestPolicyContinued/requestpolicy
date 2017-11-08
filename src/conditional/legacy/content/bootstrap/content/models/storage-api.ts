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
import {createListenersMap} from "content/lib/utils/listener-factories";
import {Log} from "content/models/log";

const log = Log.extend({name: "Storage API"});

function getPref(aKey: string) {
  return Prefs.get(aKey);
}

function setPref(aKey: string, aValue: any) {
  Prefs.set(aKey, aValue);
}

const {
  interfaces: eventTargets,
} = createListenersMap([
  "onChanged",
]);

export const StorageApi = {
  local: {
    get(aKeys: string | string[] | {[k: string]: any} | null | undefined) {
      if (typeof aKeys === "string") {
        return Promise.resolve(getPref(aKeys));
      }
      let keys: string[];
      if (Array.isArray(aKeys)) {
        keys = aKeys;
      } else if (typeof aKeys === "object") {
        keys = Object.keys(aKeys as {[k: string]: any});
      } else {
        keys = Prefs.ALL_KEYS;
      }
      const results: {[k: string]: any} = {};
      keys.forEach((key) => {
        results[key] = getPref(key);
      });
      return Promise.resolve(results);
    },

    set(aKeys: {[k: string]: any}) {
      if (typeof aKeys !== "object") {
        const msg = "browser.storage.local.set(): aKeys must be an object!";
        log.error(msg, aKeys);
        return Promise.reject(new Error(msg));
      }
      Object.keys(aKeys).forEach((key) => {
        setPref(key, aKeys[key]);
      });
      Prefs.save();
      return Promise.resolve();
    },
  },
  onChanged: eventTargets.onChanged,
};
