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
import { Module } from "lib/classes/module";

export class SettingsMigration extends Module {
  constructor(
      log: App.ILog,
      private storage: browser.storage.StorageArea,
  ) {
    super("app.migration.settings", log);
  }

  protected startupSelf() {
    return Promise.all([
      this.performMergeActions(),
      this.performRemoveActions(),
    ]).then(() => undefined);
  }

  private async performMergeActions(): Promise<void> {
    const pMerges = Promise.all([
      this.mergePrefetchingSettings(),
    ]).then(() => undefined);
    pMerges.catch(this.log.onError("merge settings"));
    return pMerges;
  }

  private async mergePrefetchingSettings(): Promise<void> {
    const values = await this.storage.get([
      "prefetch.link.disableOnStartup",
      "prefetch.dns.disableOnStartup",
      "prefetch.preconnections.disableOnStartup",
    ]);
    const obsoletePrefetchSettingsExist =
        values.hasOwnProperty("prefetch.link.disableOnStartup") ||
        values.hasOwnProperty("prefetch.dns.disableOnStartup") ||
        values.hasOwnProperty("prefetch.preconnections.disableOnStartup");
    if (!obsoletePrefetchSettingsExist) return;
    const shouldDisablePrefetching =
        !!values["prefetch.link.disableOnStartup"] ||
        !!values["prefetch.dns.disableOnStartup"] ||
        !!values["prefetch.preconnections.disableOnStartup"];
    const pMerge = Promise.all([
      this.storage.remove([
        "prefetch.link.disableOnStartup",
        "prefetch.dns.disableOnStartup",
        "prefetch.preconnections.disableOnStartup",
      ]),
      this.storage.set({
        "browserSettings.disablePrefetching": shouldDisablePrefetching,
      }),
    ]);
    pMerge.catch(this.log.onError("merge prefetch settings"));
    await pMerge;
  }

  private performRemoveActions(): Promise<void> {
    const pRemove = this.storage.remove([
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
