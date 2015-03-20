/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


function setupModule(aModule) {
}

function setupTest(aModule) {
  aModule.controller = mozmill.getBrowserController();

  persisted.nextTest = null;
}

function teardownTest(aModule) {
  if (persisted.nextTest) {
    controller.restartApplication(persisted.nextTest);
  }
}

function teardownModule(aModule) {
  delete persisted.nextTest;
}




function testAddMark() {
  persisted.nextTest = "testMarkHasBeenRemoved";

  controller.window.markForDetectingRestarts = "MARK";
}

function testMarkHasBeenRemoved() {
  assert.ok(typeof controller.window.markForDetectingRestarts === "undefined",
            "The MARK has been removed after a restart.");
}
