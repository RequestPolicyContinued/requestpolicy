/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global require, mozmill */
/* exported setupModule, teardownModule, testUnknownScheme */

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var tabs = require(rootDir + "firefox/lib/tabs");

var rpUtils = require(rpRootDir + "lib/rp-utils");

var TEST_URL = "http://www.maindomain.test/scheme-unknown-and-without-host.html";


var setupModule = function(aModule) {
  /* global controller, tabBrowser */
  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();
}

var teardownModule = function(aModule) {
  aModule.tabBrowser.closeAllTabs();
}


var testUnknownScheme = function() {
  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let link = rpUtils.getLink(controller);
  link.click();

  rpUtils.waitForTabLoad(controller, tabBrowser.getTab(0));

  var getPanel = () => tabBrowser.getTabPanelElement(0,
      '/{"value":"requestpolicy-scheme-notification"}');

  controller.waitFor(() => getPanel().exists(),
                     "The scheme notification has been displayed.");
}
