/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
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

import { API, JSMs } from "bootstrap/api/interfaces";
import { C } from "data/constants";

export class MiscInfos {
  public lastAppVersion: string =
      this.rpPrefBranch.get("lastAppVersion") as string;

  public isFirefox: boolean = this.appinfo.ID === C.FIREFOX_ID;
  public isSeamonkey: boolean = this.appinfo.ID === C.SEAMONKEY_ID;
  public isGecko: boolean = this.appinfo.name !== "Pale Moon";
  public isAustralis: boolean = this.isFirefox &&
      this.vc.compare(this.appinfo.platformVersion, "29") >= 0;

  constructor(
      private appinfo: JSMs.Services["appinfo"],
      private rpPrefBranch: API.storage.IPrefBranch,
      private vc: JSMs.Services["vc"],
  ) {}

  public isGeckoVersionAtLeast(aMinVersion: string): boolean {
    return this.isGecko &&
        this.vc.compare(this.appinfo.platformVersion, aMinVersion) >= 0;
  }
}
