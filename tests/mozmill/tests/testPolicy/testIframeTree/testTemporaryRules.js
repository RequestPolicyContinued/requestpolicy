/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var {assert, expect} = require(rootDir + "lib/assertions");
var prefs = require(rootDir + "firefox/lib/prefs");
var tabs = require(rootDir + "firefox/lib/tabs");

var rpUtils = require(rpRootDir + "lib/rp-utils");
var {DomainUtil} = require(rpRootDir + "lib/domain-util");

var {
  DefaultPolicyManager,
  makeDefaultPolicyIterator
} = require("../lib/default-policy-iterator");
var {
  TemporaryRuleManager,
  TemporaryRuleIterator
} = require("../lib/temporary-rule-iterator");
var {NumRequestsCounter} = require("../lib/num-request-counter");
var {allIframesOnDocument, recursivelyGetAllDocs} = require("../lib/iframe");

const TEST_URL = "http://www.maindomain.test/iframe_3.html";


var setupModule = function(aModule) {
  prefs.preferences.setPref(rpConst.PREF_MENU_SHOW_NUM_REQUESTS, true);
  prefs.preferences.setPref(rpConst.PREF_AUTO_RELOAD, false);

  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();
}

var teardownModule = function(aModule) {
  prefs.preferences.clearUserPref(rpConst.PREF_DEFAULT_ALLOW);
  prefs.preferences.clearUserPref(rpConst.PREF_DEFAULT_ALLOW_SAME_DOMAIN);
  prefs.preferences.clearUserPref(rpConst.PREF_MENU_SHOW_NUM_REQUESTS);
  prefs.preferences.clearUserPref(rpConst.PREF_AUTO_RELOAD);
  aModule.tabBrowser.closeAllTabs();
}




var testTemporaryRules = function() {
  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let itDefaultPolicy = makeDefaultPolicyIterator();
  while (!itDefaultPolicy.next().done) {
    DefaultPolicyManager.dumpState();

    // reload the page with the new preferences
    controller.refresh();
    controller.waitForPageLoad();

    let itTemporaryRules = new TemporaryRuleIterator(
        controller.window.content.document);
    itTemporaryRules.start();
    do {
      let numRequestsCounter = new NumRequestsCounter(controller);

      // reload the page with the new preferences
      controller.refresh();
      controller.waitForPageLoad();

      let mainDoc = controller.window.content.document;
      for (let iframe of allIframesOnDocument(mainDoc)) {
        iframe.doChecks();
        iframe.accumulateNumRequests(numRequestsCounter);
      }
      for (let doc of recursivelyGetAllDocs(mainDoc)) {
        numRequestsCounter.accumulateNonIframeRequests(doc);
      }

      numRequestsCounter.checkIfIsCorrect();
    } while (itTemporaryRules.next());
  }
}
