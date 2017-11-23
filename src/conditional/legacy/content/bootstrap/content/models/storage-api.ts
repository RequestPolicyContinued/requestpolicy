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
import {
  AbstractObjectInterface,
  IKeysObject,
  IKeysWithDefaults,
} from "content/lib/classes/object-interface";
import {createListenersMap} from "content/lib/utils/listener-factories";

// =============================================================================

function getPrefsModel(aKey: string) {
  return isJsonPref(aKey) ? JsonPrefs : Prefs;
}

class SyncLocalStorageArea extends AbstractObjectInterface<any> {
  protected getAll() {
    return Prefs.branches.rp.getAll().concat(JsonPrefs.getAll());
  }
  protected getNothing() {
    return {};
  }
  protected getByKeys(aKeys: string[]) {
    const results: IKeysObject = {};
    aKeys.forEach((key) => {
      const result = getPrefsModel(key).get(key);
      if (result !== C.UNDEFINED) {
        results[key] = result;
      }
    });
    return results;
  }
  protected setByKey(aKey: string, aValue: any) {
    getPrefsModel(aKey).set(aKey, aValue);
  }
  protected removeByKeys(aKeys: string[]) {
    if (aKeys.length !== 0) {
      throw new Error("Not implemented!");
    }
  }
}

const slsa = new SyncLocalStorageArea();

const {
  interfaces: eventTargets,
} = createListenersMap([
  "onChanged",
]);

export const StorageApi = {
  local: {
    get(aKeys: string | string[] | IKeysWithDefaults | null | undefined) {
      return Promise.resolve(slsa.get(aKeys));
    },
    set(aKeys: {[k: string]: any}) {
      try {
        return Promise.resolve(slsa.set(aKeys));
      } catch (e) {
        return Promise.reject(e);
      }
    },
  },
  onChanged: eventTargets.onChanged,
};
