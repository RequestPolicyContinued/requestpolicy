/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["Logger"];

Cu.import("resource://gre/modules/Services.jsm");


// We can't import the ScriptLoader when the Logger is loaded, because the
// Logger gets imported by the ScriptLoader itself on startup.
let ScriptLoader = null;


/**
 * Provides logging methods
 */
let Logger = (function() {

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
  let rpPrefBranch = null;

  // initially, enable logging. later the logging preferences of the user will
  // will be loaded.
  let enabled = true;
  // These can be set to change logging level, what types of messages are
  // logged, and to enable/disable logging.
  let level = self.LEVEL_INFO;
  let types = self.TYPE_ALL;

  function updateLoggingSettings(rp) {
    enabled = rpPrefBranch.getBoolPref("log");
    level = rpPrefBranch.getIntPref("log.level");
    types = rpPrefBranch.getIntPref("log.types");
  }

  let prefObserver = {
    observe: function(subject, topic, data) {
      if (topic == "nsPref:changed") {
        updateLoggingSettings();
      }
    }
  };

  function displayMessageNotInitiallized() {
    dump("[RequestPolicy] [INFO] [INTERNAL] preferences are not available " +
         "yet, so logging is still enabled.\n");
  }

  function init() {
    if (!ScriptLoader) {
      // try to import the ScriptLoader
      try {
        // We can't import the ScriptLoader when the Logger is loaded, because
        // the Logger gets imported by the ScriptLoader itself on startup.
        let mod = {};
        Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm", mod);
        ScriptLoader = mod.ScriptLoader;
      } catch (e) {
        ScriptLoader = null;
        displayMessageNotInitiallized();
        return;
      }
    }
    let prefScope = ScriptLoader.importModule("prefs");
    if (!("rpPrefBranch" in prefScope)) {
      displayMessageNotInitiallized();
      return;
    }
    rpPrefBranch = prefScope.rpPrefBranch;
    initialized = true;
    rpPrefBranch.addObserver("log", prefObserver, false);
    updateLoggingSettings();
  }




  function doLog(aLevel, aType, aMessage, aError) {
    if (!initialized) {
      init();
    }

    if (enabled && aLevel >= level && types & aType) {
      let levelName = self._LEVEL_NAMES[aLevel.toString()];
      let typeName = self._TYPE_NAMES[aType.toString()];

      let stack = (aError && aError.stack) ?
                  ", stack was:\n" + aError.stack : "";
      self.printFunc("[RequestPolicy] [" + levelName + "] [" + typeName + "] "
          + aMessage + stack + "\n");

      if (aError) {
        // if an error was provided, report it to the browser console
        Cu.reportError(aError);
      }

      // TODO: remove the following after finishing e10s
      if (aLevel == self.LEVEL_SEVERE && aType == self.TYPE_ERROR) {
        let windowtype = 'navigator:browser';
        let mostRecentWindow  = Services.wm.getMostRecentWindow(windowtype);

        if (mostRecentWindow) {
          mostRecentWindow.alert("Sorry, RequestPolicy crashed! " + aMessage);
        }
      }
    }
  }



  self.severe = doLog.bind(self, self.LEVEL_SEVERE);
  self.severeError = doLog.bind(self, self.LEVEL_SEVERE, self.TYPE_ERROR);
  self.warning = doLog.bind(self, self.LEVEL_WARNING);
  self.info = doLog.bind(self, self.LEVEL_INFO);
  self.debug = doLog.bind(self, self.LEVEL_DEBUG);
  self.dump = doLog.bind(self, self.LEVEL_DEBUG, self.TYPE_INTERNAL);

  self.vardump = function(obj, name, ignoreFunctions) {
    if (name != undefined) {
      self.dump(name + " : " + obj);
    } else {
      self.dump(obj);
    }
    for (var i in obj) {
      try {
        if (typeof obj[i] == 'function') {
          if (!ignoreFunctions) {
            self.dump("    => key: " + i + " / value: instanceof Function");
          }
        } else {
          self.dump("    => key: " + i + " / value: " + obj[i]);
        }
      } catch (e) {
        self.dump("    => key: " + i + " / value: [unable to access value]");
      }
    }
  }


  return self;
}());
