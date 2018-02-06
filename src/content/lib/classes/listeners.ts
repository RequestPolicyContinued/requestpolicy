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

import { OverridableSet } from "content/lib/classes/set";

export type Listener = (...args: any[]) => void;

export interface IListenInterface {
  addListener: (listener: Listener) => void;
  removeListener: (listener: Listener) => void;
  hasListener: (listener: Listener) => boolean;
}

export class Listeners extends OverridableSet<Listener> {
  public readonly interface: IListenInterface = {
    addListener: this.add.bind(this),
    hasListener: this.has.bind(this),
    removeListener: this.delete.bind(this),
  };

  public emit(...args: any[]) {
    const returnValues = [];
    let withPromises = false;
    // tslint:disable-next-line prefer-const
    for (let listener of this.values()) {
      const rv: any = listener(...args);
      if (rv && typeof rv.then === "function") {
        withPromises = true;
      }
      if (rv !== undefined) {
        returnValues.push(rv);
      }
    }
    if (!withPromises) return returnValues;
    return Promise.all(returnValues.map(
        (rv) => typeof rv.then === "function" ? rv : Promise.resolve(rv)));
  }
}
