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

import { OverridableSet } from "lib/classes/set";

export class MapOfCustomSets<K, V, S extends Set<V> | OverridableSet<V>> {
  private map: Map<K, S>;
  private getNewSet: () => S;

  constructor(aSetFactory: () => S) {
    this.map = new Map();
    this.getNewSet = aSetFactory;
  }

  public has(aMapKey: K): boolean {
    return this.map.has(aMapKey);
  }

  public get(aMapKey: K) {
    return this.map.get(aMapKey);
  }

  public keys() {
    return this.map.keys();
  }

  public hasInSet(aMapKey: K, aValue: V): boolean {
    const set = this.map.get(aMapKey);
    if (!set) return false;
    return set.has(aValue);
  }

  public addToSet(aMapKey: K, aValue: V) {
    let set: S;
    if (!this.map.has(aMapKey)) {
      // automatically add a Set object to the Map
      set = this.getNewSet();
      this.map.set(aMapKey, set);
    } else {
      set = this.map.get(aMapKey) as S;
    }
    set.add(aValue);
  }

  public deleteFromSet(aMapKey: K, aValue: V) {
    const set = this.map.get(aMapKey);
    if (set === undefined) {
      return;
    }
    set.delete(aValue);
    if (set.size === 0) {
      // automatically remove the Set from the Map
      this.map.delete(aMapKey);
    }
  }

  public mapEntries() {
    return this.map.entries();
  }

  public forEachSet(
      aCallback: (set: Set<V>, key: K) => void,
  ) {
    this.map.forEach(aCallback);
  }

  public forEach(
      aCallback: (value: V, key: K) => void,
  ) {
    this.map.forEach((set, mapKey) => {
      set.forEach((setValue) => {
        aCallback(setValue, mapKey);
      });
    });
  }
}
