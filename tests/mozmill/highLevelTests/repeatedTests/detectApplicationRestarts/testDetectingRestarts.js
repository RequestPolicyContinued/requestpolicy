/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("chrome://rpc-dev-helper/content/restart-detection-helper.jsm");


function setupModule(aModule) {
}

function setupTest(aModule) {
  aModule.controller = mozmill.getBrowserController();

  persisted.nextTest = null;
}

function teardownTest(aModule) {
  if (persisted.nextTest) {
    aModule.controller.restartApplication(persisted.nextTest);
  }
}

function teardownModule(aModule) {
  delete persisted.nextTest;
}




function testAddMark() {
  persisted.nextTest = "testMarkHasBeenRemoved";

  RestartDetectionHelper.mark = "MARK";
}

function testMarkHasBeenRemoved() {
  assert.ok(RestartDetectionHelper.mark !== "MARK",
            "The MARK has been removed after a restart.");
}
