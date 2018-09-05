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

import { App } from "app/interfaces";
import { XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import {C} from "data/constants";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

type MessageListener = XPCOM.nsIMessageListener["receiveMessage"];

interface IMessageListenerWrapper {
  callback: MessageListener;
  listening: boolean;
  messageID: string;
  messageName: string;
}

export class MessageListenerModule<
    T extends XPCOM.nsIMessageListenerManager
> extends Module implements App.common.IMessageListenerModule<T> {
  private listeners: IMessageListenerWrapper[] = [];
  private addNewListenersImmediately = false;

  constructor(
      parentModuleName: string,
      parentLog: Common.ILog,
      private readonly mm: T,
  ) {
    super(`${parentModuleName}.msgListener`, parentLog);
  }

  public addListener(
      aMessageName: string,
      aCallback: MessageListener,
      aCallbackOnShutdown?: MessageListener,
      aAddImmediately: boolean = false,  // add without waiting for the startup
  ) {
    if (aMessageName.indexOf(C.MM_PREFIX) === 0) {
      this.log.warn("The message name that has been passed to " +
                    "`addListener()` contains the MM Prefix. " +
                    "Extracting the message name.");
      aMessageName = aMessageName.substr(C.MM_PREFIX.length);
    }

    const listener: IMessageListenerWrapper = {
      callback: (aMessage) => {
        if (this.stillRunning === false) {
          console.log(
              `[RequestPolicy] Listener for ${aMessageName} ` +
              `has been called, but RP is already shutting down.`,
          );
          if (typeof aCallbackOnShutdown === "function") {
            return aCallbackOnShutdown(aMessage);
          }
          return;
        }
        return aCallback(aMessage);
      },
      listening: false,
      messageID: C.MM_PREFIX + aMessageName,
      messageName: aMessageName,
    };
    if (aAddImmediately === true || this.addNewListenersImmediately) {
      this.log.log(
          `Immediately adding message listener for "${listener.messageName}".`,
      );
      this.mm.addMessageListener(listener.messageID, listener.callback);
      listener.listening = true;
    }
    this.listeners.push(listener);
  }

  /**
   * Add all listeners already in the list.
   */
  public addAllListeners() {
    for (const listener of this.listeners) {
      if (listener.listening === false) {
        this.log.log(
            `Lazily adding message listener for "${listener.messageName}".`,
        );
        this.mm.addMessageListener(listener.messageID, listener.callback);
        listener.listening = true;
      }
    }
  }

  public removeAllListeners() {
    while (this.listeners.length > 0) {
      const listener = this.listeners.pop()!;
      this.log.log(
          `Removing message listener for "${listener.messageName}".`,
      );
      this.mm.removeMessageListener(listener.messageID, listener.callback);
    }
  }

  protected startupSelf() {
    this.log.log(
        `From now on new message listeners will be added immediately.`,
    );
    this.addNewListenersImmediately = true;
    this.addAllListeners();
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf(): void {
    this.removeAllListeners();
  }
}
