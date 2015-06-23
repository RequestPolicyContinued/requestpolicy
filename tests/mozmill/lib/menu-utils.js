/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;


/**
 * @constructor
 * @param {MozMillController} aController
 */
function Menu(aController) {
  this.controller = aController;
  this.window = this.controller.window;
}

/**
 * @return {MozMillElement}
 */
Menu.prototype.getPopup = function () {
  return findElement.ID(this.window.document, "rpc-popup");
};

/**
 * @param {string} aState
 */
Menu.prototype.waitForPopupState = function (aState) {
  var popupNode = this.getPopup().getNode();

  this.controller.waitFor(
      function () {
        return popupNode.state === aState;
      },
      "The menu popup's state (" + popupNode.state +
      ") equals '" + aState + "'.");
};

/**
 * Opens or closes the menu.
 * @param {string} aState
 * @this {Menu}
 */
function ensurePopupState(aState = "closed") {
  var popupNode = this.getPopup().getNode();

  if (popupNode.state === aState) {
    return;
  }

  {
    // actually open or close the menu
    let functionName = (aState === "open" ? "openPopup" : "hidePopup");
    popupNode[functionName]();
  }

  this.waitForPopupState(aState);
};

Menu.prototype.open = function () {
  ensurePopupState.call(this, "open");
};

Menu.prototype.close = function () {
  ensurePopupState.call(this, "closed");
};

exports.Menu = Menu;
