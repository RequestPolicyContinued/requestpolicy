/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

let EXPORTED_SYMBOLS = ["DOMUtils"];

let DOMUtils = {};

/**
 * Function that takes a DOM Element or an Array of DOM elements and removes
 * all their children.
 */
DOMUtils.removeChildren = function(aElement) {
  if (aElement instanceof Array) {
    // if aElement is an Array, recursively call `DOMUtils.removeChildren` on
    // its elements
    while (aElement.length > 0) {
      DOMUtils.removeChildren(aElement.pop())
    }
  } else {
    while (aElement.firstChild) {
      aElement.removeChild(aElement.firstChild);
    }
  }
};
