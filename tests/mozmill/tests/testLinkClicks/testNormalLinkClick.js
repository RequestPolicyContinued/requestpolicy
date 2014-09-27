/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {assert, expect} = require("../../../../../../lib/assertions");
var prefs = require("../../../../../lib/prefs");
var tabs = require("../../../../../lib/tabs");
var utils = require("../../../../../../lib/utils");

var rpUtils = require("../../lib/rp-utils");
var rpConst = require("../../lib/constants");

const TEST_URL = "http://www.maindomain.test/link_1.html";


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


var testNormalLinkClick = function() {
  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let link = getLink();
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


/**
 * @return {MozMillElement} The link to click on.
 */
var getLink = function() {
  let links = controller.window.content.document.getElementsByTagName("a");
  assert.notEqual(links.length, 0, "A link has been found on the test page.");

  return findElement.Elem(links[0]);
}
