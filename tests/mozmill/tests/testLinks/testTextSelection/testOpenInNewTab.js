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
var utils = require(rootDir + "lib/utils");

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
  utils.closeContentAreaContextMenu(aModule.controller);
  aModule.tabBrowser.closeAllTabs();
}


var testOpenInNewTab = function() {
  var tabIndex = tabBrowser.selectedIndex;

  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let textURL = findElement.ID(controller.window.document, "text_url_1");
  let textURLValue = textURL.getNode().textContent;

  rpUtils.selectText(tabBrowser, textURLValue);

  // perform right-click and entry selection
  var contextMenu = controller.getMenu("#contentAreaContextMenu");
  contextMenu.select("#context-openlinkintab", textURL);

  assert.waitFor(() => { return tabBrowser.length == 2; }, "New Tab opened.");

  rpUtils.waitForTabLoad(controller, tabBrowser.getTab(tabIndex));

  assertNoRedirects();
  assertCorrectLocations(textURLValue);
}

var assertCorrectLocations = function(linkURL) {
  for (let index = 1; index < tabBrowser.length; ++index) {
    tabBrowser.selectedIndex = index;
    assert.equal(controller.tabs.activeTab.location.href, linkURL,
        "The location in the new tab is correct.");
  }
}

/**
 * Assert that the link clicks have not been detected as redirects.
 */
var assertNoRedirects = function() {
  for (let index = 0; index < tabBrowser.length; ++index) {
    var panel = tabBrowser.getTabPanelElement(index,
        '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');
    assert.ok(false === panel.exists(),
        "Following the link didn't cause a redirect");
  }
}
