/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global require, mozmill */
/* exported setupModule, teardownModule, testLinkClickRedirectInNewTab */

var rpRootDir = "../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var {assert, expect} = require(rootDir + "lib/assertions");
var prefs = require(rootDir + "lib/prefs");
var tabs = require(rootDir + "firefox/lib/tabs");

var rpUtils = require(rpRootDir + "lib/rp-utils");

var testURLs = [
  // fixme: as soon as #599 is fixed, uncomment the following line:
  //"http://www.maindomain.test/redirect-js-document-location-link.html",
  "http://www.maindomain.test/redirect-links.html"
];


var setupModule = function(aModule) {
  /* global controller, tabBrowser */
  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();

  prefs.setPref(rpConst.PREF_DEFAULT_ALLOW, false);
};

var teardownModule = function(aModule) {
  prefs.clearUserPref(rpConst.PREF_DEFAULT_ALLOW);
  aModule.tabBrowser.closeAllTabs();
}


function Link(mozmillElement) {
  this.element = mozmillElement;
  this.node = this.element.getNode();

  let classNode = this.node.attributes.class;
  this.redirectShouldBeAllowed = classNode ?
      classNode.nodeValue.indexOf("redirectShouldBeAllowed") >= 0 : false;

  this.href = this.node.href;
}


var testLinkClickRedirectInNewTab = function() {

  testURLs.forEach(function(testURL) {
    controller.open(testURL);
    controller.waitForPageLoad();

    // Create an array of Link() objects, one for each <a>
    // anchor element on the page.
    let links = rpUtils.getLinks(controller)
                       .map((l) => new Link(l));

    assert.ok(links.length > 0,
              "There is at least one link on test page '" + testURL + "'");

    // Test all links by opening them both via context menu and via
    // middle click.
    let testCombinations = rpUtils.combinations([
      links,
      ["contextMenu", "middleClick"]
    ]);

    testCombinations.forEach(function([link, tabOpenMethod], curIndex) {
      let curTabIndex = curIndex + 1;

      openLinkInTab(tabBrowser, link, tabOpenMethod);

      rpUtils.waitForTabLoad(controller, tabBrowser.getTab(curTabIndex));

      expect.ok(!panelExists(0), "The redirect notification bar is not " +
                "displayed on the main tab after opening");

      if (link.redirectShouldBeAllowed) {
        // fixme: find a better waitFor-function that ensures that the part of
        //        RP which is responsible for showing the panel *really* has
        //        finished.
        controller.waitFor(function() {
            return controller.window.content.document.location.href !== link.href;
        }, "The URL in the urlbar has changed.");

        expect.ok(!panelExists(curTabIndex),
                  "The redirect notification bar is hidden.");
      } else {
        controller.waitFor(
            () => panelExists(curTabIndex),
            "The redirect notification bar has been displayed " +
            "for '" + link.href + "' on '" + testURL + "' with tab " +
            "open method '" + tabOpenMethod + "'.");
      }
    });

    tabBrowser.closeAllTabs();
  });
};

function panelExists(index = 0) {
  let panel = tabBrowser.getTabPanelElement(index,
      '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');
  return panel.exists();
}


function openLinkInTab(tabBrowser, link, tabOpenMethod="contextMenu") {
  tabBrowser.openTab({method: tabOpenMethod, target: link.element});
}
