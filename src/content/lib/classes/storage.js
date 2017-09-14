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

//==============================================================================
// Storage
//==============================================================================

export function Storage({cachedKeys, boolAliases}) {
  this._cachedKeys = Object.freeze(cachedKeys);
  this._cachedKeysSet = Object.freeze(new Set(cachedKeys));

  boolAliases.forEach(([storageKey, alias]) => {
    this[`is${alias}`] = () => this.get(storageKey);
    this[`set${alias}`] = (value) => this.set({[storageKey]: value});
  });
}

Storage.prototype.isKeyCached = function(aKey) {
  return this._cachedKeysSet.has(aKey);
};

Storage.prototype.get = function(aKeys) {
  if (typeof aKeys === "string") {
    let key = aKeys;
    if (!this.isKeyCached(key)) {
      console.error(`Key "${key} is not cached in Storage!`);
      return;
    }
    return LegacyApi.prefs.get(key);
  }
  if (!Array.isArray(aKeys)) {
    return aKeys.reduce((rv, key) => {
      rv[key] = LegacyApi.prefs.get(key);
      return rv;
    }, {});
  }
  return this.get(this._cachedKeys);
};

Storage.prototype.set = function(aKeys) {
  try {
    Object.keys(aKeys).forEach(key => {
      LegacyApi.prefs.set(key, aKeys[key]);
    });
    LegacyApi.prefs.save();
    return Promise.resolve();
  } catch (error) {
    console.error("Error when saving to storage!");
    console.dir(aKeys);
    console.dir(error);
    return Promise.reject(error);
  }
};
