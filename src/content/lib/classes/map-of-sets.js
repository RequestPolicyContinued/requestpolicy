/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2015 Martin Kimmerle
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

"use strict";

//==============================================================================
// MapOfSets
//==============================================================================

export function MapOfSets() {
  this._map = new Map();
}

MapOfSets.prototype.has = function(aMapKey) {
  return this._map.has(aMapKey);
};

MapOfSets.prototype.get = function(aMapKey) {
  return this._map.get(aMapKey);
};

MapOfSets.prototype.keys = function() {
  return this._map.keys();
};

MapOfSets.prototype.addToSet = function(aMapKey, aValue) {
  if (!this._map.has(aMapKey)) {
    // automatically add a Set object to the Map
    this._map.set(aMapKey, new Set());
  }
  this._map.get(aMapKey).add(aValue);
};

MapOfSets.prototype.deleteFromSet = function(aMapKey, aValue) {
  if (!this._map.has(aMapKey)) {
    return;
  }
  let set = this._map.get(aMapKey);
  set.delete(aValue);
  if (set.size === 0) {
    // automatically remove the Set from the Map
    this._map.delete(aMapKey);
  }
};
