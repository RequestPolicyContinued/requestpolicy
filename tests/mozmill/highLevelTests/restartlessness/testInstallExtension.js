/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var addons = require(rootDir + "lib/addons");
var prefs = require(rootDir + "lib/prefs");

var amUtils = require("lib/addon-manager-utils");

const BASE_URL = collector.addHttpResource(rpRootDir + "data/");
const XPI_URL = BASE_URL + "dist/requestpolicy-unit-testing.xpi";


function setupModule(aModule) {
  aModule.controller = mozmill.getBrowserController();
  aModule.addonsManager = new addons.AddonsManager(aModule.controller);
  aModule.amHelper = new amUtils.AMHelper(aModule.controller,
                                          aModule.addonsManager);
  aModule.amHelper.onSetupModule(aModule);
}

function setupTest(aModule) {
  aModule.amHelper.onSetupTest(aModule);
}

function teardownTest(aModule) {
  aModule.amHelper.onTeardownTest(aModule);
}

function teardownModule(aModule) {
  aModule.amHelper.onTeardownModule(aModule);
}


function testInstallExtension() {
  // Reset the 'welcomeWindowShown' pref so that the setup will be
  // opened the next time the extension is installed.
  prefs.prefBranch.clearUserPref("extensions.requestpolicy.welcomeWindowShown")

  // The setup tab has to be closed for later being sure that
  // *this* installation opened the tab.
  assert.equal(amHelper.getSetupTabIndex(), -1, "The setup tab is closed.");

  amHelper.installAddon(XPI_URL);

  // wait for the setup tab to appear. it might not be there already.
  controller.waitFor(function() {
    return amHelper.getSetupTabIndex() !== -1;
  }, "The setup tab has been opened.");

  amHelper.openOnlyAddonManager();
  amHelper.setCategory("extension");

  var addon = amHelper.getAddon();
  assert.ok(addonsManager.isAddonEnabled({addon: addon}),
            "The addon is enabled");
}
