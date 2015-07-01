/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var addons = require(rootDir + "lib/addons");

var amUtils = require("lib/addon-manager-utils");


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


function testEnableExtension() {
  amHelper.openOnlyAddonManager();
  addonsManager.setCategoryById({id: "extension"});

  var addon = amHelper.getAddon();

  assert.ok(addonsManager.isAddonEnabled({addon: addon}) === false,
            "The addon is disabled");

  // Enable the addon
  addonsManager.enableAddon({addon: addon});

  assert.ok(addonsManager.isAddonEnabled({addon: addon}),
            "The addon has been enabled");
}
