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

"use strict";

interface EvListener<T extends Function> {
    addListener: (callback: T) => void;
    removeListener: (listener: T) => void;
    hasListener: (listener: T) => boolean;
}
type Listener<T> = EvListener<(arg: T) => void>;
interface WebextOnEventOwner {
  [onEvent: string]: Listener<any>;
}

type WebextOnEventListeners = Set<Function>;
interface WebextOnEventListenersOwner {
  [onEvent: string]: WebextOnEventListeners;
}

function _createWebextOnEventApi(
    aApiObj: WebextOnEventOwner,
    aOnEvent: string
): WebextOnEventListeners {
  if (aApiObj.hasOwnProperty(aOnEvent)) {
    throw `Event "${aOnEvent} is already defined.`
  }
  let listeners: WebextOnEventListeners = new Set();
  aApiObj[aOnEvent] = {
    addListener: function(listener: Function) {
      listeners.add(listener);
    },
    removeListener: function(listener: Function) {
      listeners.delete(listener);
    },
    hasListener: function(listener: Function) {
      return listeners.has(listener);
    }
  };
  return listeners;
}

export function createWebextOnEventApi(
    aApiObj: WebextOnEventOwner,
    aOnEvents: string[]
): WebextOnEventListenersOwner {
  let listeners: WebextOnEventListenersOwner = {};
  aOnEvents.forEach(onEvent => {
    listeners[onEvent] = _createWebextOnEventApi(aApiObj, onEvent);
  });
  return listeners;
}
