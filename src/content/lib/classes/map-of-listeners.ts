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

import {Listener, Listeners} from "lib/classes/listeners";
import {MapOfCustomSets} from "lib/classes/map-of-custom-sets";

export class MapOfListeners<K = string>
    extends MapOfCustomSets<K, Listener, Listeners> {
  public readonly interface: {
    addListener: (k: K, listener: Listener) => void,
    hasListener: (k: K, listener: Listener) => boolean,
    removeListener: (k: K, listener: Listener) => void,
  } = {
    addListener: this.addToSet.bind(this),
    hasListener: this.hasInSet.bind(this),
    removeListener: this.deleteFromSet.bind(this),
  };

  constructor() {
    super(() => new Listeners());
  }

  public addListener(k: K, l: Listener) {
    this.addToSet(k, l);
  }

  public emit(aKey: K, ...args: any[]) {
    const listeners = this.get(aKey);
    if (!listeners) return;
    listeners.emit(...args);
  }
}
