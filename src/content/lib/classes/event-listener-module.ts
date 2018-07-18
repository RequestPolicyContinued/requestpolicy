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

import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

type EventListenerCallback = () => void;

interface IEventListener {
  callback: EventListenerCallback;
  eventType: string;
  listening: boolean;
  target: EventTarget;
  useCapture: boolean;
}

export class EventListenerModule extends Module {
  /**
   * an object holding all listeners for removing them when unloading the page
   */
  private listeners: IEventListener[] = [];

  /**
   * This variable tells if the listener handed over to `addListener` should
   * be added immediately or not. It is set to true when the startup function
   * is called.
   */
  private addNewListenersImmediately = false;

  constructor(
      parentModuleName: string,
      parentLog: Common.ILog,
  ) {
    super(`${parentModuleName}.eventListener`, parentLog);
  }

  public addListener(
      aEventTarget: EventTarget,
      aEventType: string,
      aCallback: EventListenerCallback,
      aUseCapture: boolean,
  ) {
    const listener = {
      callback: aCallback,
      eventType: aEventType,
      listening: false,
      target: aEventTarget,
      useCapture: !!aUseCapture,
    };
    if (this.addNewListenersImmediately) {
      this.log.log(
          `Immediately adding event listener for "${listener.eventType}".`,
      );
      this.addEvLis(listener);
    }
    this.listeners.push(listener);
  }

  protected startupSelf() {
    this.log.log(
        `From now on new event listeners will be added immediately.`,
    );
    this.addNewListenersImmediately = true;
    this.addAllListeners();
    return Promise.resolve();
  }

  protected shutdownSelf() {
    this.removeAllListeners();
    return Promise.resolve();
  }

  /**
   * Add all listeners already in the list.
   */
  private addAllListeners() {
    for (const listener of this.listeners) {
      if (listener.listening === false) {
        this.log.log(
            `Lazily adding event listener for "${listener.eventType}".`,
        );
        this.addEvLis(listener);
      }
    }
  }

  private removeAllListeners() {
    while (this.listeners.length > 0) {
      const listener = this.listeners.pop()!;
      this.log.log(
          `Removing event listener for "${listener.eventType}".`,
      );
      listener.target.removeEventListener(
          listener.eventType,
          listener.callback,
          listener.useCapture,
      );
    }
  }

  private addEvLis(listener: IEventListener) {
    listener.target.addEventListener(
        listener.eventType, listener.callback, listener.useCapture,
    );
    listener.listening = true;
  }
}
