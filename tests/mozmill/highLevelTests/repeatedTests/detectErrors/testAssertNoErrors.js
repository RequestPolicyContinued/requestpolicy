/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var {assert, expect} = require(rootDir + "lib/assertions");
var prefs = require(rootDir + "lib/prefs");

Components.utils.import("chrome://rp-observer/content/console-observer.jsm");



function setupModule(aModule) {
}

function teardownModule(aModule) {
}


function testAssertNoErrors() {
  const prefName = "extensions.requestpolicy.unitTesting.errorCount";
  assert.equal(prefs.getPref(prefName, -1), 0,
               "No error has been logged in RequestPolicy so far.");

  assert.equal(ConsoleObserver.getNumErrors(), 0,
               "The Console Observer didn't register any error or " +
               "warning so far.");
}
