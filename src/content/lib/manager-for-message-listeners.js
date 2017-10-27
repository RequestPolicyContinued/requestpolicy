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

import {Environment} from "content/lib/environment";
import {Log} from "content/models/log";
import {C} from "content/data/constants";

const {LOG_MESSAGE_LISTENERS} = C;

// =============================================================================
// ManagerForMessageListeners
// =============================================================================

/**
 * This class provides an interface to a "Message Manager" which takes
 * care of adding/removing message listeners at startup/shutdown.
 * Every instance of this class is bound to an environment and a MessageManager.
 *
 * @param {Environment} aEnv
 * @param {nsIMessageListenerManager} aMM
 */
export function ManagerForMessageListeners(aEnv, aMM) {
  let self = this;

  /**
   * an object holding all listeners for removing them when unloading the page
   */
  self.listeners = [];

  /**
   * This variable tells if the listener handed over to `addListener` should
   * be added immediately or not. It is set to true when the startup function
   * is called.
   */
  self.addNewListenersImmediately = false;

  self.environment = aEnv;

  // Note: the startup functions have to be defined *last*, as they might get
  //       called immediately.
  if (aEnv) {
    self.environment.addStartupFunction(
        Environment.LEVELS.INTERFACE,
        function() {
          if (LOG_MESSAGE_LISTENERS) {
            Log.log(
                "From now on new message listeners will be added " +
                "immediately. Environment: \"" + self.environment.name + "\"");
          }
          self.addNewListenersImmediately = true;
          self.addAllListeners();
        });
    self.environment.addShutdownFunction(
        Environment.LEVELS.INTERFACE,
        function() {
          // clean up when the environment shuts down
          self.removeAllListeners();
        });
  } else {
    // aEnv is not defined! Try to report an error.
    if (Log) {
      console.error(
          "No Environment was specified for a new " +
          "ManagerForMessageListeners! This means that the listeners " +
          "won't be unregistered!");
    }
  }

  self.mm = aMM;

  if (!self.mm) {
    if (Log) {
      Log.warn("No Message Manager was specified " +
                     "for a new ManagerForMessageListeners!");
    }
  }
}

/**
 * Add a listener. The class will then take care about adding
 * and removing that message listener.
 *
 * @param {string} aMessageName
 * @param {function} aCallback
 * @param {boolean} aCallbackOnShutdown
 * @param {boolean} aAddImmediately - Whether the listener should be
 *     added immediately, i.e. without waiting for the environment
 *     to start up.
 */
ManagerForMessageListeners.prototype.addListener = function(aMessageName,
                                                            aCallback,
                                                            aCallbackOnShutdown,
                                                            aAddImmediately) {
  let self = this;
  if (typeof aCallback !== "function") {
    console.error("The callback for a message listener" +
        "must be a function! The message name was \"" + aMessageName + "\"");
    return;
  }
  if (aMessageName.indexOf(C.MM_PREFIX) === 0) {
    Log.warn("The message name that has been passed to " +
                   "`addListener()` contains the MM Prefix. " +
                   "Extracting the message name.");
    aMessageName = aMessageName.substr(C.MM_PREFIX.length);
  }

  let listener = {
    messageName: aMessageName,
    messageID: C.MM_PREFIX + aMessageName,
    callback: function(aMessage) {
      if (self.environment.envState === Environment.ENV_STATES.SHUTTING_DOWN) {
        // eslint-disable-next-line no-console
        console.log("[RequestPolicy] Listener for " + aMessageName +
            " has been called, but RP is already shutting down.");
        if (typeof aCallbackOnShutdown === "function") {
          return aCallbackOnShutdown(aMessage);
        }
        return;
      }
      return aCallback(aMessage);
    },
    listening: false,
  };
  if (aAddImmediately === true || self.addNewListenersImmediately) {
    if (LOG_MESSAGE_LISTENERS) {
      Log.log(
          "Immediately adding message listener for \"" +
          listener.messageName + "\". Environment: \"" +
          self.environment.name + "\"");
    }
    self.mm.addMessageListener(listener.messageID, listener.callback);
    listener.listening = true;
  }
  self.listeners.push(listener);
};

/**
 * The function will add all listeners already in the list.
 */
ManagerForMessageListeners.prototype.addAllListeners = function() {
  let self = this;
  for (let listener of self.listeners) {
    if (listener.listening === false) {
      if (LOG_MESSAGE_LISTENERS) {
        Log.log(
            "Lazily adding message listener for \"" +
            listener.messageName + "\". Environment: \"" +
            self.environment.name + "\"");
      }
      self.mm.addMessageListener(listener.messageID, listener.callback);
      listener.listening = true;
    }
  }
};

/**
 * The function will remove all listeners.
 */
ManagerForMessageListeners.prototype.removeAllListeners = function() {
  let self = this;
  while (self.listeners.length > 0) {
    let listener = self.listeners.pop();
    // if (typeof listener.callback == 'undefined') {
    //   console.error("Can't remove message listener '" +
    //                  'for "' + listener.messageName + '", the callback ' +
    //                  'is undefined!');
    //   continue;
    // }
    if (LOG_MESSAGE_LISTENERS) {
      Log.log(
          "Removing message listener for \"" + listener.messageName + "\".");
    }
    // try {
    self.mm.removeMessageListener(listener.messageID, listener.callback);
    // } catch (e) {
    //   console.error('Failed to remove message listener ' +
    //                  'for "' + listener.messageName + '". ' +
    //                  'Env "' + self.environment.uid + '" (' +
    //                  self.environment.name + '). Error was: ' + e, e);
    // }
  }
};
