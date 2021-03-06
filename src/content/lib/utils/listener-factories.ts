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

import {
  IListenInterface,
  Listener,
  Listeners,
} from "lib/classes/listeners";
import {MapOfCustomSets} from "lib/classes/map-of-custom-sets";

interface IObject<T> {
  [key: string]: T;
}

export function createListenersMap<Trv = void, Targ = any>(
    aEventNames: ReadonlyArray<string>,
    {
        assignInterfacesTo: interfaces = {},
        assignListenersTo: listenersMap = {},
    }: {
        assignInterfacesTo?: IObject<IListenInterface<Trv, Targ>>,
        assignListenersTo?: IObject<Listeners<Trv, Targ>>,
    } = {
        assignInterfacesTo: {},
        assignListenersTo: {},
    },
) {
  const eventNames =
      Array.isArray(aEventNames) ? aEventNames : [aEventNames];
  eventNames.forEach((eventName) => {
    const eventListeners = new Listeners<Trv, Targ>();
    listenersMap[eventName] = eventListeners;
    interfaces[eventName] = eventListeners.interface;
  });

  return {listenersMap, interfaces};
}

export function createMapOfListeners() {
  return new MapOfCustomSets<string, Listener, Listeners>(
      () => new Listeners());
}
