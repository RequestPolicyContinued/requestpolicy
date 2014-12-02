/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var {assert, expect} = require("../../../../../../lib/assertions");
var prefs = require("../../../../../lib/prefs");
var tabs = require("../../../../../lib/tabs");

var rpConst = require("../../lib/constants");

var testURLPrePath = "http://www.maindomain.test/";
var urlsWithRedirect = [
  // [shouldBeAllowed, url]
  [false, "redirect-http-location-header.php"],
  [false, "redirect-http-refresh-header.php"],
  [false, "redirect-js-document-location-auto.html"],
  [false, "redirect-meta-tag-01-immediate.html"],
  [false, "redirect-meta-tag-02-delayed.html"],
  [false, "redirect-meta-tag-03-multiple.html"],
  [false, "redirect-meta-tag-08.html"],

  [true, "redirect-meta-tag-04-relative-without-slash.html"],
  [true, "redirect-meta-tag-05-relative-with-slash.html"],
  [true, "redirect-meta-tag-06-different-formatting.html"],
  [true, "redirect-meta-tag-07-different-formatting-delayed.html"],
  [true, "redirect-meta-tag-09-relative.html"]
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


var testAutoRedirect = function() {
  var tabIndex = tabBrowser.selectedIndex;

  var panel = tabBrowser.getTabPanelElement(tabIndex,
      '/{"value":"' + rpConst.REDIRECT_NOTIFICATION_VALUE + '"}');

  for (let [shouldBeAllowed, testURL] of urlsWithRedirect) {
    testURL = testURLPrePath + testURL;
    dump("Testing " + testURL + ". The redirect should be " +
         (shouldBeAllowed ? "allowed" : "blocked") + ".\n");

    controller.open(testURL);
    controller.waitForPageLoad();

    if (shouldBeAllowed) {
      controller.waitFor(function() {
          return controller.window.content.document.location.href !== testURL;
      }, "The URL in the urlbar has changed.");
      expect.ok(!panel.exists(), "The redirect notification bar is hidden.");
    } else {
      expect.ok(panel.exists(), "The redirect notification bar is displayed.");
      expect.ok(controller.window.content.document.location.href === testURL,
                "The URL in the urlbar hasn't changed.");
    }

    tabBrowser.closeAllTabs();

    // the following sleep is a workaround against the error:
    // *************************
    // A coding exception was thrown in a Promise resolution callback.
    // See https://developer.mozilla.org/Mozilla/JavaScript_code_modules/Promise.jsm/Promise
    //
    // Full message: TypeError: this.options is undefined
    // Full stack: Capture.prototype.start@resource://gre/modules/BackgroundPageThumbs.jsm:289:19
    // BackgroundPageThumbs._processCaptureQueue@resource://gre/modules/BackgroundPageThumbs.jsm:222:5
    // BackgroundPageThumbs.capture@resource://gre/modules/BackgroundPageThumbs.jsm:73:5
    // (...)
    controller.sleep(100);
  }
}
