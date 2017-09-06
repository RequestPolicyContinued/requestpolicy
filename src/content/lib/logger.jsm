/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

/* global Components */
const {interfaces: Ci, utils: Cu} = Components;

/* exported Logger */
this.EXPORTED_SYMBOLS = ["Logger"];

/* global dump */

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {Environment, ProcessEnvironment} = importModule("lib/environment");
let {Prefs} = importModule("models/prefs");

//==============================================================================
// Logger
//==============================================================================

/**
 * Provides logging methods
 */
var Logger = (function() {

  let self = {
    TYPE_CONTENT: 1, // content whose origin isn't known more specifically
    TYPE_META_REFRESH: 2, // info related to meta refresh
    TYPE_HEADER_REDIRECT: 4, // info related to header redirects
    TYPE_INTERNAL: 8, // internal happenings of the extension
    TYPE_ERROR: 16, // errors
    TYPE_POLICY: 32, // Policy changes, storage, etc.
    TYPE_ALL: 0x0 - 1, // all

    LEVEL_OFF: Number.MAX_VALUE, // no logging
    LEVEL_SEVERE: 1000,
    LEVEL_WARNING: 900,
    LEVEL_INFO: 800,
    LEVEL_DEBUG: 700,
    LEVEL_ALL: Number.MIN_VALUE, // log everything
  };

  self._TYPE_NAMES = {};
  self._TYPE_NAMES[self.TYPE_CONTENT.toString()] = "CONTENT";
  self._TYPE_NAMES[self.TYPE_META_REFRESH.toString()] = "META_REFRESH";
  self._TYPE_NAMES[self.TYPE_HEADER_REDIRECT.toString()] = "HEADER_REDIRECT";
  self._TYPE_NAMES[self.TYPE_INTERNAL.toString()] = "INTERNAL";
  self._TYPE_NAMES[self.TYPE_ERROR.toString()] = "ERROR";
  self._TYPE_NAMES[self.TYPE_POLICY.toString()] = "POLICY";

  self._LEVEL_NAMES = {};
  self._LEVEL_NAMES[self.LEVEL_SEVERE.toString()] = "SEVERE";
  self._LEVEL_NAMES[self.LEVEL_WARNING.toString()] = "WARNING";
  self._LEVEL_NAMES[self.LEVEL_INFO.toString()] = "INFO";
  self._LEVEL_NAMES[self.LEVEL_DEBUG.toString()] = "DEBUG";

  // function to use to print out the log
  self.printFunc = dump;

  let initialized = false;

  /**
   * This function will be called in case Logger isn't fully initialized yet.
   */
  function initialLog() {
    init();
    log.apply(this, arguments);
  }

  /**
  * Initially call initialLog() on doLog().
  * After initialization it will be log().
  */
  let doLog = initialLog;

  // initially, enable logging. later the logging preferences of the user will
  // will be loaded.
  let enabled = true;
  // These can be set to change logging level, what types of messages are
  // logged, and to enable/disable logging.
  let level = self.LEVEL_INFO;
  let types = self.TYPE_ALL;

  function updateLoggingSettings() {
    enabled = Prefs.get("log");
    level = Prefs.get("log.level");
    types = Prefs.get("log.types");
  }

  /**
   * init() is called by doLog() until initialization was successful.
   * For the case that nothing is logged at all, init is registered as a
   * startup-function.
   */
  function init() {
    if (initialized === true) {
      // don't initialize several times
      return;
    }

    // RequestPolicy's pref branch is available now.
    ProcessEnvironment.prefObs.addListener("log", updateLoggingSettings);
    updateLoggingSettings();

    // don't call init() anymore when doLog() is called
    doLog = log;

    initialized = true;
  }

  ProcessEnvironment.addStartupFunction(Environment.LEVELS.ESSENTIAL, init);

  function log(aLevel, aType, aMessage, aError) {
    let shouldLog = enabled && aLevel >= level && types & aType;

    // @ifdef UNIT_TESTING
    let isError = aType === self.TYPE_ERROR || aLevel === self.LEVEL_SEVERE;
    if (isError) {
      // log even if logging is disabled
      shouldLog = true;
    }
    // @endif

    if (shouldLog) {
      let levelName = self._LEVEL_NAMES[aLevel.toString()];
      let typeName = self._TYPE_NAMES[aType.toString()];

      let stack = aError && aError.stack ?
                  ", stack was:\n" + aError.stack : "";
      let msg = "[RequestPolicy] [" + levelName + "] " +
          "[" + typeName + "] " + aMessage + stack;
      self.printFunc(msg + "\n");
    }
  }

  self.severe = doLog.bind(self, self.LEVEL_SEVERE);
  self.severeError = doLog.bind(self, self.LEVEL_SEVERE, self.TYPE_ERROR);
  self.warning = doLog.bind(self, self.LEVEL_WARNING);
  self.error = doLog.bind(self, self.LEVEL_WARNING, self.TYPE_ERROR);
  self.info = doLog.bind(self, self.LEVEL_INFO);
  self.debug = doLog.bind(self, self.LEVEL_DEBUG);
  self.dump = doLog.bind(self, self.LEVEL_DEBUG, self.TYPE_INTERNAL);

  self.vardump = function(obj, name, ignoreFunctions) {
    if (name !== undefined) {
      self.dump(name + " : " + obj);
    } else {
      self.dump(obj);
    }
    // Iterate through all keys in the whole prototype chain.
    /* jshint -W089 */ // don't require checking hasOwnProperty()
    for (let key in obj) {
      let value = obj[key];
      try {
        if (typeof value === "function") {
          if (!ignoreFunctions) {
            self.dump("    => key: " + key + " / value: instanceof Function");
          }
        } else {
          self.dump("    => key: " + key + " / value: " + value);
        }
      } catch (e) {
        self.dump("    => key: " + key + " / value: [unable to access value]");
      }
    }
    /* jshint +W089 */
  };

  return self;
}());

// @ifdef UNIT_TESTING

//==============================================================================
// ErrorTriggeringService
//==============================================================================

/**
 * Triggers errors for a RequestPolicy unit test.
 * It's used to test Error Detection from the unit tests.
 */
var ErrorTriggeringService = (function() {
  let self = {};

  const topic = "requestpolicy-trigger-error";

  const observer = {};

  self.startup = function() {
    Services.obs.addObserver(observer, topic, false);
  };

  self.shutdown = function() {
    Services.obs.removeObserver(observer, topic);
  };

  /**
   * Split a string like
   *   "foo:bar:baz"
   * to two strings:
   *   ["foo", "bar:baz"]
   * Only the first colon counts.
   */
  function splitColon(aString) {
    var index = aString.indexOf(":");
    if (index === -1) {
      return [aString, ""];
    }
    var part1 = aString.substr(0, index);
    var part2 = aString.substr(index + 1);
    return [part1, part2];
  }

  observer.observe = function(aSubject, aTopic, aData) {
    let [type, message] = splitColon(aData);

    if (type === "normal error") {
      Logger.warning(Logger.TYPE_ERROR, message);
    } else if (type === "severe error") {
      Logger.severe(Logger.TYPE_INTERNAL, message);
    } else if (type === "ReferenceError") {
      runAsync(produceReferenceError);
    }
  };

  function produceReferenceError() {
    var localVar = nonexistantVariable; // jshint ignore:line
  }

  function runAsync(aFunction) {
    var runnable = {run: aFunction};
    Services.tm.currentThread.dispatch(runnable,
        Ci.nsIEventTarget.DISPATCH_NORMAL);
  }

  return self;
}());

ProcessEnvironment.addStartupFunction(Environment.LEVELS.BACKEND,
                                      ErrorTriggeringService.startup);
ProcessEnvironment.addShutdownFunction(Environment.LEVELS.BACKEND,
                                       ErrorTriggeringService.shutdown);
// @endif
