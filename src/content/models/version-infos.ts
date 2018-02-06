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

import * as JSUtils from "lib/utils/js-utils";
import {Log} from "models/log";

const log = Log.instance;

declare const Services: any;

interface IInfos {
  curAppVersion: string;
  curRPVersion: string;
  isRPUpgrade: boolean;
  lastAppVersion: string;
  lastRPVersion: string;
}
interface IOptionalInfos {
  curAppVersion?: IInfos["curAppVersion"];
  curRPVersion?: IInfos["curRPVersion"];
  isRPUpgrade?: IInfos["isRPUpgrade"];
  lastAppVersion?: IInfos["lastAppVersion"];
  lastRPVersion?: IInfos["lastRPVersion"];
}
interface IInfoPromises {
  curAppVersion?: Promise<IInfos["curAppVersion"]>;
  curRPVersion?: Promise<IInfos["curRPVersion"]>;
  isRPUpgrade?: Promise<IInfos["isRPUpgrade"]>;
  lastAppVersion?: Promise<IInfos["lastAppVersion"]>;
  lastRPVersion?: Promise<IInfos["lastRPVersion"]>;
}

// =============================================================================
// VersionInfos
// =============================================================================

const dReady = JSUtils.defer();

export const VersionInfos: IOptionalInfos & {
  pReady: Promise<any>,
} = {
  pReady: dReady.promise,
};

const promises: IInfoPromises = {};

function checkPromise(aPropName: keyof IInfoPromises) {
  (promises[aPropName] as Promise<any>).catch((e) => {
    log.error(`Error initializing "${aPropName}":`, e);
  });
}

// -----------------------------------------------------------------------------
// RP version info
// -----------------------------------------------------------------------------

promises.lastRPVersion =
    browser.storage.local.get("lastVersion").
    then(({lastVersion}) => {
      VersionInfos.lastRPVersion = lastVersion;
      return lastVersion;
    });
checkPromise("lastRPVersion");

promises.isRPUpgrade =
    promises.lastRPVersion.
    then((lastRPVersion) => {
      // Compare with version 1.0.0a8 since that version introduced
      // the "welcome window".
      VersionInfos.isRPUpgrade = !!lastRPVersion &&
          Services.vc.compare(lastRPVersion, "1.0.0a8") <= 0;
      return VersionInfos.isRPUpgrade;
    });
checkPromise("isRPUpgrade");

promises.curRPVersion =
    browser.management.getSelf().
    then((addon) => {
      VersionInfos.curRPVersion = addon.version;
      return VersionInfos.curRPVersion;
    });
checkPromise("curRPVersion");

// -----------------------------------------------------------------------------
// app version info
// -----------------------------------------------------------------------------

promises.lastAppVersion =
    browser.storage.local.get("lastAppVersion").
    then(({lastAppVersion}) => {
      VersionInfos.lastAppVersion = lastAppVersion;
      return lastAppVersion;
    });
checkPromise("lastAppVersion");

// -----------------------------------------------------------------------------
// deferred "ready"
// -----------------------------------------------------------------------------

Promise.all(JSUtils.objectValues(promises)).then(() => {
  dReady.resolve(null);
  return;
}).catch((e) => {
  log.error("Failed to initialize VersionInfos", e);
  dReady.reject(e);
});
