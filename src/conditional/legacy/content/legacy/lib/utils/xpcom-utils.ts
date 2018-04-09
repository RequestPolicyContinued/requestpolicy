/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

import {
  XPCOMObserver,
  XPCOMObserverTopic,
} from "lib/classes/xpcom-observer";
import {defer} from "lib/utils/js-utils";
import {
  getComplexValueFromPrefBranch,
} from "lib/utils/try-catch-utils";

declare const Ci: any;
declare const LegacyApi: any;

export function promiseObserverTopic(aTopic: XPCOMObserverTopic) {
  const deferred = defer<[any, string, any]>();

  function callback(subject: any, topic: string, data: any) {
    observer.unregister();
    deferred.resolve([subject, topic, data]);
  }

  const observer = new XPCOMObserver(aTopic, callback);

  return deferred.promise;
}

/**
 * @param {string} aPrefName
 * @return {string} The value of the pref, or an empty string if
 *     the pref does not exist.
 */
function getRPV0PrefString(aPrefName: string): string {
  const result = getComplexValueFromPrefBranch(
      LegacyApi.prefs.branches.rp.branch, aPrefName, Ci.nsISupportsString);
  if (!result.error) return result.value!;
  const e = result.error;
  if (e.name !== "NS_ERROR_UNEXPECTED") {
    console.dir(e);
  }
  return "";
}

/**
 * The three strings containing the old rules.
 */
export function getRPV0PrefStrings() {
  return {
    dests: getRPV0PrefString("allowedDestinations"),
    origins: getRPV0PrefString("allowedOrigins"),
    originsToDests: getRPV0PrefString("allowedOriginsToDestinations"),
  };
}
