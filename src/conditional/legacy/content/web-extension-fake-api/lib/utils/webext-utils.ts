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

type Callback = (...args: any[]) => void;
interface IEvListener {
  addListener: (callback: Callback) => void;
  removeListener: (listener: Callback) => void;
  hasListener: (listener: Callback) => boolean;
}
type Listener = IEvListener;
interface IWebextOnEventOwner {
  [onEvent: string]: Listener;
}

type WebextOnEventListeners = Set<() => void>;
interface IWebextOnEventListenersOwner {
  [onEvent: string]: WebextOnEventListeners;
}

function _createWebextOnEventApi(
    aApiObj: IWebextOnEventOwner,
    aOnEvent: string,
): WebextOnEventListeners {
  if (aApiObj.hasOwnProperty(aOnEvent)) {
    throw new Error(`Event "${aOnEvent} is already defined.`);
  }
  const listeners: WebextOnEventListeners = new Set();
  aApiObj[aOnEvent] = {
    addListener(listener: Callback) {
      listeners.add(listener);
    },
    removeListener(listener: Callback) {
      listeners.delete(listener);
    },
    hasListener(listener: Callback) {
      return listeners.has(listener);
    },
  };
  return listeners;
}

export function createWebextOnEventApi(
    aApiObj: IWebextOnEventOwner,
    aOnEvents: string[],
): IWebextOnEventListenersOwner {
  const listeners: IWebextOnEventListenersOwner = {};
  aOnEvents.forEach((onEvent) => {
    listeners[onEvent] = _createWebextOnEventApi(aApiObj, onEvent);
  });
  return listeners;
}
