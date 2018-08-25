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
import { Log, LogLevel } from "lib/classes/log";

export class RPLog extends Log {
  private asyncSettings: App.storage.IAsyncSettings;

  constructor(
      asyncSettingsPromise: Promise<App.storage.IAsyncSettings>,
  ) {
    super({
      enabled: true,
      level: LogLevel.ALL,
      prefix: "",
    });

    const pEnabled = asyncSettingsPromise.then((asyncSettings) => {
      this.asyncSettings = asyncSettings;
      return asyncSettings.whenReady;
    }).then(() => {
      return this.asyncSettings.get([
        "log",
        "log.level",
      ]);
    }).then((result) => {
      this.setLevel(result["log.level"] as LogLevel);
      const enable = result.log as boolean;

      this.asyncSettings.onChanged.addListener(
          this.onStorageChanged.bind(this),
      );

      return enable;
    });
    pEnabled.catch((e) => {
      this.error("Error initializing the logger:", e);
    });
    this.setEnabled(pEnabled);
  }

  private onStorageChanged(
      aChanges: API.storage.api.ChangeDict,
      aAreaName: API.storage.api.StorageName,
  ) {
    if (aChanges.hasOwnProperty("log")) {
      this.setEnabled(aChanges.log.newValue);
    }
    if (aChanges.hasOwnProperty("log.level")) {
      this.setLevel(aChanges["log.level"].newValue);
    }
  }
}
