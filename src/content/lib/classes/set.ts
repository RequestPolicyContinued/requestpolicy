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

/**
 * Workaround class for TypeScript error
 *   Uncaught TypeError: Constructor Set requires 'new'
 * when targeting es5
 * see e.g. https://github.com/Microsoft/TypeScript/issues/10853
 */

export class OverridableSet<T> implements Set<T> {
  private set: Set<T>;

  constructor(...args: any[]) {
    this.set = new Set<T>(...args);
  }

  public get [Symbol.iterator]() { return this.set[Symbol.iterator]; }
  public get size() { return this.set.size; }

  public keys() { return this.set.keys(); }
  public values() { return this.set.values(); }
  public entries() { return this.set.entries(); }

  public has(arg: T) { return this.set.has(arg); }
  public add(arg: T) {
    this.set.add(arg);
    return this;
  }
  public delete(arg: T) { return this.set.delete(arg); }
  public clear() { return this.set.clear(); }

  public forEach(
      callbackfn: (value: T, value2: T, set: Set<T>) => void,
      thisArg?: any,
  ) {
    return this.set.forEach(callbackfn, thisArg);
  }
}
