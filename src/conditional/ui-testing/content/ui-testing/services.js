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

import {Level as EnvLevel, MainEnvironment} from "content/lib/environment";

// =============================================================================
// ErrorTriggeringService
// =============================================================================

const ErrorTriggeringService = createErrorTriggeringService();
ErrorTriggeringService.bootstrap();

/**
 * Triggers errors for a RequestPolicy UI test.
 * It's used to test Error Detection from the UI tests.
 *
 * @return {ErrorTriggeringService}
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
      } else if (type === "ReferenceError:Promise") {
        Promise.resolve().then(() => {
          produceReferenceError();
          return;
        }).catch(e => {
          console.error(e);
        });
      }
    },
  };

  self.bootstrap = function() {
    MainEnvironment.addStartupFunction(EnvLevel.BACKEND,
        self.startup);
    MainEnvironment.addShutdownFunction(EnvLevel.BACKEND,
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
   *
   * @param {string} aString
   * @return {[string, string]}
   */
  function splitColon(aString) {
    const index = aString.indexOf(":");
    if (index === -1) {
      return [aString, ""];
    }
    const part1 = aString.substr(0, index);
    const part2 = aString.substr(index + 1);
    return [part1, part2];
  }

  function produceReferenceError() {
    // eslint-disable-next-line no-unused-vars, no-undef
    const localVar = nonexistantVariable;
  }

  function runAsync(aFunction) {
    const runnable = {run: aFunction};
    Services.tm.currentThread.dispatch(runnable,
        Ci.nsIEventTarget.DISPATCH_NORMAL);
  }

  return self;
}
