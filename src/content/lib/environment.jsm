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

let EXPORTED_SYMBOLS = [
  "Environment",
  "FrameScriptEnvironment",
  "ProcessEnvironment"
];

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let globalScope = this;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/devtools/Console.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");

ScriptLoader.defineLazyModuleGetters({
  "lib/manager-for-event-listeners": ["ManagerForEventListeners"],
  "lib/manager-for-message-listeners": ["ManagerForMessageListeners"],
  "lib/utils/constants": ["C"],
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


let BOOTSTRAP = {
  "startup": {
    levelSequence: [
      LEVELS.ESSENTIAL,
      LEVELS.BACKEND,
      LEVELS.INTERFACE,
      LEVELS.UI
    ],
    lastLevel: LEVELS.UI,
    envStates: {
      "beforeProcessing": ENV_STATES.NOT_STARTED,
      "duringProcessing": ENV_STATES.STARTING_UP,
      "afterProcessing": ENV_STATES.STARTUP_DONE
    },
    functions: {
      "beforeProcessing": function() {
        // "this" will be an environment
        let self = this;
        self.register();
      },
      "afterProcessing": function() {}
    }
  },
  "shutdown": {
    levelSequence: [
      LEVELS.UI,
      LEVELS.INTERFACE,
      LEVELS.BACKEND,
      LEVELS.ESSENTIAL
    ],
    lastLevel: LEVELS.ESSENTIAL,
    envStates: {
      "beforeProcessing": ENV_STATES.STARTUP_DONE,
      "duringProcessing": ENV_STATES.SHUTTING_DOWN,
      "afterProcessing": ENV_STATES.SHUT_DOWN
    },
    functions: {
      "beforeProcessing": function() {},
      "afterProcessing": function() {
        // "this" will be an environment
        let self = this;
        self.innerEnvs.length = 0;
        self.unregister();
      }
    }
  }
};
function getBootstrapMetadata(startupOrShutdown) {
  return BOOTSTRAP[startupOrShutdown];
}


/**
 * The `Environment` class can take care of the "startup" (=initialization)
 * and "shutdown" of any environment.
 *
 * To each `Environment` instance, `startup` and `shutdown` functions can be
 * added. As soon as the Environment starts up, e.g. via its startup()
 * function, all those functions will be called. Equally the shutdown
 * functions are called on the environment's shutdown.
 *
 * Both startup and shutdown functions will have Levels assigned. The levels
 * of the functions determine in which sequence they are called.
 *
 * @constructor
 * @param {Environment=} aOuterEnv - the Environment to which this environment
 *     will register itself. Inner environments shut down when its outer
 *     environment shuts down.
 * @param {string=} aName - the Environment's name; only needed for debugging.
 */
function Environment(aOuterEnv, aName="anonymous") {
  let self = this;

  self.envState = ENV_STATES.NOT_STARTED;

  self.name = aName;

  self.outerEnv = aOuterEnv instanceof Environment ? aOuterEnv : null;
  self.innerEnvs = new Set();

  self.levels = {
    "startup": generateLevelObjects(),
    "shutdown": generateLevelObjects()
  };

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


/**
 * Registers the environment to its outer environment.
 */
Environment.prototype.register = function() {
  let self = this;
  if (self.outerEnv) {
    self.outerEnv.registerInnerEnvironment(self);
  }
}
/**
 * Unregisters the environment from its outer environment.
 */
Environment.prototype.unregister = function() {
  let self = this;
  if (self.outerEnv) {
    self.outerEnv.unregisterInnerEnvironment(self);
  }
}
/**
 * Function called by an inner environment when it starts up.
 *
 * @param {Environment} aEnv - the environment that wants to register itself.
 */
Environment.prototype.registerInnerEnvironment = function(aEnv) {
  let self = this;
  if (self.envState === ENV_STATES.NOT_STARTED) {
    console.warn("[RPC] registerInnerEnvironment() has been called, " +
                 "but the outer environment hasn't started up yet. " +
                 "Starting up now.");
    self.startup();
  }
  //console.debug("[RPC] registering inner environment.");
  self.innerEnvs.add(aEnv);
};
/**
 * Function that is called each time an inner environment shuts down.
 *
 * @param {Environment} aEnv - the environment that is unregistering
 */
Environment.prototype.unregisterInnerEnvironment = function(aEnv) {
  let self = this;

  if (self.innerEnvs.has(aEnv) === false) {
    console.error("[RPC] it seems like an inner Environment " +
                  "did not register.");
  } else {
    self.innerEnvs.delete(aEnv);
  }
};




/**
 * Add a startup function to the environment.
 */
Environment.prototype.addStartupFunction = function(aLevel, f) {
  let self = this;
  if (self.envState >= ENV_STATES.SHUTTING_DOWN) {
    // the environment is shutting down or already shut down.
    return;
  }
  if (self.levels["startup"][aLevel].levelState >= LEVEL_STATES.PROCESSING) {
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
    self.levels["startup"][aLevel].functions.push(f);
  }
};

/**
 * Add a shutdown function to the environment.
 */
Environment.prototype.addShutdownFunction = function(aLevel, f) {
  let self = this;
  if (self.levels["shutdown"][aLevel].levelState >= LEVEL_STATES.PROCESSING) {
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
    self.levels["shutdown"][aLevel].functions.push(f);
  }
};


// have a scope/closure for private functions specific to
// startup() and shutdown().
(function createMethods_StartupAndShutdown(Environment) {
  /**
   * Iterates all levels of either the startup or the shutdown
   * sequence and calls a function for each level.
   *
   * @param {string} aStartupOrShutdown
   * @param {function()} aFn - the function to call
   * @param {integer=} aUntilLevel - if specified, iteration stops
   *     after that level.
   */
  function iterateLevels(aStartupOrShutdown, aFn, aUntilLevel=null) {
    let sequence = BOOTSTRAP[aStartupOrShutdown].levelSequence;

    for (let i = 0, len = sequence.length; i < len; ++i) {
      // Note: It's necessary to use for(;;) instead of  for(..of..)
      //       because the order/sequence must be exactly the same as in the
      //       array.  for(..of..) doesn't guarantee that the elements are
      //       called in order.

      let level = sequence[i];
      aFn(level);

      if (level === aUntilLevel) {
        // Stop after aUntilLevel
        break;
      }
    }
  }


  /**
   * This function calls all functions in an array.
   *
   * @param {Array.<function()>} aFunctions
   * @param {Array} aBootstrapArgs - the arguments to apply
   */
  function callFunctions(aFunctions, aBootstrapArgs) {
    // process the Array as long as it contains elements
    while (aFunctions.length > 0) {
      // The following is either `fnArray.pop()` or `fnArray.shift()`
      // depending on `sequence`.
      let f = aFunctions.pop();

      // call the function
      f.apply(null, aBootstrapArgs);
      //console.debug("[RPC] function called! (" + fnArray.length +
      //              " functions left)");
    }
  };


  /**
   * Process a level independently of the environment's states and
   * independently of the other levels' states.
   *
   * @this {Environment}
   * @param {string} aStartupOrShutdown - either "startup" or "shutdown"
   * @param {integer} aLevel
   */
  function processLevel(aStartupOrShutdown, aLevel, aBootstrapArgs) {
    let self = this;

    let levelObj = self.levels[aStartupOrShutdown][aLevel];

    if (levelObj.levelState === LEVEL_STATES.NOT_ENTERED) {
      levelObj.levelState = LEVEL_STATES.PROCESSING;

      if (aStartupOrShutdown === "shutdown") {
        // shut down all inner environments
        self.innerEnvs.forEach(function(innerEnv) {
          innerEnv.shutdown(aBootstrapArgs, aLevel);
        });
      }

      callFunctions(levelObj.functions, aBootstrapArgs);

      levelObj.levelState = LEVEL_STATES.FINISHED_PROCESSING;
    }
  }


  /**
   * Iterate levels and call processLevel() for each level.
   *
   * @this {Environment}
   * @param {string} aStartupOrShutdown
   * @param {Array} aBootstrapArgs
   * @param {integer=} aUntilLevel
   */
  function processLevels(aStartupOrShutdown, aBootstrapArgs, aUntilLevel) {
    let self = this;
    iterateLevels(aStartupOrShutdown, function (level) {
      processLevel.call(self, aStartupOrShutdown, level, aBootstrapArgs);
    }, aUntilLevel);
  }


  /**
   * Return some information about an environment.
   *
   * @param {Environment} env
   * @return {string}
   */
  function getEnvInfo(env) {
    return "'" + env.name + "' (" + env.uid + ")";
  }

  // #ifdef LOG_ENVIRONMENT
  /**
   * Log some debug information on startup or shutdown.
   *
   * @this {Environment}
   * @param {string} aStartupOrShutdown
   */
  function logStartupOrShutdown(aStartupOrShutdown) {
    let self = this;
    console.log("[RPC] " + aStartupOrShutdown + ": " + getEnvInfo(self) + "." +
                (self.outerEnv ?
                 " OuterEnv is " + getEnvInfo(self.outerEnv) + "." :
                 " No OuterEnv."));
  }
  // #endif

  /**
   * Actual body of the functions startup() and shutdown().
   *
   * @this {Environment}
   * @param {string} aStartupOrShutdown - either "startup" or "shutdown"
   * @param {Array} aBootstrapArgs
   * @param {integer=} aUntilLevel - The level after which the startup
   *     (or shutdown) processing is stopped.
   */
  function bootstrap(aStartupOrShutdown,
                     aBootstrapArgs,
                     aUntilLevel=BOOTSTRAP[aStartupOrShutdown].lastLevel) {
    let self = this;

    let {
      lastLevel,
      envStates,
      functions
    } = getBootstrapMetadata(aStartupOrShutdown);

    if (self.envState === envStates["beforeProcessing"]) {
      // #ifdef LOG_ENVIRONMENT
      logStartupOrShutdown.call(self, aStartupOrShutdown);
      // #endif
      functions["beforeProcessing"].call(self);

      self.envState = envStates["duringProcessing"];
    }

    if (self.envState === envStates["duringProcessing"]) {
      processLevels.call(self, aStartupOrShutdown, aBootstrapArgs, aUntilLevel);

      if (aUntilLevel === lastLevel) {
        self.envState = envStates["afterProcessing"];
        functions["afterProcessing"].call(self);
      }
    }
  };

  Environment.prototype.startup = function(aBootstrapArgs, aUntilLevel) {
    let self = this;
    bootstrap.call(self, "startup", aBootstrapArgs, aUntilLevel);
  };

  Environment.prototype.shutdown = function(aBootstrapArgs, aUntilLevel) {
    let self = this;
    bootstrap.call(self, "shutdown", aBootstrapArgs, aUntilLevel);
  };

})(Environment);

/**
 * Tell the Environment to shut down when an EventTarget's
 * "unload" event occurres.
 *
 * @param {EventTarget} aEventTarget - an object having the functions
 *     addEventListener() and removeEventListener().
 */
Environment.prototype.shutdownOnUnload = function(aEventTarget) {
  let self = this;
  self.elManager.addListener(aEventTarget, "unload", function() {
    // #ifdef LOG_ENVIRONMENT
    console.log("[RPC] an EventTarget's `unload` function has been called. " +
                'Going to shut down Environment "' + self.name + '"');
    // #endif
    self.shutdown();
  });
};


/**
 * @constructor
 * @extends {Environment}
 * @param {ContentFrameMessageManager} aMM
 * @param {string=} aName - the environment's name, passed to the superclass.
 */
function FrameScriptEnvironment(aMM, aName="frame script environment") {
  let self = this;

  // The outer Environment will be either ChildProcessEnvironment
  // or ParentProcessEnvironment.
  let _outerEnv = ProcessEnvironment;

  Environment.call(self, _outerEnv, aName);

  self.mm = aMM;

  self.addStartupFunction(LEVELS.INTERFACE, function() {
    // shut down the framescript on the message manager's
    // `unload`. That event will occur when the browsing context
    // (e.g. the tab) has been closed.
    self.shutdownOnUnload(self.mm);
  });

  // a "MessageListener"-Manager for this environment
  XPCOMUtils.defineLazyGetter(self, "mlManager", function() {
    return new ManagerForMessageListeners(self, self.mm);
  });
}
FrameScriptEnvironment.prototype = Object.create(Environment.prototype);
FrameScriptEnvironment.prototype.constructor = Environment;


// Load the "ProcessEnvironment"
Services.scriptloader.loadSubScript("chrome://rpcontinued/content/" +
                                    "lib/environment.process.js");
