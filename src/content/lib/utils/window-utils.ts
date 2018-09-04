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

import { XPCOM, XUL } from "bootstrap/api/interfaces";

declare const Ci: XPCOM.nsXPCComponents_Interfaces;

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
    "getBrowser" in aChromeWindow && aChromeWindow.getBrowser()
  ) || null;
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

export function getDOMWindowUtils(
    window: XUL.chromeWindow | XUL.contentWindow,
) {
  return window.
      QueryInterface<XPCOM.nsIInterfaceRequestor>(Ci.nsIInterfaceRequestor).
      getInterface<XPCOM.nsIDOMWindowUtils>(Ci.nsIDOMWindowUtils);
}

export function getWindowId(window: XUL.chromeWindow): number {
  const domWindowUtils = getDOMWindowUtils(window);
  return domWindowUtils.outerWindowID;
}

export function getDOMWindowFromXULWindow(
  xulWindow: XPCOM.nsIXULWindow,
): XPCOM.nsIDOMWindow {
  return xulWindow.
      QueryInterface<XPCOM.nsIInterfaceRequestor>(
          Ci.nsIInterfaceRequestor,
      ).
      getInterface<XPCOM.nsIDOMWindow>(Ci.nsIDOMWindow);
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

export function getWindowtype(
    aWindow: XUL.chromeWindow,
): string | null {
  return aWindow.document.documentElement.getAttribute("windowtype");
}
