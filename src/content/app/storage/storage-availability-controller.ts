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

import { App, IObject } from "app/interfaces";
import { Common } from "common/interfaces";
import { C } from "data/constants";
import { Module } from "lib/classes/module";

export class StorageAvailabilityController extends Module
    implements App.storage.IStorageAvailabilityController {
  protected get debugEnabled() { return C.LOG_STORAGE_MIGRATION; }

  private gotStorageMigrationToWE: Promise<void>;
  private storageMigrationToWE:
      App.migration.storage.IStorageMigrationToWebExtension | null;

  protected get startupPreconditions() {
    return {
      gotStorageMigrationToWE: this.gotStorageMigrationToWE,
    };
  }

  constructor(
      log: Common.ILog,
      protected readonly outerWindowID: number | null,
      private readonly settingsMigration:
          App.migration.storage.ISettingsMigration | null,
      pStorageMigrationToWE:
          Promise<App.migration.storage.IStorageMigrationToWebExtension | null>,
  ) {
    super(
        (outerWindowID === null ? "app" : `AppContent[${outerWindowID}]`) +
        `.storage.available`,
        log,
    );

    this.gotStorageMigrationToWE = pStorageMigrationToWE.then((m) => {
      this.storageMigrationToWE = m;
    });
  }

  protected get dependencies() {
    return Object.assign(
        {} as IObject<Module>,
        this.storageMigrationToWE ? {
          storageMigrationToWE: this.storageMigrationToWE,
        } : {},
        this.settingsMigration ? {
          settingsMigration: this.settingsMigration,
        } : {},
    );
  }
}
