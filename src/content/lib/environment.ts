/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2014 Martin Kimmerle
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

import {
  ManagerForEventListeners,
} from "content/lib/manager-for-event-listeners";
import {ObserverManager} from "content/lib/observer-manager";
import {Log} from "content/models/log";

// =============================================================================
// utilities
// =============================================================================

const log = Log.instance.extend({
  enabledCondition: {type: "C", C: "LOG_ENVIRONMENT"},
  name: "Environment",
});

type tStartupOrShutdown = "startup" | "shutdown";
type tBootstrapArgs = any[];
type tBootstrapFn = (...args: tBootstrapArgs) => void;

// =============================================================================
// BaseEnvironment
// =============================================================================

export enum State {
  NOT_STARTED = 0,
  STARTING_UP = 1,
  STARTUP_DONE = 2,
  SHUTTING_DOWN = 3,
  SHUT_DOWN = 4,
}

export enum Level {
  // Essential functions do tasks that must be run first on startup and last
  // on shutdown, that is they do tasks that are requirements for the Backend.
  ESSENTIAL = 1,
  // Backend functions start up/shut down main parts of RequestPolicy, but
  // they do not enable RequestPolicy at all.
  BACKEND = 2,
  // Interface functions enable/disable external as well as internal
  // interfaces, e.g. Event Listeners, Message Listeners, Observers,
  // Factories.
  INTERFACE = 3,
  // UI functions will enable/disable UI elements such as the menu.
  UI = 4,
}

// a level can be entered, being processed, or finished being processed.
export enum LevelState {
  NOT_ENTERED = 0,
  PROCESSING = 1,
  FINISHED_PROCESSING = 2,
}

class BaseEnvironment {
  // ---------------------------------------------------------------------------
  // constants, metadata
  // ---------------------------------------------------------------------------

  private static BOOTSTRAP: any = {
    shutdown: {
      envStates: {
        afterProcessing: State.SHUT_DOWN,
        beforeProcessing: State.STARTUP_DONE,
        duringProcessing: State.SHUTTING_DOWN,
      },
      functions: {
        // tslint:disable-next-line no-empty
        beforeProcessing() {},
        /**
         * @this {BaseEnvironment}
         */
        afterProcessing() {
          const self: any = this;
          self.innerEnvs.length = 0;
          self.unregister();
        },
      },
      lastLevel: Level.ESSENTIAL,
      levelSequence: [
        Level.UI,
        Level.INTERFACE,
        Level.BACKEND,
        Level.ESSENTIAL,
      ],
    },
    startup: {
      envStates: {
        afterProcessing: State.STARTUP_DONE,
        beforeProcessing: State.NOT_STARTED,
        duringProcessing: State.STARTING_UP,
      },
      functions: {
        /**
         * @this {BaseEnvironment}
         */
        beforeProcessing() {
          const self: any = this;
          self.register();
        },
        // tslint:disable-next-line no-empty
        afterProcessing() {},
      },
      lastLevel: Level.UI,
      levelSequence: [
        Level.ESSENTIAL,
        Level.BACKEND,
        Level.INTERFACE,
        Level.UI,
      ],
    },
  };

  private static getBootstrapMetadata(startupOrShutdown: tStartupOrShutdown) {
    return BaseEnvironment.BOOTSTRAP[startupOrShutdown];
  }

  /**
   * This function creates one "Level Object" for each level. Those objects
   * mainly will hold the startup- or shutdown-functions of the corresponding
   * level. All of the Level Objects are put together in another object which
   * is then returned.
   *
   * @return {Object}
   */
  private static generateLevelObjects() {
    const obj: {[k: string]: any} = {};
    // tslint:disable-next-line forin prefer-const
    for (let levelName in Level) {
      const level = Level[levelName];
      obj[level] = {
        functions: [],
        levelState: LevelState.NOT_ENTERED,
      };
    }
    return obj;
  }

  // ---------------------------------------------------------------------------
  // BaseEnvironment
  // ---------------------------------------------------------------------------

  public isMainEnvironment: boolean = false;

  // generate an unique ID for debugging purposes
  protected readonly uid: string = Math.random().toString(36).substr(2, 5);
  protected name: string;

  private envState = State.NOT_STARTED;
  private outerEnv: BaseEnvironment | null;
  private innerEnvs = new Set<BaseEnvironment>();

  private levels = {
    shutdown: BaseEnvironment.generateLevelObjects(),
    startup: BaseEnvironment.generateLevelObjects(),
  };

  constructor(aOuterEnv: BaseEnvironment | null, aName: string = "anonymous") {
    this.envState = State.NOT_STARTED;

    this.name = aName;

    this.outerEnv = aOuterEnv instanceof BaseEnvironment ? aOuterEnv : null;
    this.innerEnvs = new Set();

    this.levels = {
      shutdown: BaseEnvironment.generateLevelObjects(),
      startup: BaseEnvironment.generateLevelObjects(),
    };

    log.log("created new Environment \"" + this.name + "\"");
  }

  public isShuttingDownOrShutDown() {
    return this.envState >= State.SHUTTING_DOWN;
  }

  /**
   * Registers the environment to its outer environment.
   */
  public register() {
    if (this.outerEnv) {
      this.outerEnv.registerInnerEnvironment(this);
    }
  }
  /**
   * Unregisters the environment from its outer environment.
   */
  public unregister() {
    if (this.outerEnv) {
      this.outerEnv.unregisterInnerEnvironment(this);
    }
  }
  /**
   * Function called by an inner environment when it starts up.
   *
   * @param {BaseEnvironment} aEnv - the environment that
   *    wants to register itself.
   */
  public registerInnerEnvironment(aEnv: BaseEnvironment) {
    if (this.envState === State.NOT_STARTED) {
      log.warn("registerInnerEnvironment() has been called but " +
          "the outer environment hasn't started up yet. " +
          "Starting up now.");
      this.startup();
    }
    log.log("registering inner environment");
    this.innerEnvs.add(aEnv);
  }
  /**
   * Function that is called each time an inner environment shuts down.
   *
   * @param {BaseEnvironment} aEnv - the environment that is unregistering
   */
  public unregisterInnerEnvironment(aEnv: BaseEnvironment) {
    if (this.innerEnvs.has(aEnv) === false) {
      console.error("it seems like an inner Environment did not register.");
    } else {
      this.innerEnvs.delete(aEnv);
    }
  }

  public addStartupFunction(aLevel: Level, f: tBootstrapFn) {
    if (this.isShuttingDownOrShutDown()) {
      // the environment is shutting down or already shut down.
      return;
    }
    if (this.levels.startup[aLevel].levelState >= LevelState.PROCESSING) {
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
      this.levels.startup[aLevel].functions.push(f);
    }
  }

  public addShutdownFunction(aLevel: Level, f: tBootstrapFn) {
    if (this.levels.shutdown[aLevel].levelState >= LevelState.PROCESSING) {
      // Either the shutdown functions of the same level as `aLevel` have
      //        already been processed
      //    OR  they are currently being processed.
      //
      // ==> call the function immediately.
      f();
      log.cbLog(() => [
        `calling shutdown function immediately: ` +
        `"${f.name || "anonymous"}" (${this.name})`,
      ]);
    } else {
      // The opposite, i.e. the startup process did not reach the function's
      // level yet.
      //
      // ==> remember the function.
      this.levels.shutdown[aLevel].functions.push(f);
    }
  }

  public startup(aBootstrapArgs?: tBootstrapArgs, aUntilLevel?: Level) {
    log.log("starting up: " + this.name);
    this._bootstrap("startup", aBootstrapArgs, aUntilLevel);
  }

  public shutdown(aBootstrapArgs?: tBootstrapArgs, aUntilLevel?: Level) {
    log.log("shutting down: " + this.name);
    this._bootstrap("shutdown", aBootstrapArgs, aUntilLevel);
  }

  /**
   * Iterates all levels of either the startup or the shutdown
   * sequence and calls a function for each level.
   *
   * @param {string} aStartupOrShutdown
   * @param {function()} aFn - the function to call
   * @param {integer=} aUntilLevel - if specified, iteration stops
   *     after that level.
   */
  private _iterateLevels(
      aStartupOrShutdown: tStartupOrShutdown,
      aFn: tBootstrapFn,
      aUntilLevel: Level | null = null,
  ) {
    const sequence = BaseEnvironment.
        BOOTSTRAP[aStartupOrShutdown].levelSequence;

    for (let i = 0, len = sequence.length; i < len; ++i) {
      // Note: It's necessary to use for(;;) instead of  for(..of..)
      //       because the order/sequence must be exactly the same as in the
      //       array.  for(..of..) doesn't guarantee that the elements are
      //       called in order.

      const level = sequence[i];
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
  private _callFunctions(
      aFunctions: tBootstrapFn[],
      aBootstrapArgs: tBootstrapArgs = [],
  ) {
    // process the Array as long as it contains elements
    while (aFunctions.length > 0) {
      // The following is either `fnArray.pop()` or `fnArray.shift()`
      // depending on `sequence`.
      const f: tBootstrapFn = aFunctions.pop() as tBootstrapFn;

      // call the function
      try {
        f(...aBootstrapArgs);
      } catch (e) {
        console.error("Error in bootstrap function! Details:");
        console.dir(e);
      }
      log.log("function called! (" + aFunctions.length +
          " functions left)");
    }
  }

  /**
   * Process a level independently of the environment's states and
   * independently of the other levels' states.
   *
   * @this {BaseEnvironment}
   * @param {string} aStartupOrShutdown - either "startup" or "shutdown"
   * @param {integer} aLevel
   * @param {Object} aBootstrapArgs
   */
  private _processLevel(
      aStartupOrShutdown: tStartupOrShutdown,
      aLevel: Level,
      aBootstrapArgs: tBootstrapArgs,
  ) {
    const levelObj = this.levels[aStartupOrShutdown][aLevel];

    if (levelObj.levelState === LevelState.NOT_ENTERED) {
      levelObj.levelState = LevelState.PROCESSING;
      log.log("processing level " + aLevel + " of startup (" +
          this.uid + ")");

      if (aStartupOrShutdown === "shutdown") {
        // shut down all inner environments
        this.innerEnvs.forEach((innerEnv) => {
          innerEnv.shutdown(aBootstrapArgs, aLevel);
        });
      }

      this._callFunctions(levelObj.functions, aBootstrapArgs);

      levelObj.levelState = LevelState.FINISHED_PROCESSING;
      log.log("processing level " + aLevel + " of startup " +
          "(" + this.uid + ") finished");
    }
  }

  /**
   * Iterate levels and call processLevel() for each level.
   *
   * @this {BaseEnvironment}
   * @param {string} aStartupOrShutdown
   * @param {Array} aBootstrapArgs
   * @param {integer=} aUntilLevel
   */
  private _processLevels(
      aStartupOrShutdown: tStartupOrShutdown,
      aBootstrapArgs: tBootstrapArgs,
      aUntilLevel: Level,
  ) {
    this._iterateLevels(aStartupOrShutdown, (level: Level) => {
      this._processLevel(aStartupOrShutdown, level, aBootstrapArgs);
    }, aUntilLevel);
  }

  /**
   * Return some information about an environment.
   *
   * @param {BaseEnvironment} env
   * @return {string}
   */
  private get envInfo() {
    return "'" + this.name + "' (" + this.uid + ")";
  }

  /**
   * Log some debug information on startup or shutdown.
   *
   * @this {BaseEnvironment}
   * @param {string} aStartupOrShutdown
   */
  private _logStartupOrShutdown(aStartupOrShutdown: tStartupOrShutdown) {
    log.cbLog(() => [
      `${aStartupOrShutdown}: ${this.envInfo}. ` +
      (this.outerEnv ?
          " OuterEnv is " + this.outerEnv.envInfo + "." :
          " No OuterEnv."),
    ]);
  }

  /**
   * Actual body of the functions startup() and shutdown().
   *
   * @this {BaseEnvironment}
   * @param {string} aStartupOrShutdown - either "startup" or "shutdown"
   * @param {Array} aBootstrapArgs
   * @param {integer=} aUntilLevel - The level after which the startup
   *     (or shutdown) processing is stopped.
   */
  private _bootstrap(
      aStartupOrShutdown: tStartupOrShutdown,
      aBootstrapArgs: tBootstrapArgs = [],
      aUntilLevel: Level =
          BaseEnvironment.BOOTSTRAP[aStartupOrShutdown].lastLevel,
  ) {
    const {
      lastLevel,
      envStates,
      functions,
    } = BaseEnvironment.getBootstrapMetadata(aStartupOrShutdown);

    if (this.envState === envStates.beforeProcessing) {
      this._logStartupOrShutdown(aStartupOrShutdown);
      functions.beforeProcessing.call(this);

      this.envState = envStates.duringProcessing;
    }

    if (this.envState === envStates.duringProcessing) {
      this._processLevels(aStartupOrShutdown, aBootstrapArgs, aUntilLevel);

      if (aUntilLevel === lastLevel) {
        this.envState = envStates.afterProcessing;
        functions.afterProcessing.call(this);
      }
    }
  }
}

// =============================================================================
// Environment
// =============================================================================

// tslint:disable-next-line max-classes-per-file
export class Environment extends BaseEnvironment {
  private lazyElManager: ManagerForEventListeners;
  private lazyObMan: ObserverManager;

  // Define a Lazy Getter to get an instance of `ManagerForEventListeners` for
  // this Environment.
  public get elManager(): ManagerForEventListeners {
    if (!this.lazyElManager) {
      this.lazyElManager = new ManagerForEventListeners(this);
    }
    return this.lazyElManager as ManagerForEventListeners;
  }

  // Define a Lazy Getter to get an ObserverManager for this Environment.
  // Using that Getter is more convenient than doing it manually, as the
  // Environment has to be created *before* the ObserverManager.
  public get obMan(): ObserverManager {
    if (!this.lazyObMan) {
      this.lazyObMan = new ObserverManager(this);
    }
    return this.lazyObMan as ObserverManager;
  }

  /**
   * Tell the Environment to shut down when an EventTarget's
   * "unload" event occurres.
   *
   * @param {EventTarget} aEventTarget - an object having the functions
   *     addEventListener() and removeEventListener().
   */
  public shutdownOnUnload(aEventTarget: EventTarget) {
    this.elManager.addListener(aEventTarget, "unload", () => {
      log.log(
          "an EventTarget's `unload` function " +
          "has been called. Going to shut down Environment " +
          `"${this.name}`);
      this.shutdown();
    });
  }
}

// =============================================================================
// MainEnvironment
// =============================================================================

// Main Environments are the outermost environments.
export const MainEnvironment = new Environment(null, "Main Environment");

MainEnvironment.isMainEnvironment =
    typeof browser.extension.getBackgroundPage === "function";
