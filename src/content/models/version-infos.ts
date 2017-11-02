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

import * as JSUtils from "content/lib/utils/js-utils";
import {Log as log} from "content/models/log";

declare const LegacyApi: any;
declare const Services: any;

const dReady = JSUtils.defer();

interface IInfos {
  curAppVersion: string;
  curRPVersion: string;
  isRPUpgrade: boolean;
  lastAppVersion: string;
  lastRPVersion: string;
}
interface IInfosOrNull {
  curAppVersion?: IInfos["curAppVersion"] | null;
  curRPVersion?: IInfos["curRPVersion"] | null;
  isRPUpgrade?: IInfos["isRPUpgrade"] | null;
  lastAppVersion?: IInfos["lastAppVersion"] | null;
  lastRPVersion?: IInfos["lastRPVersion"] | null;
}
interface IInfoPromises {
  curAppVersion?: Promise<IInfos["curAppVersion"]>;
  curRPVersion?: Promise<IInfos["curRPVersion"]>;
  isRPUpgrade?: Promise<IInfos["isRPUpgrade"]>;
  lastAppVersion?: Promise<IInfos["lastAppVersion"]>;
  lastRPVersion?: Promise<IInfos["lastRPVersion"]>;
}

export const VersionInfos: IInfosOrNull & {
  pReady: Promise<any>,
} = {
  curAppVersion: Services.appinfo.version,
  curRPVersion: null,
  isRPUpgrade: null,
  lastAppVersion: LegacyApi.prefs.get("lastAppVersion"),
  lastRPVersion: LegacyApi.prefs.get("lastVersion"),
  pReady: dReady.promise,
};

const promises: IInfoPromises = {};

promises.curRPVersion = browser.management.getSelf().then((addon) => {
  const curRPVersion = addon.version;
  VersionInfos.curRPVersion = curRPVersion;
  return curRPVersion;
});
promises.curRPVersion.catch((e) => {
  console.error("Error setting lastRPVersion. Details:");
  console.dir(e);
});

promises.lastRPVersion = Promise.resolve(
    VersionInfos.lastRPVersion as string);
promises.isRPUpgrade = promises.lastRPVersion.then((lastRPVersion) => {
  // Compare with version 1.0.0a8 since that version introduced
  // the "welcome window".
  VersionInfos.isRPUpgrade = !!lastRPVersion &&
      Services.vc.compare(lastRPVersion, "1.0.0a8") <= 0;
  return VersionInfos.isRPUpgrade;
});
promises.isRPUpgrade.catch((e) => {
  log.error("Failed to set 'isRPUpgrade':", e);
});

Promise.all(JSUtils.objectValues(promises)).then(() => {
  dReady.resolve(null);
  return;
}).catch((e) => {
  log.error("Failed to initialize VersionInfos", e);
  dReady.reject(e);
});
