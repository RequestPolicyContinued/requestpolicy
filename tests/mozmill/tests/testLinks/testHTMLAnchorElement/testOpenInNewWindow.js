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
  aModule.otherController = null;

  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();
  aModule.otherTabBrowser = null;

  prefs.setPref(rpConst.PREF_DEFAULT_ALLOW, false);
};

var teardownModule = function(aModule) {
  prefs.clearUserPref(rpConst.PREF_DEFAULT_ALLOW);
  utils.closeContentAreaContextMenu(aModule.controller);
  aModule.tabBrowser.closeAllTabs();

  closeWindow(aModule.otherController);
};

var testOpenInNewWindow = function () {
  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let link = rpUtils.getLink(controller);
  let linkURL = link.getNode().href;

  let i = 1;
  while (true === openNextWindow(i, link)) {
    assert.waitFor(function () {
      // Make sure that we work on the correct window
      var windows = mozmill.utils.getWindows("navigator:browser");
      for (var j = 0; j < windows.length; ++j) {
        if (windows[j] !== controller.window) {
          otherController = new mozmill.controller.MozMillController(windows[j]);
          otherTabBrowser = new tabs.tabBrowser(otherController);
          break;
        }
      }

      return !!otherController;
    }, "Newly opened browser window has been found.");

    rpUtils.waitForTabLoad(controller, otherTabBrowser.getTab(0));

    assert.equal(otherController.tabs.activeTab.location.href, linkURL,
        "The location in the new window is correct.");

    assertNoRedirects();
    closeWindow(otherController);
    otherController = null;
    otherTabBrowser = null;
    ++i;
  }
};

var closeWindow = function(_controller) {
  if (_controller && _controller.window) {
    _controller.window.close();
  }
};



/**
 * Opens the next tab.
 * @return {boolean}
 *         true if a new tab has been opened.
 *         false if no tab needs to open anymore.
 */
var openNextWindow = function(i, link) {
  var contextMenuItemID;

  switch (i) {
    case 1:
      // Context Menu: Open Link in New Window
      contextMenuItemID = "#context-openlink";
      break;

    case 2:
      // Context Menu: Open Link in New Private Window
      contextMenuItemID = "#context-openlinkprivate";
      break;

    default:
      return false;
      break;
  }

  // There seems to be a bug in Mozmill: the right-click is not performed the
  // second time. The workaround seems to be to wait for some miliseconds before
  // continuing. I set the timeout to 100 ms. If this time is still not enough
  // for anybody, simply increase it.
  // It seemed that this bug has to do with the focus. However, the
  // HTMLElement.blur() function doesn't work for <a> Elements.
  controller.sleep(100);

  var contextMenu = controller.getMenu("#contentAreaContextMenu");
  contextMenu.select(contextMenuItemID, link);
  return true;
};

/**
 * Assert that the link clicks have not been detected as redirects.
 */
var assertNoRedirects = function() {
  var tabBrowsers = [tabBrowser, otherTabBrowser];

  for (let i = 0; i < tabBrowsers.length; ++i) {
    var panel = tabBrowsers[i].getTabPanelElement(0,
        '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');
    assert.ok(false === panel.exists(),
        "Following the link didn't cause a redirect");
  }
};
