/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {assert, expect} = require("../../../../../../lib/assertions");
var prefs = require("../../../../../lib/prefs");
var tabs = require("../../../../../lib/tabs");

var rpConst = require("../../lib/constants");

var testURLs = [
  "http://www.maindomain.test/redirect-http-location-header.php",
  "http://www.maindomain.test/redirect-http-refresh-header.php",
  "http://www.maindomain.test/redirect-js-document-location-auto.html"
];


var setupModule = function(aModule) {
  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();

  prefs.preferences.setPref(rpConst.PREF_DEFAULT_ALLOW, false);
}

var teardownModule = function(aModule) {
  prefs.preferences.clearUserPref(rpConst.PREF_DEFAULT_ALLOW);
  aModule.tabBrowser.closeAllTabs();
}


var testOpenInCurrentTab = function() {
  var tabIndex = tabBrowser.selectedIndex;

  var panel = tabBrowser.getTabPanelElement(tabIndex,
      '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');

  for (let testURL of testURLs) {
    dump("Testing " + testURL + "\n");

    controller.open(testURL);
    controller.waitForPageLoad();

    assert.ok(panel.exists(), "The redirect has been blocked.");

    tabBrowser.closeAllTabs();
  }
}
