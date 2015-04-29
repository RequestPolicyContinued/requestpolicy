/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var {assert, expect} = require(rootDir + "lib/assertions");
var prefs = require(rootDir + "lib/prefs");
var tabs = require(rootDir + "firefox/lib/tabs");

var rpUtils = require(rpRootDir + "lib/rp-utils");

const TEST_URL = "http://www.maindomain.test/link_1.html";


var setupModule = function(aModule) {
  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();

  prefs.setPref(rpConst.PREF_DEFAULT_ALLOW, false);
}

var teardownModule = function(aModule) {
  prefs.clearUserPref(rpConst.PREF_DEFAULT_ALLOW);
  aModule.tabBrowser.closeAllTabs();
}


var testLinkClick = function() {
  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let link = rpUtils.getLink(controller);
  let linkURL = link.getNode().href;

  link.click();

  rpUtils.waitForTabLoad(controller, tabBrowser.getTab(0));

  var panel = tabBrowser.getTabPanelElement(0,
      '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');
  assert.ok(false === panel.exists(),
      "Following the link didn't cause a redirect");

  assert.equal(controller.tabs.activeTab.location.href, linkURL,
      "The location is correct.");
}
