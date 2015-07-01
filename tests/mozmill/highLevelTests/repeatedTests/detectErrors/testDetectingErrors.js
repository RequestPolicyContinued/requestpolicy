/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var {assert, expect} = require(rootDir + "lib/assertions");
var prefs = require(rootDir + "lib/prefs");

Components.utils.import("chrome://rpcontinued/content/lib/logger.jsm");


function setupModule(aModule) {
}

function teardownModule(aModule) {
}


function testDetectingErrors() {
  let previousValue = getErrorCount();
  assert.notEqual(previousValue, -1, "The pref for the error count exists.");

  Logger.warning(Logger.TYPE_ERROR, "unit test: testDetectingErrors.");
  assert.equal(getErrorCount(), previousValue + 1,
               "The error has been detected.");

  Logger.severe(Logger.TYPE_INTERNAL, "unit test: testDetectingErrors.");
  assert.equal(getErrorCount(), previousValue + 2,
               "The severe log message has been detected.");
}

/**
 * Get the preference. If it doesn't exist, -1 will be returned.
 */
function getErrorCount() {
  const prefName = "extensions.requestpolicy.unitTesting.errorCount";
  return prefs.getPref(prefName, -1);
}
