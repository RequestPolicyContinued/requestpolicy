/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RPC Dev Helper - A helper add-on for RequestPolicy development.
 * Copyright (c) 2016 Martin Kimmerle
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

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

this.EXPORTED_SYMBOLS = ["LoggingObserver"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

//==============================================================================
// LoggingObserver
//==============================================================================

/**
 * LoggingObserver observes all logs sent by RP's Logger module.
 */
var LoggingObserver = (function () {
  let self = {};

  let messages = [];

  let prefBranch;

  self.getNumErrors = function () {
    return prefBranch.getIntPref("unitTesting.loggingErrors.counter");
  };

  self.getMessages = function () {
    return messages;
  };

  function setNumErrors(aN) {
    prefBranch.setIntPref("unitTesting.loggingErrors.counter", aN);
    Services.prefs.savePrefFile(null);
  };

  self.reset = function () {
    setNumErrors(0);
    messages = [];
  };

  self.startup = function () {
    prefBranch = Services.prefs.getBranch("extensions.requestpolicy.").
        QueryInterface(Ci.nsIPrefBranch2);
    Services.obs.addObserver(self, "requestpolicy-log-error", false);
  };

  self.shutdown = function () {
    Services.obs.removeObserver(self, "requestpolicy-log-error");
    prefBranch = undefined;
  };

  self.observe = function (aSubject, aTopic, aData) {
    switch (aTopic) {
      case "requestpolicy-log-error":
        setNumErrors(self.getNumErrors() + 1);
        messages.push(aData);
        break;

      default:
        break;
    }
  };

  return self;
}());
