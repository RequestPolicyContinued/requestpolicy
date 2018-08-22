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
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

export class Storage extends Module implements App.IStorage {
  constructor(
      log: Common.ILog,
      protected readonly outerWindowID: number | null,
      public readonly apiWrapper: App.storage.IStorageApiWrapper,
      public readonly asyncSettings: App.storage.IAsyncSettings,
      public readonly cachedSettings: App.storage.ICachedSettings | null,
      public readonly storageAvailabilityController:
          App.storage.IStorageAvailabilityController,
  ) {
    super(
        (outerWindowID === null ? "app" : `AppContent[${outerWindowID}]`) +
        `.storage`,
        log,
    );
  }

  protected get subModules() {
    const rv: {[k: string]: Module} = {
      apiWrapper: this.apiWrapper,
      asyncSettings: this.asyncSettings,
      storageAvailabilityController: this.storageAvailabilityController,
    };
    if (this.cachedSettings !== null) {
      rv.cachedSettings = this.cachedSettings;
    }
    return rv;
  }
}
