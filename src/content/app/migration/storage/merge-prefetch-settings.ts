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

import { SettingsMigrationAction } from "./settings-migration-action";

export class PrefetchSettingsMerger extends SettingsMigrationAction {
  public async performAction(): Promise<void> {
    const values = await this.storageArea.get([
      "browserSettings.disableNetworkPrediction",
      "prefetch.link.disableOnStartup",
      "prefetch.dns.disableOnStartup",
      "prefetch.preconnections.disableOnStartup",
    ]);

    const obsoletePrefetchSettingsExist =
        values.hasOwnProperty("prefetch.link.disableOnStartup") ||
        values.hasOwnProperty("prefetch.dns.disableOnStartup") ||
        values.hasOwnProperty("prefetch.preconnections.disableOnStartup");
    if (!obsoletePrefetchSettingsExist) return;

    const targetSettingExists =
        values.hasOwnProperty("browserSettings.disableNetworkPrediction");
    const promises: Array<Promise<void>> = [];

    if (!targetSettingExists) {
      const shouldDisablePrefetching =
          !!values["prefetch.link.disableOnStartup"] ||
          !!values["prefetch.dns.disableOnStartup"] ||
          !!values["prefetch.preconnections.disableOnStartup"];
      promises.push(
          this.storageArea.set({
            "browserSettings.disableNetworkPrediction":
                shouldDisablePrefetching,
          }),
      );
    }

    promises.push(this.storageArea.remove([
      "prefetch.link.disableOnStartup",
      "prefetch.dns.disableOnStartup",
      "prefetch.preconnections.disableOnStartup",
    ]));
    const pMerge = Promise.all(promises);
    pMerge.catch(this.log.onError("merge prefetch settings"));
    await pMerge;
  }
}
