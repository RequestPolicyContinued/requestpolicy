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

import { Log, LogLevel } from "lib/classes/log";

export class RPLog extends Log {
  constructor(
      private storage: browser.storage.StorageArea,
  ) {
    super({
      enabled: true,
      level: LogLevel.ALL,
      prefix: "",
    });

    const pEnabled = this.storage.get([
      "log",
      "log.level",
    ]).then((result) => {
      this.setEnabled(result.log as boolean);
      this.setLevel(result["log.level"] as LogLevel);
    });
    pEnabled.catch((e) => {
      this.error("Error initializing the logger:", e);
    });

    browser.storage.onChanged.addListener(
        this.onStorageChange.bind(this),
    );
  }

  private onStorageChange(
      aChanges: {[key: string]: browser.storage.StorageChange},
      aAreaName: browser.storage.StorageName,
  ) {
    if (aChanges.hasOwnProperty("log")) {
      this.setEnabled(aChanges.log.newValue);
    }
    if (aChanges.hasOwnProperty("log.level")) {
      this.setLevel(aChanges["log.level"].newValue);
    }
  }
}
