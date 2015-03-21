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

const TBB_ID = "requestpolicyToolbarButton";
var TEST_URL = "http://www.maindomain.test/scheme-unknown-and-without-host.html";


var setupModule = function(aModule) {
  /* global controller, tabBrowser */
  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();

  let tbb = findElement.ID(aModule.controller.window.document, TBB_ID);
  // open the menu
  tbb.click();
  // wait for the menu
  findElement.ID(controller.window.document, "rp-popup").waitForElement();
  // open the request log
  findElement.ID(controller.window.document, "rp-link-request-log").click();
  // close the menu
  tbb.click();

  aModule.requestLogDoc = aModule.controller.window.document
      .getElementById("requestpolicy-requestLog-frame").contentDocument;
  aModule.controller.waitForPageLoad(aModule.requestLogDoc);

  aModule.clearButton = findElement.ID(aModule.controller.window.document,
                                       "requestpolicy-requestLog-clear");
  aModule.clearButton.click();

  var tree = aModule.requestLogDoc
      .getElementById("requestpolicy-requestLog-tree")
  aModule.treeView = tree.view;
  aModule.destCol = tree.columns
      .getNamedColumn("requestpolicy-requestLog-destination");
}

var teardownModule = function(aModule) {
  let closeButton = findElement.ID(aModule.controller.window.document,
                                   "requestpolicy-requestLog-close");
  closeButton.click();
  aModule.tabBrowser.closeAllTabs();
}


function getDestination(aRow) {
  return treeView.getCellText(aRow, destCol);
}

function getDestinations() {
  var destinations = [];
  for (let i = 0, len = treeView.rowCount; i < len; ++i) {
    destinations.push(getDestination(i));
  }
  return destinations;
}

function countDestination(aCompareValue) {
  return getDestinations().filter(function (aValue) {
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
