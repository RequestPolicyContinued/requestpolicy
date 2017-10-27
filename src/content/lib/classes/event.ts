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

export type EventListener = (...args: any[]) => void;
export type EventListeners = Set<EventListener>;

export interface IEventTarget {
  addListener: (listener: EventListener) => void;
  removeListener: (listener: EventListener) => void;
  hasListener: (listener: EventListener) => boolean;
}
interface IObject<T> {
  [key: string]: T;
}

export class Event {
  public static createMultiple(aEventNames: string[], aOptions: {
    assignEventsTo: IObject<Event>,
    assignEventTargetsTo: IObject<IEventTarget>,
  } = {assignEventsTo: {}, assignEventTargetsTo: {}}) {
    const {
      assignEventsTo: events,
      assignEventTargetsTo: eventTargets,
    } = aOptions;

    const eventNames =
        Array.isArray(aEventNames) ? aEventNames : [aEventNames];
    eventNames.forEach((eventName) => {
      events[eventName] = new Event();
      eventTargets[eventName] = events[eventName].eventTarget;
    });

    return {events, eventTargets};
  }

  private listeners: EventListeners = new Set();

  public addListener(listener: EventListener) {
    this.listeners.add(listener);
  }
  public hasListener(listener: EventListener) {
    return this.listeners.has(listener);
  }
  public removeListener(listener: EventListener) {
    this.listeners.delete(listener);
  }

  public get eventTarget(): IEventTarget {
    return {
      addListener: this.addListener.bind(this),
      hasListener: this.hasListener.bind(this),
      removeListener: this.removeListener.bind(this),
    };
  }

  public emit(...args: any[]) {
    const returnValues = [];
    let withPromises = false;
    // tslint:disable-next-line prefer-const
    for (let listener of this.listeners.values()) {
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
