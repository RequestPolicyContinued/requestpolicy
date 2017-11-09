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

import * as FileUtils from "bootstrap/lib/utils/file-utils";
import {C} from "content/data/constants";

// =============================================================================

export function isJsonPref(aKey: string) {
  return aKey.startsWith("policies/") || aKey === "subscriptions";
}

function assertValidKey(aKey: string) {
  if (!isJsonPref(aKey)) {
    throw new Error(`Invalid key "${aKey}".`);
  }
}

function getFile(aKey: string) {
  return FileUtils.getRPFile(`${aKey}.json`);
}

// =============================================================================

export const JsonPrefs = {
  getAll() {
    const allFiles = FileUtils.getAllRPFiles();
    const allPrefs: {[k: string]: any} = {};
    Object.keys(allFiles).forEach((key) => {
      allPrefs[key] = this.get(key);
    });
    return allPrefs;
  },
  get(aKey: string) {
    assertValidKey(aKey);
    const file = getFile(aKey);
    if (!file.exists()) return C.UNDEFINED;
    const contents = FileUtils.fileToString(file);
    return JSON.parse(contents);
  },
  set(aKey: string, aValue: any) {
    assertValidKey(aKey);
    const file = getFile(aKey);
    const newContents = JSON.stringify(aValue);
    FileUtils.stringToFile(newContents, file);
  },
};
