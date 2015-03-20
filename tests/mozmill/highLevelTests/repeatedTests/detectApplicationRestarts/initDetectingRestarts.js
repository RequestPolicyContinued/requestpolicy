/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("chrome://rp-observer/content/restart-detection-helper.jsm");


function setupModule(aModule) {
}

function teardownModule(aModule) {
}


function testInitAssertNoRestart() {
  RestartDetectionHelper.mark = "MARK";
}
