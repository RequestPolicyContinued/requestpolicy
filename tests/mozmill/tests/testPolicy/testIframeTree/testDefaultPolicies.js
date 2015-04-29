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

var {
  DefaultPolicyManager,
  makeDefaultPolicyIterator
} = require("../lib/default-policy-iterator");
var {Iframe, allIframesOnDocument} = require("../lib/iframe");

const TEST_URL = "http://www.maindomain.test/iframe_3.html";


var setupModule = function(aModule) {
  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();
}

var teardownModule = function(aModule) {
  prefs.preferences.clearUserPref(rpConst.PREF_DEFAULT_ALLOW);
  prefs.preferences.clearUserPref(rpConst.PREF_DEFAULT_ALLOW_SAME_DOMAIN);
  aModule.tabBrowser.closeAllTabs();
}


var testDefaultPolicies = function() {
  controller.open(TEST_URL);
  controller.waitForPageLoad();

  for (let defaultPolicySetting of makeDefaultPolicyIterator()) {
    DefaultPolicyManager.dumpState();

    // reload the page with the new preferences
    controller.refresh();
    controller.waitForPageLoad();

    let doc = controller.window.content.document;
    for (let iframe of allIframesOnDocument(doc)) {
      iframe.doChecks();
    }
  }
}
