/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2014 Martin Kimmerle
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

import {XULUtils} from "lib/utils/xul";
import {loadOverlayIntoWindow} from "ui/overlay.js";
import {loadMenuIntoWindow} from "ui/menu.js";
import {loadClassicmenuIntoWindow} from "ui/classicmenu.js";

// =============================================================================
// OverlayController
// =============================================================================

export var OverlayController = (function() {
  let self = {};

  self.loadIntoWindow = function(window) {
    // create a scope variable
    window.rpcontinued = {};

    loadOverlayIntoWindow(window);
    loadMenuIntoWindow(window);
    loadClassicmenuIntoWindow(window);

    // add all XUL elements
    XULUtils.addTreeElementsToWindow(window, "mainTree");

    // init() assumes that all XUL elements are ready
    window.rpcontinued.overlay.init();
  };

  self.unloadFromWindow = function(window) {
    // the overlay cares itself about shutdown.

    // remove all XUL elements
    XULUtils.removeTreeElementsFromWindow(window, "mainTree");

    // Remove the scope variable.
    // This wouldn't be needed when the window is closed, but this has to be
    // done when RP is being disabled.
    delete window.rpcontinued;
  };

  return self;
}());
