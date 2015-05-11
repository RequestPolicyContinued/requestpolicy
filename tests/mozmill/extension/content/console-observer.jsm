/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RPC Dev Helper - A helper add-on for RequestPolicy development.
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

let EXPORTED_SYMBOLS = ["ConsoleObserver"];

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

var regEx = /(Error|Warning|Exception)/i;

function isRPException(aMessage) {
  if (aMessage.indexOf("chrome://rpcontinued") === -1 ||
      regEx.test(aMessage) === false) {
    return false;
  }

  if (aMessage.indexOf("jquery.min.js") !== -1) {
    // ignore logs caused by jQuery
    return false;
  }

  return true;
}

/**
 * ConsoleObserver observes all messages sent to the
 * Browser Console and detects errors caused by
 * RequestPolicy.
 */
var ConsoleObserver = (function (self) {
  let numErrors = 0;

  self.getNumErrors = function () {
    return numErrors;
  };

  self.startup = function () {
    numErrors = 0;
    Services.console.registerListener(self);
  };

  self.shutdown = function () {
    Services.console.unregisterListener(self);
  };

  self.observe = function (aSubject) {
    var msg = aSubject.message;

    if (isRPException(msg)) {
      ++numErrors;
      dump("[RequestPolicy] [Browser Console] " + msg + "\n");
    }
  };

  return self;
}({}));
