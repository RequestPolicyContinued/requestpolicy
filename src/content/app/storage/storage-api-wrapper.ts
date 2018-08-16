/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2018 Martin Kimmerle
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

import { App } from "app/interfaces";
import { API } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

// tslint:disable-next-line:max-line-length
type StorageArea = browser.storage.StorageArea;  // badword-linter:allow:browser.storage:

export class StorageApiWrapper extends Module
    implements App.storage.IStorageApiWrapper {
  // protected get debugEnabled() { return true; }

  public readonly local: StorageArea = Object.assign(
      Object.create(this.api.local),
      { set: this._set.bind(this) },
  );

  protected get startupPreconditions() {
    return [
      this.pStorageReadyForAccess,
    ];
  }

  constructor(
      protected readonly outerWindowID: number | null,
      log: Common.ILog,
      // tslint:disable-next-line:max-line-length
      private readonly api: typeof browser.storage,  // badword-linter:allow:browser.storage:
      private readonly pStorageReadyForAccess: Promise<void>,
  ) {
    super(
        outerWindowID === null ? "app" : `AppContent[${outerWindowID}]` +
        `.apiWrapper`,
        log,
    );
  }

  public get onChanged() { return this.api.onChanged; }
  public get sync() { return this.api.sync; }

  private _set(keys: API.storage.api.StorageObject) {
    keys.lastStorageChange = new Date().toISOString();
    if (this.debugEnabled) this.debugLog.dir(keys);
    return this.api.local.set(keys);
  }
}
