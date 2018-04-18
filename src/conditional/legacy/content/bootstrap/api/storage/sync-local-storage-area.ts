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

import { API, JSMs } from "bootstrap/api/interfaces";
import { C } from "data/constants";
import {
  AbstractObjectInterface,
  IKeysObject,
} from "lib/classes/object-interface";

export class SyncLocalStorageArea extends AbstractObjectInterface<any>
    implements API.storage.ISyncLocalStorageArea {
  constructor(
      private prefsService: JSMs.Services["prefs"],
      private rpPrefBranch: API.storage.IPrefBranch,
      private jsonStorage: API.storage.IJsonStorage,
  ) {
    super();
  }

  protected getAll() {
    return Object.assign(
        {},
        this.rpPrefBranch.getAll(),
        this.jsonStorage.getAll(),
    );
  }

  protected getNothing() {
    return {};
  }

  protected getByKeys(aKeys: string[]) {
    const results: IKeysObject = {};
    aKeys.forEach((key) => {
      const result = this.jsonStorage.isJsonStorageKey(key) ?
          this.jsonStorage.get(key) : this.rpPrefBranch.get(key);
      if (result !== C.UNDEFINED) {
        results[key] = result;
      }
    });
    return results;
  }

  protected setByKey(aKey: string, aValue: any) {
    if (this.jsonStorage.isJsonStorageKey(aKey)) {
      this.jsonStorage.set(aKey, aValue);
    } else {
      this.rpPrefBranch.set<any>(aKey, aValue);
      this.prefsService.savePrefFile(null);
    }
  }

  protected removeByKeys(aKeys: string[]) {
    if (aKeys.length !== 0) {
      throw new Error("Not implemented!");
    }
  }
}
