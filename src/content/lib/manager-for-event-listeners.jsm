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

/* global Components */
const {utils: Cu} = Components;

/* exported ManagerForEventListeners */
this.EXPORTED_SYMBOLS = ["ManagerForEventListeners"];

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {Environment} = importModule("lib/environment");
let {Logger} = importModule("lib/logger");

//==============================================================================
// ManagerForEventListeners
//==============================================================================

/**
 * This class provides an interface to multiple "Event Targets" which takes
 * care of adding/removing event listeners at startup/shutdown.
 * Every instance of this class is bound to an environment.
 */
function ManagerForEventListeners(aEnv) {
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
  if (!!aEnv) {
    self.environment.addStartupFunction(
        Environment.LEVELS.INTERFACE,
        function() {
          // @ifdef LOG_EVENT_LISTENERS
          Logger.dump("From now on new event listeners will be " +
                      "added immediately. Environment: \"" +
                      self.environment.name + "\"");
          // @endif
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
    if (!!Logger) {
      Logger.warning(Logger.TYPE_INTERNAL, "No Environment was specified for " +
                     "a new ManagerForEventListeners! This means that the " +
                     "listeners won't be removed!");
    }
  }
}

function addEvLis(listener) {
  listener.target.addEventListener(listener.eventType, listener.callback,
                                   listener.useCapture);
  listener.listening = true;
}

ManagerForEventListeners.prototype.addListener = function(aEventTarget,
                                                          aEventType,
                                                          aCallback,
                                                          aUseCapture) {
  let self = this;
  if (typeof aCallback !== "function") {
    Logger.warning(Logger.TYPE_ERROR, "The callback for an event listener" +
                   "must be a function! Event type was \"" + aEventType + "\"");
    return;
  }
  let listener = {
    target: aEventTarget,
    eventType: aEventType,
    callback: aCallback,
    useCapture: !!aUseCapture,
    listening: false
  };
  if (self.addNewListenersImmediately) {
    // @ifdef LOG_EVENT_LISTENERS
    Logger.dump("Immediately adding event listener for \"" +
                listener.eventType + "\". Environment: \"" +
                self.environment.name + "\"");
    // @endif
    addEvLis(listener);
  }
  self.listeners.push(listener);
};

/**
 * The function will add all listeners already in the list.
 */
ManagerForEventListeners.prototype.addAllListeners = function() {
  let self = this;
  for (let listener of self.listeners) {
    if (listener.listening === false) {
      // @ifdef LOG_EVENT_LISTENERS
      Logger.dump("Lazily adding event listener for \"" +
                  listener.eventType + "\". Environment: \"" +
                  self.environment.name + "\"");
      // @endif
      addEvLis(listener);
    }
  }
};

/**
 * The function will remove all listeners.
 */
ManagerForEventListeners.prototype.removeAllListeners = function() {
  let self = this;
  while (self.listeners.length > 0) {
    let listener = self.listeners.pop();
    // @ifdef LOG_EVENT_LISTENERS
    Logger.dump("Removing event listener for \"" + listener.eventType +
                "\". Environment: \"" + self.environment.name + "\"");
    // @endif
    listener.target.removeEventListener(listener.eventType, listener.callback,
                                        listener.useCapture);
  }
};
