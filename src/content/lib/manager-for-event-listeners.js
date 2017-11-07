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

import {Level as EnvLevel} from "content/lib/environment";
import {Log as log} from "content/models/log";
import {C} from "content/data/constants";

const {LOG_EVENT_LISTENERS} = C;

function addEvLis(listener) {
  listener.target.addEventListener(
      listener.eventType, listener.callback, listener.useCapture);
  listener.listening = true;
}

// =============================================================================
// ManagerForEventListeners
// =============================================================================

/**
 * This class provides an interface to multiple "Event Targets" which takes
 * care of adding/removing event listeners at startup/shutdown.
 * Every instance of this class is bound to an environment.
 *
 * @param {Environment} aEnv
 */
export class ManagerForEventListeners {
  constructor(aEnv) {
    /**
     * an object holding all listeners for removing them when unloading the page
     */
    this.listeners = [];

    /**
     * This variable tells if the listener handed over to `addListener` should
     * be added immediately or not. It is set to true when the startup function
     * is called.
     */
    this.addNewListenersImmediately = false;

    this.environment = aEnv;

    // Note: the startup functions have to be defined *last*, as they might get
    //       called immediately.
    if (aEnv) {
      this.environment.addStartupFunction(
          EnvLevel.INTERFACE,
          () => {
            if (LOG_EVENT_LISTENERS) {
              log.log("From now on new event listeners will be " +
                  "added immediately. Environment: \"" +
                  this.environment.name + "\"");
            }
            this.addNewListenersImmediately = true;
            this.addAllListeners();
          });
      this.environment.addShutdownFunction(
          EnvLevel.INTERFACE,
          () => {
            // clean up when the environment shuts down
            this.removeAllListeners();
          });
    } else {
      // aEnv is not defined! Try to report an error.
      if (log) {
        console.error(
            "No Environment was specified for a new " +
            "ManagerForEventListeners! " +
            "This means that the listeners won't be removed!");
      }
    }
  }

  addListener(aEventTarget, aEventType, aCallback, aUseCapture) {
    let self = this;
    if (typeof aCallback !== "function") {
      console.error("The callback for an event listener" +
          `must be a function! Event type was "${aEventType}"`);
      return;
    }
    let listener = {
      target: aEventTarget,
      eventType: aEventType,
      callback: aCallback,
      useCapture: !!aUseCapture,
      listening: false,
    };
    if (self.addNewListenersImmediately) {
      if (LOG_EVENT_LISTENERS) {
        log.log("Immediately adding event listener for \"" +
            listener.eventType + "\". Environment: \"" +
            self.environment.name + "\"");
      }
      addEvLis(listener);
    }
    self.listeners.push(listener);
  }

  /**
   * The function will add all listeners already in the list.
   */
  addAllListeners() {
    let self = this;
    for (let listener of self.listeners) {
      if (listener.listening === false) {
        if (LOG_EVENT_LISTENERS) {
          log.log("Lazily adding event listener for \"" +
              listener.eventType + "\". Environment: \"" +
              self.environment.name + "\"");
        }
        addEvLis(listener);
      }
    }
  }

  /**
   * The function will remove all listeners.
   */
  removeAllListeners() {
    let self = this;
    while (self.listeners.length > 0) {
      let listener = self.listeners.pop();
      if (LOG_EVENT_LISTENERS) {
        log.log("Removing event listener for \"" + listener.eventType +
            "\". Environment: \"" + self.environment.name + "\"");
      }
      listener.target.removeEventListener(listener.eventType, listener.callback,
                                          listener.useCapture);
    }
  }
}
