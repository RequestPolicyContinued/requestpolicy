/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["Environment"];

let globalScope = this;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(globalScope, "ScriptLoader",
    "chrome://requestpolicy/content/lib/script-loader.jsm");
XPCOMUtils.defineLazyGetter(globalScope, "ObserverManager", function() {
  return ScriptLoader.importModule("lib/observer-manager").ObserverManager;
});



/**
 * The `Environment` class can take care of the "startup" (=initialization) and
 * "shutdown" of any environment.
 *
 * Example implementations for this class are:
 *   - "process" environments -- created e.g. by bootstrap.js
 *   - "window" environments -- used in frame scripts and on pref web pages
 *
 * The Environment contains
 *   - one *queue* for startup functions
 *   - one *stack* for shutdown functions
 * Those functions will be called when startup() and shutdown(), respectively,
 * are called.
 *
 * ### Implementation of the Queue and the Stack:
 * The Queue is implemented in a FIFO [3] sense, the Stack in a LIFO [4] sense.
 *   => for the queue, Array.push() and Array.shift() are used.
 *   => for the stack, Array.push() and Array.pop() are used.
 *
 * ### Reason for queue <--> stack distinction:
 * The most important files will add their startup & shutdown functions
 * before the less important functions will do.
 *   => Startup: the important functions should be called first
 *   => Shutdown: the important functions should be called last
 *
 * ### more information on FIFO/LIFO and Queues/Stacks:
 *   [1] https://en.wikipedia.org/wiki/Queue_%28abstract_data_type%29
 *   [2] https://en.wikipedia.org/wiki/Stack_%28abstract_data_type%29
 *   [3] https://en.wikipedia.org/wiki/FIFO
 *   [4] https://en.wikipedia.org/wiki/LIFO_%28computing%29
 */
function Environment() {
  let self = this;

  self.state = Environment.STATE_SHUT_DOWN;

  // The function queues
  self.startupFnQueue = [];
  self.shutdownFnStack = [];

  // Define a Lazy Getter to get an ObserverManager for this Environment.
  // Using that Getter is more convenient than doing it manually, as the
  // Environment has to be created *before* the ObserverManager.
  XPCOMUtils.defineLazyGetter(self, "obMan", function() {
    return new ObserverManager(self);
  });
}

Environment.STATE_SHUT_DOWN = 0;
Environment.STATE_STARTING_UP = 1;
Environment.STATE_STARTUP_DONE = 2;
Environment.STATE_SHUTTING_DOWN = 3;


/**
 * This set of functions can be used for adding startup/shutdown functions.
 */
Environment.prototype.enqueueStartupFunction = function(f) {
  let self = this;
  switch (self.state) {
    case Environment.STATE_SHUTTING_DOWN:
      // When the shutdown is currently in progress we simply ignore the
      // startup() function, as it makes no sense.
      break;

    case Environment.STATE_STARTUP_DONE:
      // If the environment already finished starting up, the function is added
      // to the stack and the stack is processed immediately.
      // Note: Calling `callFunctions` is on purpose, as the function `f` might
      //       add more startup functions as well!
      self.startupFnQueue.push(f);
      callFunctions(self.startupFnQueue, arguments);
      break;

    default:
      // In any other case, add the function to the stack.
      self.startupFnQueue.push(f);
      break;
  }
};
Environment.prototype.pushShutdownFunction = function(f) {
  let self = this;
  self.shutdownFnStack.push(f);
};


/**
 * This function calls all functions of a function queue.
 */
function callFunctions(fnArray, sequence, fnArgsToApply) {
  // `sequence` decides whether LIFO or FIFO is used
  let popOrShift = sequence === "lifo" ? "pop" : "shift";

  // process the Array as long as it contains elements
  while (fnArray.length > 0) {
    // The following is either `fnArray.pop()` or `fnArray.shift()`
    // depending on `sequence`.
    let f = fnArray[popOrShift]();

    // call the function
    f.apply(this, fnArgsToApply);
  }
};


Environment.prototype.startup = function() {
  let self = this;
  self.state = Environment.STATE_STARTING_UP;
  callFunctions(self.startupFnQueue, arguments);
  self.state = Environment.STATE_STARTUP_DONE;
};

Environment.prototype.shutdown = function() {
  let self = this;
  self.state = Environment.STATE_SHUTTING_DOWN;
  callFunctions(self.shutdownFnStack, arguments);
  self.state = Environment.STATE_SHUT_DOWN;
};


Environment.prototype.shutdownOnWindowUnload = function(aWindow) {
  let self = this;
  aWindow.addEventListener("unload", function() {
    self.shutdown();
  });
};
