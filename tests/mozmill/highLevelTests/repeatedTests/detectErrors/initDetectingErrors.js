/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var {assert, expect} = require(rootDir + "lib/assertions");
var prefs = require(rootDir + "lib/prefs");

Components.utils.import("resource://gre/modules/Services.jsm");


function setupModule(aModule) {
}

function teardownModule(aModule) {
}


function testInitDetectingErros() {
  prefs.setPref("extensions.requestpolicy.unitTesting.errorCount", 0);
  Services.prefs.savePrefFile(null);
}
