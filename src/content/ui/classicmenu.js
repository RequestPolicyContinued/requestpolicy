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
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */




requestpolicy.classicmenu = (function() {
  let self = {};

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;


  let {ScriptLoader} = (function() {
    let mod = {};
    Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm", mod);
    return mod;
  }());
  let {rpPrefBranch} = ScriptLoader.importModule("lib/prefs");
  let {StringUtils} = ScriptLoader.importModule("lib/utils/strings");


  /**
  * Reloads the current document if the user's preferences indicate it should
  * be reloaded.
  */
  self._conditionallyReloadDocument = function() {
    if (rpPrefBranch.getBoolPref("autoReload")) {
      content.document.location.reload(false);
    }
  };


  self.addMenuSeparator = function(menu) {
    var separator = document.createElement("menuseparator");
    menu.insertBefore(separator, menu.firstChild);
    return separator;
  };

  self.addMenuItem = function(menu, label, oncommand) {
    var menuItem = document.createElement("menuitem");
    menuItem.setAttribute("label", label);
    oncommand = oncommand +
        " requestpolicy.classicmenu._conditionallyReloadDocument();";
    menuItem.setAttribute("oncommand", oncommand);
    // menuItem.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
    menu.insertBefore(menuItem, menu.firstChild);
    return menuItem;
  };


  self.addMenuItemTemporarilyAllowOrigin = function(menu, originHost) {
    var label = StringUtils.$str("allowOriginTemporarily", [originHost]);
    var command = "requestpolicy.overlay.temporarilyAllowOrigin('"
        + requestpolicy.menu._sanitizeJsFunctionArg(originHost) + "');";
    var item = self.addMenuItem(menu, label, command);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  };

  self.addMenuItemAllowOrigin = function(menu, originHost) {
    var label = StringUtils.$str("allowOrigin", [originHost]);
    var command = "requestpolicy.overlay.allowOrigin('"
        + requestpolicy.menu._sanitizeJsFunctionArg(originHost) + "');";
    return self.addMenuItem(menu, label, command);
  };


  self.addMenuItemTemporarilyAllowOriginToDest = function(menu, originHost,
                                                     destHost) {
    var label = StringUtils.$str("allowOriginToDestinationTemporarily",
                                 [originHost, destHost]);
    var command = "requestpolicy.overlay.temporarilyAllowOriginToDestination('"
        + requestpolicy.menu._sanitizeJsFunctionArg(originHost) + "', '"
        + requestpolicy.menu._sanitizeJsFunctionArg(destHost) + "');";
    var item = self.addMenuItem(menu, label, command);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  };

  self.addMenuItemAllowOriginToDest = function(menu, originHost, destHost) {
    var label = StringUtils.$str("allowOriginToDestination",
                                 [originHost, destHost]);
    var command = "requestpolicy.overlay.allowOriginToDestination('"
        + requestpolicy.menu._sanitizeJsFunctionArg(originHost) + "', '"
        + requestpolicy.menu._sanitizeJsFunctionArg(destHost) + "');";
    var item = self.addMenuItem(menu, label, command);
    item.setAttribute("class", "requestpolicyAllowOriginToDest");
    return item;
  };


  self.addMenuItemTemporarilyAllowDest = function(menu, destHost) {
    var label = StringUtils.$str("allowDestinationTemporarily", [destHost]);
    var command = "requestpolicy.overlay.temporarilyAllowDestination('"
        + requestpolicy.menu._sanitizeJsFunctionArg(destHost) + "');";
    var item = self.addMenuItem(menu, label, command);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  };

  self.addMenuItemAllowDest = function(menu, destHost) {
    var label = StringUtils.$str("allowDestination", [destHost]);
    var command = "requestpolicy.overlay.allowDestination('"
        + requestpolicy.menu._sanitizeJsFunctionArg(destHost) + "');";
    return self.addMenuItem(menu, label, command);
  };

  return self;
}());
