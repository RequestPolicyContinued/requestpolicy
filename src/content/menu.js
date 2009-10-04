/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/Logger.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/RequestUtil.jsm",
    requestpolicy.mod);

requestpolicy.menu = {

  _initialized : false,
  _rpService : null,
  _rpServiceJSObject : null,

  _strbundle : null,
  addedMenuItems : [],
  _menu : null,

  _blockedDestinationsItems : [],
  _allowedDestinationsItems : [],

  _blockedDestinationsHeadingMenuItem : null,
  _allowedDestinationsHeadingMenuItem : null,

  _blockedDestinationsBeforeReferenceItem : null,
  _allowedDestinationsBeforeReferenceItem : null,

  _itemPrefetchWarning : null,
  _itemPrefetchWarningSeparator : null,

  _extensionConflictWarning : null,
  _extensionConflictWarningSeparator : null,

  _itemOtherOrigins : null,
  _itemOtherOriginsPopup : null,
  _itemOtherOriginsSeparator : null,

  _itemRevokeTemporaryPermissions : null,
  _itemRevokeTemporaryPermissionsSeparator : null,

  _itemAllowAllTemporarily : null,

  _itemAllowOriginTemporarily : null,
  _itemAllowOrigin : null,
  _itemForbidOrigin : null,
  _itemUnrestrictedOrigin : null,

  init : function() {
    if (this._initialized == false) {
      this._initialized = true;

      this._rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
          .getService(Components.interfaces.nsIRequestPolicy);
      this._rpServiceJSObject = this._rpService.wrappedJSObject;

      this._strbundle = document.getElementById("requestpolicyStrings");
      this._menu = document.getElementById("requestpolicyStatusbarPopup");

      this._blockedDestinationsBeforeReferenceItem = document
          .getElementById("requestpolicyAllowedDestinationsSeparator");
      this._allowedDestinationsBeforeReferenceItem = document
          .getElementById("requestpolicyOriginSubmenusSeparator");

      this._blockedDestinationsHeadingMenuItem = document
          .getElementById("requestpolicyBlockedDestinations");
      this._allowedDestinationsHeadingMenuItem = document
          .getElementById("requestpolicyAllowedDestinations");

      this._itemPrefetchWarning = document
          .getElementById("requestpolicyPrefetchWarning");
      this._itemPrefetchWarningSeparator = document
          .getElementById("requestpolicyPrefetchWarningSeparator");

      this._extensionConflictWarning = document
          .getElementById("requestpolicyExtensionConflictWarning");
      this._extensionConflictWarningSeparator = document
          .getElementById("requestpolicyExtensionConflictWarningSeparator");

      this._itemOtherOrigins = document
          .getElementById("requestpolicyOtherOrigins");
      this._itemOtherOriginsPopup = document
          .getElementById("requestpolicyOtherOriginsPopup");
      this._itemOtherOriginsSeparator = document
          .getElementById("requestpolicyOtherOriginsSeparator");

      this._itemRevokeTemporaryPermissions = document
          .getElementById("requestpolicyRevokeTemporaryPermissions");
      this._itemRevokeTemporaryPermissionsSeparator = document
          .getElementById("requestpolicyRevokeTemporaryPermissionsSeparator");

      this._itemAllowAllTemporarily = document
          .getElementById("requestpolicyAllowAllTemporarily");

      this._itemAllowOriginTemporarily = document
          .getElementById("requestpolicyAllowOriginTemporarily");
      this._itemAllowOrigin = document
          .getElementById("requestpolicyAllowOrigin");
      this._itemForbidOrigin = document
          .getElementById("requestpolicyForbidOrigin");
      this._itemUnrestrictedOrigin = document
          .getElementById("requestpolicyUnrestrictedOrigin");

      var conflictCount = this._rpServiceJSObject.getConflictingExtensions().length;
      var hideConflictInfo = (conflictCount == 0);
      if (!hideConflictInfo) {
        this._extensionConflictWarning.setAttribute("label",
            this._strbundle.getFormattedString("extensionConflictWarning",
                [conflictCount]));
      }
      this._extensionConflictWarning.hidden = hideConflictInfo;
      this._extensionConflictWarningSeparator.hidden = hideConflictInfo;
    }
  },

  /**
   * Prepares the statusbar menu based on the user's settings and the current
   * document.
   */
  prepareMenu : function() {
    try {
      var currentIdentifier = requestpolicy.overlay
          .getTopLevelDocumentUriIdentifier();
      var currentUri = requestpolicy.overlay.getTopLevelDocumentUri();
      var isChromeUri = currentUri.indexOf("chrome://") == 0;

      var otherOrigins = requestpolicy.mod.RequestUtil
          .getOtherOrigins(content.document);
      requestpolicy.mod.RequestUtil.dumpOtherOrigins(otherOrigins);

      // Initially make all menu items hidden.
      this._itemRevokeTemporaryPermissions.hidden = true;
      this._itemRevokeTemporaryPermissionsSeparator.hidden = true;
      this._itemAllowOriginTemporarily.hidden = true;
      this._itemAllowOrigin.hidden = true;
      this._itemForbidOrigin.hidden = true;
      this._itemUnrestrictedOrigin.hidden = true;
      this._itemOtherOrigins.hidden = true;
      this._itemOtherOriginsSeparator.hidden = true;

      var hidePrefetchInfo = !this._rpService.isPrefetchEnabled();
      this._itemPrefetchWarning.hidden = hidePrefetchInfo;
      this._itemPrefetchWarningSeparator.hidden = hidePrefetchInfo;
      
      if (isChromeUri) {
        this._itemUnrestrictedOrigin.setAttribute("label", this._strbundle
                .getFormattedString("unrestrictedOrigin", ["chrome://"]));
        this._itemUnrestrictedOrigin.hidden = false;
        return;
      }

      // Set all labels here for convenience, even though we won't display some
      // of these menu items.
      this._itemForbidOrigin.setAttribute("label", this._strbundle
              .getFormattedString("forbidOrigin", [currentIdentifier]));
      this._itemAllowOriginTemporarily.setAttribute("label",
          this._strbundle.getFormattedString("allowOriginTemporarily",
              [currentIdentifier]));
      this._itemAllowOrigin.setAttribute("label", this._strbundle
              .getFormattedString("allowOrigin", [currentIdentifier]));

      var privateBrowsingEnabled = this._rpService.isPrivateBrowsingEnabled();

      if (this._rpService.isTemporarilyAllowedOrigin(currentIdentifier)) {
        this._itemForbidOrigin.hidden = false;
      } else if (this._rpService.isAllowedOrigin(currentIdentifier)) {
        this._itemForbidOrigin.hidden = false;
      } else {
        this._itemAllowOriginTemporarily.hidden = false;
        this._itemAllowOrigin.hidden = privateBrowsingEnabled;
      }

      if (this._rpService.areTemporaryPermissionsGranted()) {
        this._itemRevokeTemporaryPermissions.hidden = false;
        this._itemRevokeTemporaryPermissionsSeparator.hidden = false;
      }

      // Remove old menu items.
      for (var i in this.addedMenuItems) {
        this._menu.removeChild(this.addedMenuItems[i]);
      }
      this.addedMenuItems = [];

      // Add new menu items giving options to allow content.
      this._clearBlockedDestinations();
      // Get the requests rejected by the current uri.
      var rejectedRequests = requestpolicy.mod.RequestUtil.getRejectedRequests(
          currentUri, currentIdentifier, otherOrigins);
      requestpolicy.mod.RequestUtil.dumpRequestSet(rejectedRequests,
          "All rejected requests (including from other origins)");
      for (var destIdentifier in rejectedRequests) {
        var submenu = this.addBlockedDestination(this._menu,
            this._blockedDestinationsBeforeReferenceItem, destIdentifier, true);
        this.addMenuItemTemporarilyAllowDest(submenu, destIdentifier);
        if (!privateBrowsingEnabled) {
          this.addMenuItemAllowDest(submenu, destIdentifier);
        }
        this.addMenuSeparator(submenu);
        this.addMenuItemTemporarilyAllowOriginToDest(submenu,
            currentIdentifier, destIdentifier);
        if (!privateBrowsingEnabled) {
          this.addMenuItemAllowOriginToDest(submenu, currentIdentifier,
              destIdentifier);
        }
      }

      // Add new menu items giving options to forbid currently accepted
      // content.
      this._clearAllowedDestinations();
      var allowedRequests = requestpolicy.mod.RequestUtil.getAllowedRequests(
          currentUri, currentIdentifier, otherOrigins);
      requestpolicy.mod.RequestUtil.dumpRequestSet(allowedRequests,
          "All allowed requests (including from other origins)");
      for (var destIdentifier in allowedRequests) {
        // Ignore allowed requests that are to the same site.
        if (destIdentifier == currentIdentifier) {
          continue;
        }
        var submenu = this.addAllowedDestination(this._menu,
            this._allowedDestinationsBeforeReferenceItem, destIdentifier, true);

        // Show a "forbid ___" option that is specific to why the content is
        // allowed.

        // The "order" in which to show these may be worth further
        // consideration. Currently, the options for forbidding content start
        // from the "allow" rules that are most liberal if they exist and shows
        // the more specific ones if there aren't more liberal ones that would
        // apply. The big catch is putting it in any other order may result in
        // the user having to perform multiple "forbids" after successive
        // reloads, which would be unacceptable.

        if (this._rpService.isAllowedOrigin(currentIdentifier)
            || this._rpService.isTemporarilyAllowedOrigin(currentIdentifier)) {
          this.addMenuItemForbidOrigin(submenu, currentIdentifier);

        } else if (this._rpService.isAllowedDestination(destIdentifier)
            || this._rpService.isTemporarilyAllowedDestination(destIdentifier)) {
          this.addMenuItemForbidDest(submenu, destIdentifier);

        } else if (this._rpService.isAllowedOriginToDestination(
            currentIdentifier, destIdentifier)
            || this._rpService.isTemporarilyAllowedOriginToDestination(
                currentIdentifier, destIdentifier)) {
          this.addMenuItemForbidOriginToDest(submenu, currentIdentifier,
              destIdentifier);

        } else {
          // TODO: make very sure this can never happen or, better, get an idea
          // of when it can and make a sane default.
        }
      }

      // Create menu for other origins.
      this._clearChildMenus(this._itemOtherOriginsPopup);
      var currentOtherOriginMenu;
      var otherOriginMenuCount = 0;
      for (var otherOriginIdentifier in otherOrigins) {
        if (otherOriginIdentifier == currentIdentifier) {
          // It's not a different origin, it's the same.
          continue;
        }
        currentOtherOriginMenu = this._createOtherOriginMenu(
            otherOriginIdentifier, otherOrigins);
        // If there are no blocked/allowed destinations from this other origin,
        // don't display it.
        if (currentOtherOriginMenu.meaningfulChildCount == 0) {
          var menuNotPopup = currentOtherOriginMenu.parentNode;
          this._clearChildMenus(menuNotPopup);
          this._itemOtherOriginsPopup.removeChild(menuNotPopup);
        } else {
          otherOriginMenuCount++;
        }
      }
      // If there are no other origins being displayed, don't display the "other
      // origins" item in the main menu.
      this._itemOtherOrigins.hidden = this._itemOtherOriginsSeparator.hidden = (otherOriginMenuCount == 0);

    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Unable to prepare menu due to error.");
      throw e;
    }
  },

  setItemAllowAllTemporarilyChecked : function(isChecked) {
    this._itemAllowAllTemporarily.setAttribute("checked", isChecked);
  },

  addMenuSeparator : function(menu) {
    var separator = document.createElement("menuseparator");
    menu.insertBefore(separator, menu.firstChild);
    return separator;
  },

  addMenuItem : function(menu, label, oncommand, statustext) {
    var menuItem = document.createElement("menuitem");
    menuItem.setAttribute("label", label);
    menuItem.setAttribute("statustext", statustext);
    menuItem.setAttribute("oncommand", oncommand);
    // menuItem.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
    menu.insertBefore(menuItem, menu.firstChild);
    return menuItem;
  },

  addMenu : function(parentMenu, label) {
    var menu = document.createElement("menu");
    menu.setAttribute("label", label);
    parentMenu.insertBefore(menu, parentMenu.firstChild);
    // add the menu popup in the menu item
    var menuPopup = document.createElement("menupopup");
    menu.insertBefore(menuPopup, menu.firstChild);
    // return the popup as that's what will have items added to it
    return menuPopup;
  },

  addBlockedDestination : function(parentMenu, itemToInsertBefore, label,
      isMainMenu) {
    var menu = document.createElement("menu");
    // This seems to be the easiest way to deal with indenting ltr/rtl text,
    // given that there was either a bug in the babelzilla system or having the
    // spaces in the properties files was confusing the translators. Don't want
    // to use css because I think it would require putting a margin/padding on
    // both the left and right, and so result in extra margin on the side that
    // doesn't need to be indented.
    menu.setAttribute("label", this._strbundle.getFormattedString(
            "indentedText", ["    ", label]));
    menu.setAttribute("class", "requestpolicyBlocked");
    parentMenu.insertBefore(menu, itemToInsertBefore);
    // add the menu popup in the menu item
    var menuPopup = document.createElement("menupopup");
    menu.insertBefore(menuPopup, menu.firstChild);
    // return the popup as that's what will have items added to it

    // remember what we added if we added it to the main menu
    if (isMainMenu) {
      this._blockedDestinationsItems.push(menu);
    }

    return menuPopup;
  },

  addAllowedDestination : function(parentMenu, itemToInsertBefore, label,
      isMainMenu) {
    var menu = document.createElement("menu");
    menu.setAttribute("label", this._strbundle.getFormattedString(
            "indentedText", ["    ", label]));
    menu.setAttribute("class", "requestpolicyAllowed");
    parentMenu.insertBefore(menu, itemToInsertBefore);
    // add the menu popup in the menu item
    var menuPopup = document.createElement("menupopup");
    menu.insertBefore(menuPopup, menu.firstChild);
    // return the popup as that's what will have items added to it

    // remember what we added
    if (isMainMenu) {
      this._allowedDestinationsItems.push(menu);
    }

    return menuPopup;
  },

  _clearChildMenus : function(menu) {
    while (menu.firstChild) {
      this._clearChildMenus(menu.firstChild);
      menu.removeChild(menu.firstChild);
    }
  },

  _removeExtraSubmenuSeparators : function(menu) {
    if (menu.firstChild && menu.lastChild.nodeName == "menuseparator") {
      menu.removeChild(menu.lastChild);
    }
  },

  _disableMenuIfEmpty : function(menu) {
    // parentNode is the menu label
    menu.parentNode.disabled = menu.firstChild ? false : true;
  },

  addMenuItemTemporarilyAllowOrigin : function(menu, originHost) {
    var label = this._strbundle.getFormattedString("allowOriginTemporarily",
        [originHost]);
    var command = "requestpolicy.overlay.temporarilyAllowOrigin('"
        + this._sanitizeJsFunctionArg(originHost) + "');";
    var statustext = originHost; // TODO
    var item = this.addMenuItem(menu, label, command, statustext);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  },

  addMenuItemTemporarilyAllowDest : function(menu, destHost) {
    var label = this._strbundle.getFormattedString(
        "allowDestinationTemporarily", [destHost]);
    var command = "requestpolicy.overlay.temporarilyAllowDestination('"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    var item = this.addMenuItem(menu, label, command, statustext);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  },

  addMenuItemTemporarilyAllowOriginToDest : function(menu, originHost, destHost) {
    var label = this._strbundle.getFormattedString(
        "allowOriginToDestinationTemporarily", [originHost, destHost]);
    var command = "requestpolicy.overlay.temporarilyAllowOriginToDestination('"
        + this._sanitizeJsFunctionArg(originHost) + "', '"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    var item = this.addMenuItem(menu, label, command, statustext);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  },

  addMenuItemAllowOrigin : function(menu, originHost) {
    var label = this._strbundle.getFormattedString("allowOrigin", [originHost]);
    var command = "requestpolicy.overlay.allowOrigin('"
        + this._sanitizeJsFunctionArg(originHost) + "');";
    var statustext = originHost; // TODO
    return this.addMenuItem(menu, label, command, statustext);
  },

  addMenuItemAllowDest : function(menu, destHost) {
    var label = this._strbundle.getFormattedString("allowDestination",
        [destHost]);
    var command = "requestpolicy.overlay.allowDestination('"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    return this.addMenuItem(menu, label, command, statustext);
  },

  addMenuItemAllowOriginToDest : function(menu, originHost, destHost) {
    var label = this._strbundle.getFormattedString("allowOriginToDestination",
        [originHost, destHost]);
    var command = "requestpolicy.overlay.allowOriginToDestination('"
        + this._sanitizeJsFunctionArg(originHost) + "', '"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    var item = this.addMenuItem(menu, label, command, statustext);
    item.setAttribute("class", "requestpolicyAllowOriginToDest");
    return item;
  },

  addMenuItemForbidOrigin : function(menu, originHost) {
    var label = this._strbundle
        .getFormattedString("forbidOrigin", [originHost]);
    var command = "requestpolicy.overlay.forbidOrigin('"
        + this._sanitizeJsFunctionArg(originHost) + "');";
    var statustext = originHost;
    return this.addMenuItem(menu, label, command, statustext);
  },

  addMenuItemForbidDest : function(menu, destHost) {
    var label = this._strbundle.getFormattedString("forbidDestination",
        [destHost]);
    var command = "requestpolicy.overlay.forbidDestination('"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    return this.addMenuItem(menu, label, command, statustext);
  },

  addMenuItemForbidOriginToDest : function(menu, originHost, destHost) {
    var label = this._strbundle.getFormattedString("forbidOriginToDestination",
        [originHost, destHost]);
    var command = "requestpolicy.overlay.forbidOriginToDestination('"
        + this._sanitizeJsFunctionArg(originHost) + "', '"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    return this.addMenuItem(menu, label, command, statustext);
  },

  _clearBlockedDestinations : function() {
    for (var i = 0; i < this._blockedDestinationsItems.length; i++) {
      this._menu.removeChild(this._blockedDestinationsItems[i]);
    }
    this._blockedDestinationsItems = [];
  },

  _clearAllowedDestinations : function() {
    for (var i = 0; i < this._allowedDestinationsItems.length; i++) {
      this._menu.removeChild(this._allowedDestinationsItems[i]);
    }
    this._allowedDestinationsItems = [];
  },

  clearMenu : function(menu) {
    while (menu.firstChild) {
      menu.removeChild(menu.firstChild);
    }
  },

  _createOtherOriginMenu : function(originIdentifier, otherOrigins) {
    var menu = this.addMenu(this._itemOtherOriginsPopup, originIdentifier);
    var newNode;

    // This will indicate whether the menu is worth displaying.
    menu.meaningfulChildCount = 0;

    if (this._rpService.isTemporarilyAllowedOrigin(originIdentifier)
        || this._rpService.isAllowedOrigin(originIdentifier)) {
      this.addMenuItemForbidOrigin(menu, originIdentifier);
    } else {
      this.addMenuItemTemporarilyAllowOrigin(menu, originIdentifier);
      this.addMenuItemAllowOrigin(menu, originIdentifier);
    }

    this.addMenuSeparator(menu);

    var allowedIdentifiers = requestpolicy.mod.RequestUtil.getAllowedRequests(
        null, originIdentifier, otherOrigins);
    for (var i in allowedIdentifiers) {
      // Ignore allowed requests that are to the same site.
      if (i == originIdentifier) {
        continue;
      }
      menu.meaningfulChildCount++;
      var submenu = this.addAllowedDestination(menu, menu.firstChild, i, false);
      this._populateOtherOriginsMenuItemAllowedDestinations(submenu,
          originIdentifier, i);
    }

    newNode = this._allowedDestinationsHeadingMenuItem.cloneNode(true);
    newNode.setAttribute("id", null);
    menu.insertBefore(newNode, menu.firstChild);

    this.addMenuSeparator(menu);

    var blockedIdentifiers = requestpolicy.mod.RequestUtil.getRejectedRequests(
        null, originIdentifier, otherOrigins);
    for (var i in blockedIdentifiers) {
      menu.meaningfulChildCount++;
      var submenu = this.addBlockedDestination(menu, menu.firstChild, i, false);
      this._populateOtherOriginsMenuItemBlockedDestinations(submenu,
          originIdentifier, i);
    }

    newNode = this._blockedDestinationsHeadingMenuItem.cloneNode(true);
    newNode.setAttribute("id", null);
    menu.insertBefore(newNode, menu.firstChild);

    return menu;
  },

  _populateOtherOriginsMenuItemBlockedDestinations : function(submenu,
      originIdentifier, destIdentifier) {
    this.addMenuItemTemporarilyAllowDest(submenu, destIdentifier);
    this.addMenuItemAllowDest(submenu, destIdentifier);
    this.addMenuSeparator(submenu);
    this.addMenuItemTemporarilyAllowOriginToDest(submenu, originIdentifier,
        destIdentifier);
    this
        .addMenuItemAllowOriginToDest(submenu, originIdentifier, destIdentifier);
  },

  _populateOtherOriginsMenuItemAllowedDestinations : function(submenu,
      originIdentifier, destIdentifier) {
    if (this._rpService.isAllowedOrigin(originIdentifier)
        || this._rpService.isTemporarilyAllowedOrigin(originIdentifier)) {
      this.addMenuItemForbidOrigin(submenu, originIdentifier);

    } else if (this._rpService.isAllowedDestination(destIdentifier)
        || this._rpService.isTemporarilyAllowedDestination(destIdentifier)) {
      this.addMenuItemForbidDest(submenu, destIdentifier);

    } else if (this._rpService.isAllowedOriginToDestination(originIdentifier,
        destIdentifier)
        || this._rpService.isTemporarilyAllowedOriginToDestination(
            originIdentifier, destIdentifier)) {
      this.addMenuItemForbidOriginToDest(submenu, originIdentifier,
          destIdentifier);

    } else {
      // TODO: make very sure this can never happen or, better, get an idea
      // of when it can and make a sane default.
    }
  },

  _sanitizeJsFunctionArg : function(str) {
    // strip single quotes and backslashes
    return str.replace(/['\\]/g, "");
  }

}
