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
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import { PrefetchSettingsMerger } from "./merge-prefetch-settings";

export class SettingsMigration extends Module
    implements App.migration.storage.ISettingsMigration {
  private storageMigrationToWE:
      App.migration.storage.IStorageMigrationToWebExtension | null;

  constructor(
      log: Common.ILog,
      private storageArea: browser.storage.StorageArea,  // badword-linter:allow:browser.storage:
      private pStorageMigrationToWE:
          Promise<App.migration.storage.IStorageMigrationToWebExtension | null>,
  ) {
    super("app.migration.storage.settings", log);
  }

  protected startupSelf() {
    return MaybePromise.resolve(this.startupSelfAsync());
  }

  protected async startupSelfAsync() {
    this.debugLog.log(`awaiting pStorageMigrationToWE`);
    this.storageMigrationToWE = await this.pStorageMigrationToWE;
    if (this.storageMigrationToWE) {
      this.debugLog.log(`awaiting pStorageReadyForAccess`);
      await this.storageMigrationToWE.pStorageReadyForAccess;
    }
    this.debugLog.log(`awaiting actions`);
    await Promise.all([
      this.performMergeActions(),
      this.performRemoveActions(),
    ]);
  }

  private async performMergeActions(): Promise<void> {
    const pMerges = Promise.all([
      new PrefetchSettingsMerger(this.log, this.storageArea).performAction(),
    ]);
    pMerges.catch(this.log.onError("merge settings"));
    return pMerges as Promise<any>;
  }

  private performRemoveActions(): Promise<void> {
    const pRemove = this.storageArea.remove([
      // removed in 0.2.0:
      "temporarilyAllowedOrigins",
      "temporarilyAllowedDestinations",
      "temporarilyAllowedOriginsToDestinations",
      // removed due to the WebExtension transition:
      "prefetch.dns.restoreDefaultOnUninstall",
      "prefetch.link.restoreDefaultOnUninstall",
      "prefetch.preconnections.restoreDefaultOnUninstall",
    ]);
    pRemove.catch(this.log.onError("remove settings"));
    return pRemove;
  }
}
