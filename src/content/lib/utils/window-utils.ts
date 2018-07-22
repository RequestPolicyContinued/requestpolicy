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

import { App } from "app/interfaces";
import { JSMs, XPCOM, XUL } from "bootstrap/api/interfaces";

const PrivateBrowsingUtils: JSMs.PrivateBrowsingUtils = Cu.import(
    "resource://gre/modules/PrivateBrowsingUtils.jsm", {},
).PrivateBrowsingUtils;

declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Services: JSMs.Services;

export function getMostRecentWindow(aWindowType = null) {
  return Services.wm.getMostRecentWindow(aWindowType);
}

export const getMostRecentBrowserWindow =
    getMostRecentWindow.bind(null, "navigator:browser");

export function getChromeWindow(
    aContentWindow: XUL.contentWindow,
): XUL.chromeWindow {
  return aContentWindow.top.
      QueryInterface<XPCOM.nsIInterfaceRequestor>(Ci.nsIInterfaceRequestor).
      getInterface(Ci.nsIWebNavigation).
      QueryInterface<XPCOM.nsIDocShellTreeItem>(Ci.nsIDocShellTreeItem).
      rootTreeItem.
      QueryInterface<XPCOM.nsIInterfaceRequestor>(Ci.nsIInterfaceRequestor).
      getInterface(Ci.nsIDOMWindow);
}

export function getBrowserForWindow(
    aContentWindow: XUL.contentWindow,
): XUL.browser | null {
  const win = getChromeWindow(aContentWindow);
  const tabs = getTabsForWindow(win) || [];
  for (const tab of tabs) {
    if (tab.linkedBrowser.contentWindow === aContentWindow.top) {
      return tab.linkedBrowser;
    }
  }
  return null;
}

export function getChromeWindowForDocShell(aDocShell: XPCOM.nsIDocShell) {
  return aDocShell.
      QueryInterface<XPCOM.nsIDocShellTreeItem>(Ci.nsIDocShellTreeItem).
      rootTreeItem.
      QueryInterface<XPCOM.nsIInterfaceRequestor>(Ci.nsIInterfaceRequestor).
      getInterface(Ci.nsIDOMWindow);
}

export function getTabBrowser(
    aChromeWindow: XUL.chromeWindow,
): XUL.tabBrowser | null {
  // bug 1009938 - may be null in SeaMonkey
  return aChromeWindow.gBrowser || (
    "getBrowser" in aChromeWindow && aChromeWindow.getBrowser() || null
  );
}

export function getTabsForWindow(
    aChromeWindow: XUL.chromeWindow,
): XUL.tab[] | null {
  const tabBrowser = getTabBrowser(aChromeWindow);
  if (tabBrowser === null) return null;
  return tabBrowser.tabContainer.children;
}

export function contentWindowHasAssociatedTab(
    contentWindow: XUL.contentWindow,
): boolean {
  return getBrowserForWindow(contentWindow) !== null;
}

//
// Private Browsing
//

export function isWindowPrivate(aWindow: XPCOM.nsIDOMWindow) {
  return PrivateBrowsingUtils.isWindowPrivate(aWindow);
}

/**
 * Should it be possible to add permanent rules in that window?
 */
export function mayPermanentRulesBeAdded(
    aWindow: XPCOM.nsIDOMWindow,
    storage: App.storage.ICachedSettings,
): boolean {
  return isWindowPrivate(aWindow) === false ||
      storage.get("privateBrowsingPermanentWhitelisting");
}

//
// Window & DOM utilities
//

/**
 * Wait for a window to be loaded and then add a list of Elements „by ID“ to
 * a scope. The scope is optional, but in any case will be returned.
 */
export function getElementsByIdOnLoad(
    aWindow: XUL.contentWindow,
    aElementIDs: string[],
    aScope?: {[key: string]: any},
    aCallback?: () => void,
): {[key: string]: any} {
  const scope = aScope || {};
  const document = aWindow.document;
  const callback = () => {
    aWindow.removeEventListener("load", callback);

    // tslint:disable-next-line:forin
    for (const elementName in aElementIDs) {
      scope[elementName] = document.getElementById(aElementIDs[elementName]);
    }
    if (aCallback) {
      aCallback();
    }
  };
  aWindow.addEventListener("load", callback);
  return scope;
}
