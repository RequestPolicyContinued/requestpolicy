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

/* global Components */
const {interfaces: Ci, utils: Cu} = Components;

/* exported ConsoleObserver */
this.EXPORTED_SYMBOLS = ["ConsoleObserver"];

/* global dump */

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

//==============================================================================
// utilities
//==============================================================================

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

// jscs:disable maximumLineLength
const knownBugs = [
  // Since Fx 49 (mercurial changeset 0af3c129a366), it's ‘foo’, not 'foo'
  // (unicode U+2019 and U+201A).
  `[JavaScript Warning: "Expected end of value but found '10'.  Error in parsing value for 'font-family'.  Declaration dropped." {file: "chrome://rpcontinued/skin/`,
  // For whatever reason, this does not work ...
  //     `[JavaScript Warning: "Expected end of value but found \u{2019}10\u{201A}.  Error in parsing value for \u{2019}font-family\u{201A}.  Declaration dropped." {file: "chrome://rpcontinued/skin/`,
  // ... so use a regex instead:
  /^\[JavaScript Warning: "Expected end of value but found \W10\W\.  Error in parsing value for \Wfont-family\W\.  Declaration dropped\." {file: "chrome:\/\/rpcontinued\/skin\//,
];
// jscs:enable maximumLineLength

function isKnownBug(aMessage) {
  for (let bugMsg of knownBugs) {
    if (bugMsg instanceof RegExp) {
      if (bugMsg.test(aMessage)) {
        return true;
      }
    } else {
      if (aMessage.startsWith(bugMsg)) {
        return true;
      }
    }
  }
  return false;
}

//==============================================================================
// ConsoleObserver
//==============================================================================

/**
 * ConsoleObserver observes all messages sent to the
 * Browser Console and detects errors caused by
 * RequestPolicy.
 */
var ConsoleObserver = (function() {
  let self = {};

  let messages = [];

  let prefBranch;

  self.getNumErrors = function() {
    return prefBranch.getIntPref("unitTesting.loggingErrors.counter");
  };

  self.getMessages = function() {
    return messages;
  };

  function setNumErrors(aN) {
    prefBranch.setIntPref("unitTesting.loggingErrors.counter", aN);
    Services.prefs.savePrefFile(null);
  }

  self.reset = function() {
    setNumErrors(0);
    messages = [];
  };

  self.startup = function() {
    prefBranch = Services.prefs.getBranch("extensions.requestpolicy.").
        QueryInterface(Ci.nsIPrefBranch2);
    Services.console.registerListener(self);
  };

  self.shutdown = function() {
    Services.console.unregisterListener(self);
    prefBranch = undefined;
  };

  self.observe = function(aSubject) {
    var msg = aSubject.message;

    if (isRPException(msg) && !isKnownBug(msg)) {
      setNumErrors(self.getNumErrors() + 1);
      messages.push(msg);
      dump("[RequestPolicy] [Browser Console] " + msg + "\n");
    }
  };

  return self;
}());
