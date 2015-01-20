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

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
//Cu.import("resource://gre/modules/devtools/Console.jsm");
ScriptLoader.defineLazyModuleGetters({
  "lib/manager-for-event-listeners": ["ManagerForEventListeners"],
  "main/environment-manager": ["EnvironmentManager"],
  "lib/observer-manager": ["ObserverManager"]
}, globalScope);



let ENV_STATES = {
  "NOT_STARTED": 0,
  "STARTING_UP": 1,
  "STARTUP_DONE": 2,
  "SHUTTING_DOWN": 3,
  "SHUT_DOWN": 4
};

let LEVELS = {
  // Essential functions do tasks that must be run first on startup and last
  // on shutdown, that is they do tasks that are requirements for the Backend.
  "ESSENTIAL": 1,
  // Backend functions start up/shut down main parts of RequestPolicy, but
  // they do not enable RequestPolicy at all.
  "BACKEND": 2,
  // Interface functions enable/disable external as well as internal interfaces,
  // e.g. Event Listeners, Message Listeners, Observers, Factories.
  "INTERFACE": 3,
  // UI functions will enable/disable UI elements such as the menu.
  "UI": 4
};

// a level can be entered, being processed, or finished being processed.
let LEVEL_STATES = {
  "NOT_ENTERED": 0,
  "PROCESSING": 1,
  "FINISHED_PROCESSING": 2
};


/**
 * The `Environment` class can take care of the "startup" (=initialization) and
 * "shutdown" of any environment.
 *
 * To each `Environment` instance, `startup` and `shutdown` functions can be
 * added. As soon as the Environment's startup() function is called, all of
 * those functions will be called; same for shutdown().
 *
 * Both startup and shutdown functions will have Levels assigned. The levels
 * of the functions determine in which sequence they are called
 */
function Environment(aName) {
  let self = this;

  // the Environment's name is only needed for debugging
  self.name = aName || "anonymous";

  self.envState = ENV_STATES.NOT_STARTED;

  self.startupLevels = generateLevelObjects();
  self.shutdownLevels = generateLevelObjects();

  EnvironmentManager.registerEnvironment(self);

  // Define a Lazy Getter to get an ObserverManager for this Environment.
  // Using that Getter is more convenient than doing it manually, as the
  // Environment has to be created *before* the ObserverManager.
  XPCOMUtils.defineLazyGetter(self, "obMan", function() {
    return new ObserverManager(self);
  });

  // Define a Lazy Getter to get an instance of `ManagerForEventListeners` for
  // this Environment.
  XPCOMUtils.defineLazyGetter(self, "elManager", function() {
    return new ManagerForEventListeners(self);
  });

  // generate an unique ID for debugging purposes
  XPCOMUtils.defineLazyGetter(self, "uid", function() {
    return Math.random().toString(36).substr(2, 5);
  });

  //console.debug('[RPC] created new Environment "'+self.name+'"');
}

Environment.ENV_STATES = ENV_STATES;
Environment.LEVELS = LEVELS;


/**
 * This function creates one "Level Object" for each level. Those objects
 * mainly will hold the startup- or shutdown-functions of the corresponding
 * level. All of the Level Objects are put together in another object which
 * is then returned.
 */
function generateLevelObjects() {
  let obj = {};
  for (let levelName in Environment.LEVELS) {
    let level = Environment.LEVELS[levelName];
    obj[level] = {"functions": [], "levelState": LEVEL_STATES.NOT_ENTERED};
  }
  return obj;
}

(function addLevelIterators(Environment) {
  let startupSequence = [
    LEVELS.ESSENTIAL,
    LEVELS.BACKEND,
    LEVELS.INTERFACE,
    LEVELS.UI
  ];
  let shutdownSequence = [
    LEVELS.UI,
    LEVELS.INTERFACE,
    LEVELS.BACKEND,
    LEVELS.ESSENTIAL
  ];
  function iterateLevels(aSequence, aFn) {
    for (let i = 0, len = aSequence.length; i < len; ++i) {
      // Note: It's necessary to use for(;;) instead of  for(..of..)
      //       because the order/sequence must be exactly the same as in the
      //       array.  for(..of..) doesn't guarantee that the elements are
      //       called in order.

      let level = aSequence[i];
      aFn(level);
    }
  };

  Environment.iterateStartupLevels = iterateLevels.bind(null, startupSequence);
  Environment.iterateShutdownLevels = iterateLevels.bind(null, shutdownSequence);
})(Environment);




/**
 * This set of functions can be used for adding startup/shutdown functions.
 */
Environment.prototype.addStartupFunction = function(aLevel, f) {
  let self = this;
  if (self.envState >= ENV_STATES.SHUTTING_DOWN) {
    // the environment is shutting down or already shut down.
    return;
  }
  if (self.startupLevels[aLevel].levelState >= LEVEL_STATES.PROCESSING) {
    // Either the startup functions of the same level as `aLevel` have
    //        already been processed
    //    OR  they are currently being processed.
    //
    // ==> call the function immediately.
    f();
  } else {
    // the startup process did not reach the function's level yet.
    //
    // ==> remember the function.
    self.startupLevels[aLevel].functions.push(f);
  }
};

Environment.prototype.addShutdownFunction = function(aLevel, f) {
  let self = this;
  if (self.shutdownLevels[aLevel].levelState >= LEVEL_STATES.PROCESSING) {
    // Either the shutdown functions of the same level as `aLevel` have
    //        already been processed
    //    OR  they are currently being processed.
    //
    // ==> call the function immediately.
    f();
    //console.debug('[RPC] calling shutdown function immediately: "' +
    //              (f.name || "anonymous") + '" (' + self.name + ')');
  } else {
    // The opposite, i.e. the startup process did not reach the function's
    // level yet.
    //
    // ==> remember the function.
    self.shutdownLevels[aLevel].functions.push(f);
  }
};



(function addStartupAndShutdown(Environment) {
  /**
   * This function calls all functions of a function queue.
   */
  function callFunctions(fnArray, fnArgsToApply) {
    // process the Array as long as it contains elements
    while (fnArray.length > 0) {
      // The following is either `fnArray.pop()` or `fnArray.shift()`
      // depending on `sequence`.
      let f = fnArray.pop();

      // call the function
      f.apply(null, fnArgsToApply);
    }
  };

  function processLevel(aLevelObj, fnArgsToApply) {
    aLevelObj.levelState = LEVEL_STATES.PROCESSING;
    callFunctions(aLevelObj.functions, fnArgsToApply);
    aLevelObj.levelState = LEVEL_STATES.FINISHED_PROCESSING;
  }

  // not used for now
  //Environment.prototype.callStartupFunctions = function(aLevel, fnArgsToApply) {
  //  let self = this;
  //  processLevel(self.startupLevels[aLevel], fnArgsToApply);
  //};

  Environment.prototype.callShutdownFunctions = function(aLevel, fnArgsToApply) {
    let self = this;
    processLevel(self.shutdownLevels[aLevel], fnArgsToApply);
  };




  Environment.prototype.startup = function() {
    let self = this;
    let fnArgsToApply = arguments;

    if (self.envState == ENV_STATES.NOT_STARTED) {
      //console.log('[RPC] starting up Environment "'+self.name+'"...');
      self.envState = ENV_STATES.STARTING_UP;

      Environment.iterateStartupLevels(function (level) {
        let levelObj = self.startupLevels[level];
        processLevel(levelObj, fnArgsToApply);
      });

      self.envState = ENV_STATES.STARTUP_DONE;
    }
  };

  Environment.prototype.shutdown = function() {
    let self = this;
    let fnArgsToApply = arguments;

    if (self.envState === ENV_STATES.STARTUP_DONE) {
      //console.log('[RPC] shutting down Environment "'+self.name+'"...');
      self.envState = ENV_STATES.SHUTTING_DOWN;

      EnvironmentManager.unregisterEnvironment(self);

      Environment.iterateShutdownLevels(function (level) {
        let levelObj = self.shutdownLevels[level];
        processLevel(levelObj, fnArgsToApply);
      });

      self.envState = ENV_STATES.SHUT_DOWN;
    }
  };
})(Environment);

/**
 * Helper function: shuts down the environment when an EventTarget's "unload"
 * event occurres.
 */
Environment.prototype.shutdownOnUnload = function(aEventTarget) {
  let self = this;
  self.elManager.addListener(aEventTarget, "unload", function() {
    //console.log("[RPC] an EventTarget's `unload` function has been called. " +
    //            'Going to shut down Environment "'+self.name+'"');
    self.shutdown();
  });
};
