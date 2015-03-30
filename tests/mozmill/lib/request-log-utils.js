/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var prefs = require(rootDir + "lib/prefs");
var tabs = require(rootDir + "firefox/lib/tabs");

const TBB_ID = "requestpolicyToolbarButton";


function RequestLog(aController) {
  this.controller = aController;
  this.windowDoc = this.controller.window.document;
}

RequestLog.prototype.open = function () {
  let tbb = findElement.ID(this.windowDoc, TBB_ID);
  // open the menu
  tbb.click();
  // wait for the menu
  let popup = findElement.ID(this.windowDoc, "rp-popup");
  popup.waitForElement();
  // open the request log
  findElement.ID(this.windowDoc, "rp-link-request-log").click();
  // close the menu
  popup.getNode().hidePopup();
  this.controller.waitFor(function () {
    return popup.getNode().state === "closed";
  }, "The menu has been closed.");

  let iframe = this.windowDoc.getElementById("requestpolicy-requestLog-frame");
  this.requestLogDoc = iframe.contentDocument;
  this.controller.waitForPageLoad(this.requestLogDoc);

  var tree = this.requestLogDoc.getElementById("requestpolicy-requestLog-tree");
  this.treeView = tree.view;
  this.destCol = tree.columns
      .getNamedColumn("requestpolicy-requestLog-destination");
};

RequestLog.prototype.close = function () {
  findElement.ID(this.windowDoc, "requestpolicy-requestLog-close").click();
};

RequestLog.prototype.clear = function () {
  findElement.ID(this.windowDoc, "requestpolicy-requestLog-clear").click();
}


RequestLog.prototype.getDestination = function (aRow) {
  return this.treeView.getCellText(aRow, this.destCol);
};

RequestLog.prototype.getDestinations = function () {
  var destinations = [];
  for (let i = 0, len = this.treeView.rowCount; i < len; ++i) {
    destinations.push(this.getDestination(i));
  }
  return destinations;
};

exports.RequestLog = RequestLog;
