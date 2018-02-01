/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2018 Martin Kimmerle
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

export class CIMap<V> {
  private static mapKey(key: string): string {
    return (key as string).toLowerCase();
  }

  private map = new Map<string, V>();

  public get(key: string) {
    return this.map.get(CIMap.mapKey(key));
  }

  public set(key: string, value: V) {
    return this.map.set(CIMap.mapKey(key), value);
  }

  public delete(key: string) {
    return this.map.delete(CIMap.mapKey(key));
  }

  public has(key: string) {
    return this.map.has(CIMap.mapKey(key));
  }

  public get size() {
    return this.map.size;
  }
}
