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

let EXPORTED_SYMBOLS = ["FramescriptToOverlayCommunication"];

let globalScope = this;

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/environment",
  "lib/logger",
  "lib/utils/constants"
], globalScope);


/**
 * The states of the communication channel to with the overlay.
 * @enum {number}
 */
let States = Object.freeze({
  "WAITING": 0,
  "RUNNING": 1,
  "STOPPED": 2
});


/**
 * Sometimes the framescript loads and starts up faster than the
 * Overlay of the corresponding window. This is due to the async
 * nature of framescripts. As a result, the overlay does not
 * receive those early messages from the framescript.
 *
 * This class helps to ensure that any message to the overlay is
 * actually being received. Instances take functions ("runnables")
 * that will be called as soon as the overlay is ready. If the
 * overlay is already in the "RUNNING" state, the function will be
 * called immediately.
 *
 * @param {Environment} aEnv - The environment to which the
 *     communication channel's lifetime will be bound to.
 * @constructor
 */
function FramescriptToOverlayCommunication(aEnv) {
  let self = this;

  /**
   * A queue of runnables that wait for the overlay to be ready.
   * As it's a queue, the functions `pop` and `shift` have to be
   * used.
   * @type  {Array.<function>}
   */
  self.waitingRunnables = [];

  /**
   * The state of the communication
   * @type {States}
   */
  self.state = States.WAITING;

  /**
   * @type {Environment}
   */
  self.env = aEnv;

  self.env.addStartupFunction(Environment.LEVELS.INTERFACE,
                              startCommNowOrLater.bind(null, self));
  self.env.addShutdownFunction(Environment.LEVELS.INTERFACE,
                               stopCommunication.bind(null, self));
}

function dump(self, msg) {
  Logger.dump(self.env.uid + ": " + msg);
}

/**
 * Check whether the Overlay is ready. If it is, start the
 * communication. If not, wait for the overlay to be ready.
 *
 * @param {FramescriptToOverlayCommunication} self
 */
function startCommNowOrLater(self) {
  let answers = self.env.mm.sendSyncMessage(C.MM_PREFIX + "isOverlayReady");
  if (answers.length > 0 && answers[0] === true) {
    startCommunication(self);
  } else {
    // The Overlay is not ready yet, so listen for the message.
    // Add the listener immediately.
    self.env.mlManager.addListener("overlayIsReady",
                                   startCommunication.bind(null, self),
                                   true);
  }
}

/**
 * The overlay is ready.
 *
 * @param {FramescriptToOverlayCommunication} self
 */
function startCommunication(self) {
  if (self.state === States.WAITING) {
    //dump(self, "The Overlay is ready!");
    self.state = States.RUNNING;

    while (self.waitingRunnables.length !== 0) {
      let runnable = self.waitingRunnables.shift();
      //dump(self, "Lazily running function.");
      runnable.call(null);
    }
  }
}

/**
 * @param {FramescriptToOverlayCommunication} self
 */
function stopCommunication(self) {
  self.state = States.STOPPED;
}

/**
 * Add a function that will be called now or later.
 *
 * @param {function} aRunnable
 */
FramescriptToOverlayCommunication.prototype.run = function(aRunnable) {
  let self = this;
  switch (self.state) {
    case States.RUNNING:
      //dump(self, "Immediately running function.");
      aRunnable.call(null);
      break;

    case States.WAITING:
      //dump(self, "Remembering runnable.");
      self.waitingRunnables.push(aRunnable);
      break;

    default:
      //dump(self, "Ignoring runnable.");
      break;
  }
};
