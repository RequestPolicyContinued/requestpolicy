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

import {Prefs} from "bootstrap/models/prefs";
import {C} from "data/constants";

declare const Services: any;

export const lastAppVersion: string = Prefs.get("lastAppVersion");

const {ID: appID, name: appName, platformVersion} = Services.appinfo;
export const isFirefox: boolean = appID === C.FIREFOX_ID;
export const isSeamonkey: boolean = appID === C.SEAMONKEY_ID;
export const isGecko: boolean = appName !== "Pale Moon";
export const isAustralis: boolean = isFirefox &&
    Services.vc.compare(platformVersion, "29") >= 0;

export function isGeckoVersionAtLeast(aMinVersion: string): boolean {
  return isGecko &&
      Services.vc.compare(platformVersion, aMinVersion) >= 0;
}
