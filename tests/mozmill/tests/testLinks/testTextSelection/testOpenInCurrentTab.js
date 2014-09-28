/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {assert, expect} = require("../../../../../../../lib/assertions");
var prefs = require("../../../../../../lib/prefs");
var tabs = require("../../../../../../lib/tabs");

var rpUtils = require("../../../lib/rp-utils");
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
  aModule.tabBrowser.closeAllTabs();
}


var testOpenInCurrentTab = function() {
  var tabIndex = tabBrowser.selectedIndex;

  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let textURL = findElement.ID(controller.window.document, "text_url_1");
  let textURLValue = textURL.getNode().textContent;

  rpUtils.selectText(tabBrowser, textURLValue);

  // perform right-click and entry selection
  var contextMenu = controller.getMenu("#contentAreaContextMenu");
  contextMenu.select("#context-openlinkincurrent", textURL);

  rpUtils.waitForTabLoad(controller, tabBrowser.getTab(tabIndex));

  var panel = tabBrowser.getTabPanelElement(tabIndex,
      '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');
  assert.ok(false === panel.exists(),
      "Following the URL didn't cause a redirect");

  assert.equal(controller.tabs.activeTab.location.href, textURLValue,
      "The location is correct.");
}
