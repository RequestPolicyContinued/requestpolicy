/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {assert, expect} = require("../../../../../../lib/assertions");
var prefs = require("../../../../../lib/prefs");
var tabs = require("../../../../../lib/tabs");

var rpUtils = require("../../lib/rp-utils");
var rpConst = require("../../lib/constants");

var testURLs = [
  "http://www.maindomain.test/redirect-js-document-location-link.html",
  "http://www.maindomain.test/redirect-links.html"
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


var testLinkClickRedirect = function() {
  let tabIndex = tabBrowser.selectedIndex;

  for (let testURL of testURLs) {
    dump("Visiting " + testURL + ".\n");

    controller.open(testURL);
    controller.waitForPageLoad();

    let len = rpUtils.getNumLinks(controller);

    for (let i = 0; i < len; ++i) {
      dump("Testing link " + i + ".\n");

      controller.open(testURL);
      controller.waitForPageLoad();

      let link = rpUtils.getLink(controller, i);
      let classNode = link.getNode().attributes.class;
      let redirectShouldBeAllowed = classNode ?
          classNode.nodeValue.indexOf("redirectShouldBeAllowed") >= 0 : false;
      let url = link.getNode().href;
      link.click();

      rpUtils.waitForTabLoad(controller, tabBrowser.getTab(0));

      var panel = tabBrowser.getTabPanelElement(tabIndex,
          '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');

      if (redirectShouldBeAllowed) {
        controller.waitFor(function() {
            return controller.window.content.document.location.href !== url;
        }, "The URL in the urlbar has changed.");
        expect.ok(!panel.exists(), "The redirect notification bar is hidden.");
      } else {
        expect.ok(panel.exists(), "The redirect notification bar is displayed.");
      }

      tabBrowser.closeAllTabs();
    }
  }
}
