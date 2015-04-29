/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global require, mozmill */
/* exported setupModule, teardownModule, testUnknownScheme */

var rpRootDir = "../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var tabs = require(rootDir + "firefox/lib/tabs");

var rpUtils = require(rpRootDir + "lib/rp-utils");
var requestLogUtils = require(rpRootDir + "lib/request-log-utils");

var TEST_URL = "http://www.maindomain.test/scheme-unknown-and-without-host.html";


var setupModule = function (aModule) {
  /* global controller, tabBrowser */
  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();

  aModule.requestLog = new requestLogUtils.RequestLog(aModule.controller);
  aModule.requestLog.open();
  aModule.requestLog.clear();
}

var teardownModule = function (aModule) {
  aModule.requestLog.close();
  aModule.tabBrowser.closeAllTabs();
}


function countDestination(aCompareValue) {
  return requestLog.getDestinations().filter(function (aValue) {
    return aCompareValue === aValue;
  }).length;
}


/**
 * Test that the request log will display URIs without
 * a host.
 */
var testRequestLogShowsUriWithoutHost = function() {
  controller.open(TEST_URL);
  controller.waitForPageLoad();

  let link = rpUtils.getLink(controller);
  let linkURI = link.getNode().href;

  assert.equal(countDestination(linkURI), 0,
               "There is no entry in the request log with '" + linkURI +
               "' as the destination.");

  link.click();

  assert.equal(countDestination(linkURI), 1,
               "There is exactly one entry in the request log with '" +
               linkURI + "' as the destination.");
}
