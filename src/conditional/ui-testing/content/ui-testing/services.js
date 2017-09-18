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

import {Environment, MainEnvironment} from "lib/environment";

//==============================================================================
// ErrorTriggeringService
//==============================================================================

var ErrorTriggeringService = createErrorTriggeringService();
ErrorTriggeringService.bootstrap();

/**
 * Triggers errors for a RequestPolicy UI test.
 * It's used to test Error Detection from the UI tests.
 */
function createErrorTriggeringService() {
  let self = {};

  const isMainEnvironment =
      typeof browser.extension.getBackgroundPage === "function";
  const where = isMainEnvironment ? "backgroundscript" : "contentscript";
  const topic = "requestpolicy-trigger-error-" + where;

  const observer = {
    observe(aSubject, aTopic, aData) {
      let [type, message] = splitColon(aData);

      if (type === "error") {
        console.error(message);
      } else if (type === "ReferenceError") {
        runAsync(produceReferenceError);
      }
    },
  };

  self.bootstrap = function() {
    MainEnvironment.addStartupFunction(Environment.LEVELS.BACKEND,
        self.startup);
    MainEnvironment.addShutdownFunction(Environment.LEVELS.BACKEND,
        self.shutdown);
  };

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

  function produceReferenceError() {
    var localVar = nonexistantVariable; // jshint ignore:line
  }

  function runAsync(aFunction) {
    var runnable = {run: aFunction};
    Services.tm.currentThread.dispatch(runnable,
        Ci.nsIEventTarget.DISPATCH_NORMAL);
  }

  return self;
}
