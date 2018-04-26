/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

import {defer, IDeferred} from "lib/utils/js-utils";

// =============================================================================

type AllowedName =
    "browser:windows-available";

const ALLOWED_NAMES = new Set<AllowedName>([
  "browser:windows-available",
]);

interface IData {
  deferred: IDeferred<void, any>;
  registered: boolean;
}

const dataMap = new Map<AllowedName, IData>();

function getData(aName: AllowedName): IData {
  if (!dataMap.has(aName)) {
    dataMap.set(aName, {
      deferred: defer(),
      registered: false,
    });
  }
  return dataMap.get(aName) as IData;
}

// =============================================================================

export function registerAsyncStartup(
    aName: AllowedName,
    aPromise?: Promise<void>,
) {
  if (!ALLOWED_NAMES.has(aName)) {
    console.error(`async startup: Unknown name "${aName}"`);
  }
  const data = getData(aName);
  if (data.registered) {
    console.error(`async startup: "${aName}" is already registered.`);
  }
  data.registered = true;
  const {resolve, reject} = data.deferred;
  if (aPromise) {
    aPromise.then(resolve).catch((e) => {
      console.error(`async startup: "${aName}" has been rejected!`, e);
      reject(e);
    });
    return;
  }
  return {resolve, reject};
}

export function whenReady(...aDependencies: AllowedName[]) {
  const promises: Array<Promise<void>> = [];
  // tslint:disable-next-line prefer-const
  for (let name of aDependencies) {
    if (!ALLOWED_NAMES.has(name)) {
      const e = new Error(
          `async startup: "${name}" is not an allowed name!`);
      console.error(e);
      return Promise.reject(e);
    }
    promises.push(getData(name).deferred.promise);
  }
  return Promise.all(promises);
}
