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

import { API } from "bootstrap/api/interfaces";
import { Module } from "lib/classes/module";
import { Log } from "models/log";

type networkPredictionEnabledSetting =
    API.privacy.network.networkPredictionEnabled;

export class PrivacyApi extends Module {
  constructor(
      log: Log,
      private networkPredictionEnabled: networkPredictionEnabledSetting,
  ) {
    super("browser.privacy", log);
  }

  public get backgroundApi() {
    return {
      network: {
        networkPredictionEnabled: this.networkPredictionEnabled,
      },
    };
  }

  public get contentApi() {
    return this.backgroundApi;
  }

  protected get subModules() {
    return {
      networkPredictionEnabled: this.networkPredictionEnabled,
    };
  }
}
