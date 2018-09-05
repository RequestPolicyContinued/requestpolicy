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

import { OverridableSet } from "lib/classes/set";

export type Listener<Trv = void, Targ = any> =
    (...arg: Targ[]) => Trv | Promise<Trv>;

export interface IListenInterface<Trv = void, Targ = any> {
  addListener: (listener: Listener<Trv, Targ>) => void;
  removeListener: (listener: Listener<Trv, Targ>) => void;
  hasListener: (listener: Listener<Trv, Targ>) => boolean;
}

export class Listeners<Trv = void, Targ = any>
    extends OverridableSet<Listener<Trv, Targ>> {
  public readonly interface: IListenInterface<Trv> = {
    addListener: this.add.bind(this),
    hasListener: this.has.bind(this),
    removeListener: this.delete.bind(this),
  };

  public add(listener: Listener<Trv>) {
    if (typeof listener !== "function") {
      throw new Error(`'${listener}' is not a function!`);
    }
    return super.add(listener);
  }

  public emit(...args: Targ[]): Trv[] | Promise<Trv[]> {
    const returnValues: Array<Trv | Promise<Trv>> = [];
    let withPromises = false;
    for (const listener of this.values()) {
      let rv: Trv | Promise<Trv>;
      try {
        rv = listener(...args);
      } catch (e) {
        rv = Promise.reject(e);
      }
      if (rv && typeof (rv as Promise<Trv>).then === "function") {
        withPromises = true;
        (rv as Promise<Trv>).catch((e) => console.dir(e));
      }
      if (rv !== undefined) {
        returnValues.push(rv);
      }
    }
    if (!withPromises) return returnValues as Trv[];
    return Promise.all(returnValues.map(
        (rv) => typeof (rv as any).then === "function" ?
            rv as Promise<Trv> :
            Promise.resolve(rv)));
  }
}
