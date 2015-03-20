/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


function setupModule(aModule) {
  aModule.controller = mozmill.getBrowserController();
}

function teardownModule(aModule) {
}


function testAssertNoRestart() {
  assert.ok(typeof controller.window.markForDetectingRestarts !== "undefined",
            "The MARK still exists, which means the browser did not restart.");
}
