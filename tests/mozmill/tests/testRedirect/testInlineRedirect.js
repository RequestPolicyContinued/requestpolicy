/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {assert, expect} = require("../../../../../../lib/assertions");
var prefs = require("../../../../../lib/prefs");
var tabs = require("../../../../../lib/tabs");

var rpUtils = require("../../lib/rp-utils");
var rpConst = require("../../lib/constants");

var testURLPrePath = "http://www.maindomain.test/";
var urlsWithInlineRedirect = [
  "redirect-inline-image.html",
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


/**
 * This test ensures that the redirection notification bar is *not* shown when
 * an inline element such as <img> has caused a redirect.
 */
var testInlineRedirect = function() {
  var tabIndex = tabBrowser.selectedIndex;

  var panel = tabBrowser.getTabPanelElement(tabIndex,
      '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');

  for (let testURL of urlsWithInlineRedirect) {
    testURL = testURLPrePath + testURL;
    controller.open(testURL);

    controller.waitForPageLoad();
    controller.sleep(1000);

    expect.ok(!panel.exists(), "The redirect notification bar is hidden.");

    tabBrowser.closeAllTabs();

    // It's necessary to wait for the notification panel to be closed. If we
    // don't wait for that to happen, the next URL in urlsWithInlineRedirect
    // might already be displayed while the panel is still there.
    controller.waitFor((() => !panel.exists()), "No panel is being displayed " +
                       "because all tabs have been closed.");
  }
}
