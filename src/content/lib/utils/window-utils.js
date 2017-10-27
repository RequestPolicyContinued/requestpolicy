/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

import {Storage} from "content/models/storage";

let {PrivateBrowsingUtils} = Cu.import(
    "resource://gre/modules/PrivateBrowsingUtils.jsm", {});

export function getMostRecentWindow(aWindowType = null) {
  return Services.wm.getMostRecentWindow(aWindowType);
}

export const getMostRecentBrowserWindow =
    getMostRecentWindow.bind(null, "navigator:browser");

export function getChromeWindow(aContentWindow) {
  /* eslint-disable new-cap */
  return aContentWindow.top.QueryInterface(Ci.nsIInterfaceRequestor)
                            .getInterface(Ci.nsIWebNavigation)
                            .QueryInterface(Ci.nsIDocShellTreeItem)
                            .rootTreeItem
                            .QueryInterface(Ci.nsIInterfaceRequestor)
                            .getInterface(Ci.nsIDOMWindow);
  /* eslint-enable new-cap */
}

export function getBrowserForWindow(aContentWindow) {
  let win = getChromeWindow(aContentWindow);
  let tabs = getTabsForWindow(win);
  for (let tab of tabs) {
    if (tab.linkedBrowser.contentWindow === aContentWindow.top) {
      return tab.linkedBrowser;
    }
  }
  return null;
}

export function getChromeWindowForDocShell(aDocShell) {
  /* eslint-disable new-cap */
  return aDocShell.QueryInterface(Ci.nsIDocShellTreeItem)
                  .rootTreeItem
                  .QueryInterface(Ci.nsIInterfaceRequestor)
                  .getInterface(Ci.nsIDOMWindow);
  /* eslint-enable new-cap */
}

export function getTabBrowser(aChromeWindow) {
  // bug 1009938 - may be null in SeaMonkey
  return aChromeWindow.gBrowser || aChromeWindow.getBrowser();
}

export function getTabsForWindow(aChromeWindow) {
  return getTabBrowser(aChromeWindow).tabContainer.children;
}

//
// Private Browsing
//

export function isWindowPrivate(aWindow) {
  return PrivateBrowsingUtils.isWindowPrivate(aWindow);
}

/**
 * Should it be possible to add permanent rules in that window?
 *
 * @param {Window} aWindow
 * @return {boolean}
 */
export function mayPermanentRulesBeAdded(aWindow) {
  return isWindowPrivate(aWindow) === false ||
      Storage.get("privateBrowsingPermanentWhitelisting");
}

//
// Window & DOM utilities
//

/**
 * Wait for a window to be loaded and then add a list of Elements „by ID“ to
 * a scope. The scope is optional, but in any case will be returned.
 *
 * @param {Window} aWindow
 * @param {Array<string>} aElementIDs
 * @param {Object?} aScope
 * @param {function?} aCallback
 * @return {Object} the scope of the elements
 */
export function getElementsByIdOnLoad(aWindow, aElementIDs, aScope,
                                      aCallback) {
  let scope = aScope || {};
  let document = aWindow.document;
  let callback = function() {
    aWindow.removeEventListener("load", callback);

    for (let elementName in aElementIDs) {
      scope[elementName] = document.getElementById(aElementIDs[elementName]);
    }
    if (aCallback) {
      aCallback();
    }
  };
  aWindow.addEventListener("load", callback);
  return scope;
}
