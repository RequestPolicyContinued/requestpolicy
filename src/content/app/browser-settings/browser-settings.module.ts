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

export class BrowserSettings extends Module implements App.IBrowserSettings {
  protected get dependencies(): Module[] {
    return [
      this.cachedSettings,
    ];
  }

  constructor(
      log: Common.ILog,
      private cachedSettings: App.storage.ICachedSettings,
      private networkPrivacyApi: browser.privacy.network,
  ) {
    super("app.browserSettings", log);
  }

  protected startupSelf() {
    if (this.cachedSettings.get("browserSettings.disableNetworkPrediction")) {
      this.networkPrivacyApi.networkPredictionEnabled.set({value: false}).catch(
          this.log.onError("set networkPredictionEnabled false"),
      );
    } else {
      this.networkPrivacyApi.networkPredictionEnabled.clear({}).catch(
          this.log.onError("clear networkPredictionEnabled setting"),
      );
    }

    return MaybePromise.resolve(undefined);
  }
}
