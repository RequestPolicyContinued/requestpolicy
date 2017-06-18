/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

/* global window, document */

window.rpcontinued.classicmenu = (function() {
  var self = {};

  /* global Components */
  const {utils: Cu} = Components;

  let {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  let {Logger} = importModule("lib/logger");
  let {Prefs} = importModule("models/prefs");
  let {StringUtils} = importModule("lib/utils/strings");
  let {DOMUtils} = importModule("lib/utils/dom");

  let rpcontinued = window.rpcontinued;

  //============================================================================

  /**
  * Reloads the current document if the user's preferences indicate it should
  * be reloaded.
  */
  function conditionallyReloadDocument() {
    if (Prefs.get("autoReload")) {
      window.content.document.location.reload(false);
    }
  }

  /**
   * Removes all menu items and removes all event listeners.
   */
  self.emptyMenu = function(menu) {
    var menuitems = menu.getElementsByTagName("menuitem");
    for (let item of menuitems) {
      if (!item.hasOwnProperty("rpListener")) {
        Logger.warning(Logger.TYPE_ERROR, "There's a menuitem without " +
                       "listener!");
        continue;
      }

      item.removeEventListener("command", item.rpListener, false);
      delete item.rpListener;
    }
    DOMUtils.removeChildren(menu);
  };

  self.addMenuSeparator = function(menu) {
    var separator = document.createElement("menuseparator");
    menu.insertBefore(separator, menu.firstChild);
    return separator;
  };

  self.addMenuItem = function(menu, label, aCallback) {
    var menuItem = document.createElement("menuitem");
    menuItem.setAttribute("label", label);
    var listener = function() {
      aCallback();
      conditionallyReloadDocument();
    };
    menuItem.addEventListener("command", listener, false);
    menuItem.rpListener = listener;
    // menuItem.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
    menu.insertBefore(menuItem, menu.firstChild);
    return menuItem;
  };

  self.addMenuItemTemporarilyAllowOrigin = function(menu, originHost) {
    var label = StringUtils.$str("allowOriginTemporarily", [originHost]);
    var callback = function() {
      rpcontinued.overlay.temporarilyAllowOrigin(originHost);
    };
    var item = self.addMenuItem(menu, label, callback);
    item.setAttribute("class", "rpcontinuedTemporary");
    return item;
  };

  self.addMenuItemAllowOrigin = function(menu, originHost) {
    var label = StringUtils.$str("allowOrigin", [originHost]);
    var callback = function() {
      rpcontinued.overlay.allowOrigin(originHost);
    };
    return self.addMenuItem(menu, label, callback);
  };

  self.addMenuItemTemporarilyAllowOriginToDest = function(menu, originHost,
                                                     destHost) {
    var label = StringUtils.$str("allowOriginToDestinationTemporarily",
                                 [originHost, destHost]);
    var callback = function() {
      rpcontinued.overlay.temporarilyAllowOriginToDestination(originHost,
                                                              destHost);
    };
    var item = self.addMenuItem(menu, label, callback);
    item.setAttribute("class", "rpcontinuedTemporary");
    return item;
  };

  self.addMenuItemAllowOriginToDest = function(menu, originHost, destHost) {
    var label = StringUtils.$str("allowOriginToDestination",
                                 [originHost, destHost]);
    var callback = function() {
      rpcontinued.overlay.allowOriginToDestination(originHost, destHost);
    };
    var item = self.addMenuItem(menu, label, callback);
    item.setAttribute("class", "rpcontinuedAllowOriginToDest");
    return item;
  };

  self.addMenuItemTemporarilyAllowDest = function(menu, destHost) {
    var label = StringUtils.$str("allowDestinationTemporarily", [destHost]);
    var callback = function() {
      rpcontinued.overlay.temporarilyAllowDestination(destHost);
    };
    var item = self.addMenuItem(menu, label, callback);
    item.setAttribute("class", "rpcontinuedTemporary");
    return item;
  };

  self.addMenuItemAllowDest = function(menu, destHost) {
    var label = StringUtils.$str("allowDestination", [destHost]);
    var callback = function() {
      rpcontinued.overlay.allowDestination(destHost);
    };
    return self.addMenuItem(menu, label, callback);
  };

  return self;
}());
