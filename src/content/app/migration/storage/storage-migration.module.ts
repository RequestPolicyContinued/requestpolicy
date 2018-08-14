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
import { IModule, Module } from "lib/classes/module";

export class StorageMigration extends Module
    implements App.migration.IStorageMigration {
  protected get startupPreconditions() {
    return [
      this.pStorageMigrationToWE,
    ] as Array<Promise<any>>;
  }

  private storageMigrationToWE:
      App.migration.storage.IStorageMigrationToWebExtension | null;

  constructor(
      log: Common.ILog,
      public readonly settingsMigration:
          App.migration.storage.ISettingsMigration,
      public readonly v0Rules: App.migration.storage.IV0RulesMigration | null,
      private pStorageMigrationToWE:
          Promise<App.migration.storage.IStorageMigrationToWebExtension | null>,
  ) {
    super("app.migration.storage", log);
    pStorageMigrationToWE.then((m) => {
      if (this.debugEnabled) {
        if (m === null) {
          this.debugLog.log(`"IStorageMigrationToWebExtension" n/a`);
        } else {
          this.debugLog.log(`got "IStorageMigrationToWebExtension"`);
        }
      }
      this.storageMigrationToWE = m;
    }).catch(this.log.onError("pStorageMigrationToWE"));
  }

  protected get subModules() {
    const rv: {[k: string]: IModule} = {
      settingsMigration: this.settingsMigration,
    };
    if (this.storageMigrationToWE) {
      rv.storageMigrationToWE = this.storageMigrationToWE;
    }
    if (this.v0Rules) { rv.v0Rules = this.v0Rules; }
    return rv;
  }
}
