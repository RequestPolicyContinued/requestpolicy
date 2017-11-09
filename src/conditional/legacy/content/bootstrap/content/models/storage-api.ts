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

import {isJsonPref, JsonPrefs} from "bootstrap/models/json-prefs";
import {Prefs} from "bootstrap/models/prefs";
import {C} from "content/data/constants";
import {createListenersMap} from "content/lib/utils/listener-factories";

// =============================================================================

interface IKeysWithDefaults {
  [k: string]: any;
}

// =============================================================================

function getPrefsModel(aKey: string) {
  return isJsonPref(aKey) ? JsonPrefs : Prefs;
}

function getPref(aKey: string) {
  return getPrefsModel(aKey).get(aKey);
}

function setPref(aKey: string, aValue: any) {
  getPrefsModel(aKey).set(aKey, aValue);
}

function getAllPrefs() {
  return Prefs.branches.rp.getAll().concat(JsonPrefs.getAll());
}

function getNothing() {
  return {};
}

function getPrefs(aKeys: string[]) {
  const results: {[k: string]: any} = {};
  aKeys.forEach((key) => {
    const result = getPref(key);
    if (result !== C.UNDEFINED) {
      results[key] = result;
    }
  });
  return results;
}

// =============================================================================

function get(aKeys: string | string[] | IKeysWithDefaults | null | undefined) {
  if (aKeys === "") return getNothing();
  let keys: string[];
  let isObjectWithDefaults = false;

  if (typeof aKeys === "string") {
    keys = [aKeys];
  } else if (typeof aKeys === "object") {
    if (Array.isArray(aKeys)) {
      keys = aKeys as string[];
    } else {
      isObjectWithDefaults = true;
      keys = Object.keys(aKeys as IKeysWithDefaults);
    }
    if (keys.length === 0) {
      return getNothing();
    }
  } else {
    return getAllPrefs();
  }
  const results = getPrefs(keys);
  if (isObjectWithDefaults) {
    const defaults = aKeys as IKeysWithDefaults;
    // tslint:disable-next-line prefer-const
    for (let key in keys) {
      if (!(results.hasOwnProperty(key))) {
        results[key] = defaults[key];
      }
    }
  }
  return results;
}

function set(aKeys: {[k: string]: any}) {
  if (typeof aKeys !== "object") {
    throw new Error("browser.storage.local.set(): aKeys must be an object!");
  }
  Object.keys(aKeys).forEach((key) => {
    setPref(key, aKeys[key]);
  });
  Prefs.save();
}

const {
  interfaces: eventTargets,
} = createListenersMap([
  "onChanged",
]);

export const StorageApi = {
  local: {
    get(aKeys: string | string[] | IKeysWithDefaults | null | undefined) {
      return Promise.resolve(get(aKeys));
    },
    set(aKeys: {[k: string]: any}) {
      try {
        return Promise.resolve(set(aKeys));
      } catch (e) {
        return Promise.reject(e);
      }
    },
  },
  onChanged: eventTargets.onChanged,
};
