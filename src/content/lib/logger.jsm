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

/**
 * Provides logging methods
 */
let Logger = (function() {
  // private variables and functions

  function doLog(level, type, message, e) {
    if (self.enabled && level >= self.level && self.types & type) {
      let levelName = self._LEVEL_NAMES[level.toString()];
      let typeName = self._TYPE_NAMES[type.toString()];

      let stack = (e && e.stack) ? ", stack was:\n" + e.stack : "";
      self.printFunc("[RequestPolicy] [" + levelName + "] [" + typeName + "] "
          + message + stack + "\n");

      if (level == self.LEVEL_SEVERE && type == self.TYPE_ERROR) {
        let windowtype = 'navigator:browser';
        let mostRecentWindow  = Services.wm.getMostRecentWindow(windowtype);

        if (mostRecentWindow) {
          mostRecentWindow.alert("Sorry, RequestPolicy crashed! " + message);
        }
      }
    }
  }



  let self = {
    // public attributes and methods

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

  // These can be set to change logging level, what types of messages are
  // logged, and to enable/disable logging.
  self.level = self.LEVEL_INFO;
  self.types = self.TYPE_ALL;
  // enable logging before RP finished initializing
  self.enabled = true;

  // function to use to print out the log
  self.printFunc = dump;

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
