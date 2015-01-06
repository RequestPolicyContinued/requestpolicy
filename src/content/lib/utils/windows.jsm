/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

let EXPORTED_SYMBOLS = ["WindowUtils"];




let WindowUtils = (function() {
  let self = {};

  self.getChromeWindow = function(aContentWindow) {
    return aContentWindow.top.QueryInterface(Ci.nsIInterfaceRequestor)
                             .getInterface(Ci.nsIWebNavigation)
                             .QueryInterface(Ci.nsIDocShellTreeItem)
                             .rootTreeItem
                             .QueryInterface(Ci.nsIInterfaceRequestor)
                             .getInterface(Ci.nsIDOMWindow);
  };

  self.getBrowserForWindow = function(aContentWindow) {
    let win = self.getChromeWindow(aContentWindow);
    let tab = win.gBrowser._getTabForContentWindow(aContentWindow.top);
    return tab.linkedBrowser;
  }

  self.getChromeWindowForDocShell = function(aDocShell) {
    return aDocShell.QueryInterface(Ci.nsIDocShellTreeItem)
                    .rootTreeItem
                    .QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIDOMWindow);
  };

  //
  // Private Browsing
  //

  // depending on the Firefox vesion, create the `isWindowPrivate` function
  self.isWindowPrivate = (function() {
    try {
      // Firefox 20+
      Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

      return (function(aWindow) {
        return PrivateBrowsingUtils.isWindowPrivate(aWindow)
      });
    } catch(e) {
      // pre Firefox 20
      try {
        let pbs = Cc["@mozilla.org/privatebrowsing;1"]
            .getService(Ci.nsIPrivateBrowsingService);

        return (function(aWindow) {
          return pbs.privateBrowsingEnabled;
        });
      } catch(e) {
        Components.utils.reportError(e);
        // It's uncertain if private browsing is possible at all, so assume
        // that Private Browsing is not possible.
        return (function(aWindow) {
          return true;
        });
      }
    }
  }());


  //
  // Window & DOM utilities
  //

  /**
   * Wait for a window to be loaded and then add a list of Elements „by ID“ to
   * a scope. The scope is optional, but in any case will be returned.
   *
   * @returns {Object} the scope of the elements
   */
  self.getElementsByIdOnLoad = function(aWindow, aElementIDs, aScope,
                                        aCallback) {
    let scope = aScope || {};
    let document = aWindow.document;
    aWindow.addEventListener("load", function() {
      for (let elementName in aElementIDs) {
        scope[elementName] = document.getElementById(aElementIDs[elementName]);
      }
      if (aCallback) {
        aCallback();
      }
    });
    return scope;
  };

  return self;
}());
