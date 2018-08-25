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

// tslint:disable-next-line:max-line-length
type IStorageChange = browser.storage.ChangeDict;  // badword-linter:allow:browser.storage:

export function getInfosOfStorageChange(aStorageChanges: IStorageChange) {
  const keysToRemove: string[] = [];
  let hasKeysToSet = false;
  const keysToSet: {[key: string]: any} = {};
  for (const key of Object.keys(aStorageChanges)) {
    const change = aStorageChanges[key];
    if ("newValue" in change) {
      keysToSet[key] = change.newValue;
      hasKeysToSet = true;
    } else {
      keysToRemove.push(key);
    }
  }
  const hasKeysToRemove = keysToRemove.length !== 0;
  return {hasKeysToRemove, hasKeysToSet, keysToRemove, keysToSet};
}
