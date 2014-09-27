/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {assert, expect} = require("../../../../../../../lib/assertions");
var prefs = require("../../../../../../lib/prefs");
var tabs = require("../../../../../../lib/tabs");
var utils = require("../../../../../../../lib/utils");

var rpConst = require("../../../lib/constants");

const TEST_URL = "http://www.maindomain.test/link_1.html";


var setupModule = function(aModule) {
  aModule.controller = mozmill.getBrowserController();

  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();

  prefs.preferences.setPref(rpConst.PREF_DEFAULT_ALLOW, false);
}

var teardownModule = function(aModule) {
  prefs.preferences.clearUserPref(rpConst.PREF_DEFAULT_ALLOW);
  utils.closeContentAreaContextMenu(aModule.controller);
  aModule.tabBrowser.closeAllTabs();
}


var testOpenInBackgroundTab = function() {
  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let link = getLink();
  let linkURL = link.getNode().href;

  let i = 1;
  while (true === openNextTab(i, link)) {
    // Check that i+1 tabs are open
    assert.waitFor(function () {
      return tabBrowser.length === (i + 1);
    }, "Tab " + (i + 1) + " opened.");
    ++i;
  }

  assertCorrectLocations(linkURL);
  assertNoRedirects();
}


/**
 * @return {MozMillElement} The link to click on.
 */
var getLink = function() {
  let links = controller.window.content.document.getElementsByTagName("a");
  assert.notEqual(links.length, 0, "A link has been found on the test page.");

  return findElement.Elem(links[0]);
}

/**
 * Opens the next tab.
 * @return {boolean}
 *         true if a new tab has been opened.
 *         false if no tab needs to open anymore.
 */
var openNextTab = function(i, link) {
  switch (i) {
    case 1:
      // Open another tab by middle-clicking on the link
      tabBrowser.openTab({method: "middleClick", target: link});
      return true;
      break;

    case 2:
      // Open link via context menu in a new tab:
      tabBrowser.openTab({method: "contextMenu", target: link});
      return true;
      break;

    default:
      return false;
      break;
  }
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
