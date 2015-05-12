/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var menuUtils = require(rpRootDir + "lib/menu-utils");

var prefs = require(rootDir + "lib/prefs");
var tabs = require(rootDir + "firefox/lib/tabs");


function RequestLog(aController) {
  this.controller = aController;
  this.windowDoc = this.controller.window.document;
}

RequestLog.prototype.open = function () {
  {
    let menu = new menuUtils.Menu(this.controller);
    menu.open();

    // open the request log
    findElement.ID(this.windowDoc, "rpc-link-request-log").click();

    // close the menu
    menu.close();
  }

  let iframe = this.windowDoc.getElementById("requestpolicy-requestLog-frame");
  this.requestLogDoc = iframe.contentDocument;
  this.controller.waitForPageLoad(this.requestLogDoc);

  var tree = this.requestLogDoc.getElementById("requestpolicy-requestLog-tree");
  this.treeView = tree.view;

  this.originCol = tree.columns
      .getNamedColumn("requestpolicy-requestLog-origin");
  this.destCol = tree.columns
      .getNamedColumn("requestpolicy-requestLog-destination");
  this.blockedCol = tree.columns
      .getNamedColumn("requestpolicy-requestLog-blocked");
  this.timeCol = tree.columns
      .getNamedColumn("requestpolicy-requestLog-time");
};

RequestLog.prototype.close = function () {
  findElement.ID(this.windowDoc, "requestpolicy-requestLog-close").click();
};

RequestLog.prototype.clear = function () {
  findElement.ID(this.windowDoc, "requestpolicy-requestLog-clear").click();
};


RequestLog.prototype.getOrigin = function (aRow) {
  return this.treeView.getCellText(aRow, this.originCol);
};

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

RequestLog.prototype.hasBeenAllowed = function (aRow) {
  let imageSrc = this.treeView.getImageSrc(aRow, this.blockedCol);
  return imageSrc !== "chrome://rpcontinued/skin/dot.png";
};

RequestLog.prototype.getRow = function(aRow) {
  return {
    origin: this.getOrigin(aRow),
    destination: this.getDestination(aRow),
    hasBeenAllowed: this.hasBeenAllowed(aRow)
  };
};

RequestLog.prototype.getRowsByDestination = function (aDestination) {
  let rows = [];
  for (let i = 0, len = this.treeView.rowCount; i < len; ++i) {
    if (this.getDestination(i) === aDestination) {
      rows.push(this.getRow(i));
    }
  }
  return rows;
};

exports.RequestLog = RequestLog;
