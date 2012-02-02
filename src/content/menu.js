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

Components.utils.import("resource://requestpolicy/DomainUtil.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Logger.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Policy.jsm",
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

//  _blockedDestinationsHeadingMenuItem : null,
//  _allowedDestinationsHeadingMenuItem : null,
//
//  _blockedDestinationsBeforeReferenceItem : null,
//  _allowedDestinationsBeforeReferenceItem : null,
//
//  _itemPrefetchWarning : null,
//  _itemPrefetchWarningSeparator : null,
//
//  _extensionConflictWarning : null,
//  _extensionConflictWarningSeparator : null,
//
//  _itemOtherOrigins : null,
//  _itemOtherOriginsPopup : null,
//  _itemOtherOriginsSeparator : null,
//
//  _itemRevokeTemporaryPermissions : null,
//  _itemRevokeTemporaryPermissionsSeparator : null,
//
//  _itemAllowAllTemporarily : null,
//
//  _itemAllowOriginTemporarily : null,
//  _itemAllowOrigin : null,
//  _itemForbidOrigin : null,
//  _itemUnrestrictedOrigin : null,

  init : function() {
    if (this._initialized == false) {
      this._initialized = true;

      this._rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
          .getService(Components.interfaces.nsIRequestPolicy);
      this._rpServiceJSObject = this._rpService.wrappedJSObject;

      this._strbundle = document.getElementById("requestpolicyStrings");
      this._menu = document.getElementById("rp-popup");
//      this._menu = document.getElementById("requestpolicyStatusbarPopup");

//      this._blockedDestinationsBeforeReferenceItem = document
//          .getElementById("requestpolicyAllowedDestinationsSeparator");
//      this._allowedDestinationsBeforeReferenceItem = document
//          .getElementById("requestpolicyOriginSubmenusSeparator");
//
//      this._blockedDestinationsHeadingMenuItem = document
//          .getElementById("requestpolicyBlockedDestinations");
//      this._allowedDestinationsHeadingMenuItem = document
//          .getElementById("requestpolicyAllowedDestinations");
//
//      this._itemPrefetchWarning = document
//          .getElementById("requestpolicyPrefetchWarning");
//      this._itemPrefetchWarningSeparator = document
//          .getElementById("requestpolicyPrefetchWarningSeparator");
//
//      this._extensionConflictWarning = document
//          .getElementById("requestpolicyExtensionConflictWarning");
//      this._extensionConflictWarningSeparator = document
//          .getElementById("requestpolicyExtensionConflictWarningSeparator");
//
//      this._itemOtherOrigins = document
//          .getElementById("requestpolicyOtherOrigins");
//      this._itemOtherOriginsPopup = document
//          .getElementById("requestpolicyOtherOriginsPopup");
//      this._itemOtherOriginsSeparator = document
//          .getElementById("requestpolicyOtherOriginsSeparator");
//
//      this._itemRevokeTemporaryPermissions = document
//          .getElementById("requestpolicyRevokeTemporaryPermissions");
//      this._itemRevokeTemporaryPermissionsSeparator = document
//          .getElementById("requestpolicyRevokeTemporaryPermissionsSeparator");
//
//      this._itemAllowAllTemporarily = document
//          .getElementById("requestpolicyAllowAllTemporarily");
//
//      this._itemAllowOriginTemporarily = document
//          .getElementById("requestpolicyAllowOriginTemporarily");
//      this._itemAllowOrigin = document
//          .getElementById("requestpolicyAllowOrigin");
//      this._itemForbidOrigin = document
//          .getElementById("requestpolicyForbidOrigin");
//      this._itemUnrestrictedOrigin = document
//          .getElementById("requestpolicyUnrestrictedOrigin");

      var conflictCount = this._rpServiceJSObject.getConflictingExtensions().length;
      var hideConflictInfo = (conflictCount == 0);
//      if (!hideConflictInfo) {
//        this._extensionConflictWarning.setAttribute("label",
//            this._strbundle.getFormattedString("extensionConflictWarning",
//                [conflictCount]));
//      }
//      this._extensionConflictWarning.hidden = hideConflictInfo;
//      this._extensionConflictWarningSeparator.hidden = hideConflictInfo;
    }
  },

  _isAddressOrSingleName : function(hostname) {
    return requestpolicy.mod.DomainUtil.isAddress(hostname) ||
           hostname.indexOf(".") == -1;
  },

  _addWildcard : function(hostname) {
    if (this._isAddressOrSingleName(hostname)) {
      return hostname;
    } else {
      return "*." + hostname;
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
      var currentUriObj = requestpolicy.mod.DomainUtil.getUriObject(
          requestpolicy.overlay.getTopLevelDocumentUri());

      // TODO: This will need to take into account SSL and port, as well.
      //var modifiedCurrentIdent = "*." + currentIdentifier;
      var currentUri = requestpolicy.overlay.getTopLevelDocumentUri();
      var isChromeUri = currentUriObj.scheme == "chrome";
      //var currentUriIsHttps = currentUriObj.scheme == "https";

      // The fact that getOtherOrigins uses documentURI directly from
      // content.document is important because getTopLevelDocumentUri will
      // not return the real documentURI if there is an applicable
      // top-level document translation rule (these are used sometimes
      // for extension compatibility). For example, this is essential to the
      // menu showing relevant info when using the Update Scanner extension.
      var otherOriginsReqSet = requestpolicy.mod.RequestUtil
          .getOtherOrigins(content.document);
      var otherOrigins = otherOriginsReqSet.getAllMergedOrigins();
      otherOriginsReqSet.print("otherOriginsReqSet");
      //requestpolicy.mod.RequestUtil.dumpOtherOrigins(otherOrigins);

//      // Initially make all menu items hidden.
//      this._itemRevokeTemporaryPermissions.hidden = true;
//      this._itemRevokeTemporaryPermissionsSeparator.hidden = true;
//      this._itemAllowOriginTemporarily.hidden = true;
//      this._itemAllowOrigin.hidden = true;
//      this._itemForbidOrigin.hidden = true;
//      this._itemUnrestrictedOrigin.hidden = true;
//      this._itemOtherOrigins.hidden = true;
//      this._itemOtherOriginsSeparator.hidden = true;
//
//      var hidePrefetchInfo = !this._rpService.isPrefetchEnabled();
//      this._itemPrefetchWarning.hidden = hidePrefetchInfo;
//      this._itemPrefetchWarningSeparator.hidden = hidePrefetchInfo;
//
//      if (isChromeUri) {
//        this._itemUnrestrictedOrigin.setAttribute("label", this._strbundle
//                .getFormattedString("unrestrictedOrigin", ["chrome://"]));
//        this._itemUnrestrictedOrigin.hidden = false;
//        return;
//      }

      try {
        var currentBaseDomain = requestpolicy.mod.DomainUtil.getDomain(
              currentUri);
      } catch (e) {
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
              "Unable to prepare menu because base domain can't be determined: "
              + currentUri);
        return;
      }

//      // Set all labels here for convenience, even though we won't display some
//      // of these menu items.
//      this._itemForbidOrigin.setAttribute("label", this._strbundle
//              .getFormattedString("forbidOrigin", [currentIdentifier]));
//      this._itemAllowOriginTemporarily.setAttribute("label",
//          this._strbundle.getFormattedString("allowOriginTemporarily",
//              [currentIdentifier]));
//      this._itemAllowOrigin.setAttribute("label", this._strbundle
//              .getFormattedString("allowOrigin", [currentIdentifier]));
//
//      var privateBrowsingEnabled = this._rpService.isPrivateBrowsingEnabled()
//          && !this._rpService.prefs
//              .getBoolPref("privateBrowsingPermanentWhitelisting");
//
//      if (this._rpService.isTemporarilyAllowedOrigin(currentIdentifier)) {
//        this._itemForbidOrigin.hidden = false;
//      } else if (this._rpService.isAllowedOrigin(currentIdentifier)) {
//        this._itemForbidOrigin.hidden = false;
//      } else {
//        this._itemAllowOriginTemporarily.hidden = false;
//        this._itemAllowOrigin.hidden = privateBrowsingEnabled;
//      }
//
//      if (this._rpService.areTemporaryPermissionsGranted()) {
//        this._itemRevokeTemporaryPermissions.hidden = false;
//        this._itemRevokeTemporaryPermissionsSeparator.hidden = false;
//      }
//
//      // Remove old menu items.
//      for (var i in this.addedMenuItems) {
//        this._menu.removeChild(this.addedMenuItems[i]);
//      }
//      this.addedMenuItems = [];
//
//      this._clearBlockedDestinations();
//      this._clearAllowedDestinations();
          
//      // Add menu items for rejected dests, allowed dests, and other origins.
//
//      this._addRejectedRequests(this._menu, currentUri, currentUriObj, currentIdentifier,
//            otherOrigins, privateBrowsingEnabled, currentBaseDomain);
//
//      this._addAllowedRequests(this._menu, currentUri, currentUriObj, currentIdentifier,
//            otherOrigins, privateBrowsingEnabled, currentBaseDomain);
//
//      this._addOtherOrigins(currentUri, currentUriObj, currentIdentifier,
//            otherOrigins, privateBrowsingEnabled, currentBaseDomain);

    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Unable to prepare menu due to error.");
      throw e;
    }
      
  },
      
  _addRejectedRequests : function(menu, currentUri, currentUriObj, currentIdentifier,
        otherOrigins, privateBrowsingEnabled, currentBaseDomain) {

    // Get the requests rejected by the current uri.
    var rejectedReqSet = requestpolicy.mod.RequestUtil.getRejectedRequests(
        currentUri, currentIdentifier, otherOrigins);
    var rejectedRequests = rejectedReqSet.getAllMergedOrigins();
    rejectedReqSet.print("rejectedReqSet");
    //requestpolicy.mod.RequestUtil.dumpRequestSet(rejectedRequests,
    //    "All rejected requests (including from other origins)");
    // TODO: destIdentifier is now supposed to be the base domain, so this
    // should be renamed to baseDomain. Right now these are equivalent while
    // in base domain strictness mode.
    for (var destBase in rejectedRequests) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
            "destBase in rejectedRequests: " + destBase);
      
      // TODO: continue if destIdentifier is an address rather than a domain name.
      
      var ruleData = {"d" : {"h" : this._addWildcard(destBase)} };

      if (!requestpolicy.mod.DomainUtil.hasStandardPort(currentUriObj)) {
        if (!ruleData["o"]) {
          ruleData["o"] = {};
        }
        ruleData["o"]["port"] = currentUriObj.port;
      }

      var submenu = this.addBlockedDestination(menu,
          this._blockedDestinationsBeforeReferenceItem, destBase,
          true);

      this.addMenuItemTemporarilyAllowDest(submenu, ruleData);
      if (!privateBrowsingEnabled) {
        this.addMenuItemAddAllowRule(submenu, ruleData);
        //this.addMenuItemAllowDest(submenu, ruleData);
      }
      this.addMenuSeparator(submenu);
      
      // var curBaseDomain = requestpolicy.mod.DomainUtil.getIdentifier(
      //       currentIdentifier, requestpolicy.mod.DomainUtil.LEVEL_DOMAIN);
      if (!ruleData["o"]) {
        ruleData["o"] = {};
      }
      ruleData["o"]["h"] = this._addWildcard(currentBaseDomain);
      this.addMenuItemTemporarilyAllowOriginToDest(submenu, ruleData);
      if (!privateBrowsingEnabled) {
        this.addMenuItemAllowOriginToDest(submenu, ruleData);
      }
      
      // TODO: enable this by a pref for advanced users.
      // Add additional main menu entries under each base domain for each
      // full hostname (for each full identifier [scheme+host+port]?).

      for (var destIdent in rejectedRequests[destBase]) {
        requestpolicy.mod.Logger.dump("destBase: " + destBase);
        requestpolicy.mod.Logger.dump("destIdent: " + destIdent);
        var destUriObj = requestpolicy.mod.DomainUtil.getUriObject(destIdent);

        if (this._isAddressOrSingleName(destUriObj.host)) {
requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
      "skipping address or non-dot name: " + destUriObj.host);
          continue;
        }

        // TODO: we need to handle the case where there aren't going to be
        // full hostname sub-items shown and we have multiple distinct
        // full identifiers that would be grouped together in one base domain.
        // As a result, we need to give the ability to whitelist these from
        // the main item.
        var ruleData = {"d" : {"h" : this._addWildcard(destUriObj.host)} };
        if (currentUriObj.scheme == "https" && destUriObj.scheme != "https") {
          ruleData["d"]["s"] = destUriObj.scheme;
          ruleData["o"] = {"h" : this._addWildcard(currentBaseDomain),
                           "s" : currentUriObj.scheme};
        }

        if (!requestpolicy.mod.DomainUtil.hasStandardPort(destUriObj)) {
          ruleData["d"]["port"] = destUriObj.port;
        }
        if (!requestpolicy.mod.DomainUtil.hasStandardPort(currentUriObj)) {
          if (!ruleData["o"]) {
            ruleData["o"] = {};
          }
          ruleData["o"]["port"] = currentUriObj.port;
        }

        spaceSepDestIdent = (ruleData["d"]["s"] ? ruleData["d"]["s"] + "://" : "") +
                            destUriObj.host + 
                            (ruleData["d"]["port"] ? ":" + ruleData["d"]["port"] : "");
        var submenu = this.addBlockedDestination(menu,
              this._blockedDestinationsBeforeReferenceItem,
              spaceSepDestIdent, true, true);

        this.addMenuItemTemporarilyAllowDest(submenu, ruleData);
        if (!privateBrowsingEnabled) {
          this.addMenuItemAllowDest(submenu, ruleData);
        }
        this.addMenuSeparator(submenu);

        if (!ruleData["o"]) {
          ruleData["o"] = {};
        }
        ruleData["o"]["h"] = this._addWildcard(currentBaseDomain);
        this.addMenuItemTemporarilyAllowOriginToDest(submenu, ruleData);
        if (!privateBrowsingEnabled) {
          this.addMenuItemAllowOriginToDest(submenu, ruleData);
        }
      }
    }
  },
  
  _addAllowedRequests : function(menu, currentUri, currentUriObj, currentIdentifier,
        otherOrigins, privateBrowsingEnabled, currentBaseDomain) {  

    // Add new menu items giving options to forbid currently accepted
    // content.
    var allowedReqSet = requestpolicy.mod.RequestUtil.getAllowedRequests(
        currentUri, currentIdentifier, otherOrigins);
    var allowedRequests = allowedReqSet.getAllMergedOrigins();
    allowedReqSet.print("allowedReqSet");
    // requestpolicy.mod.RequestUtil.dumpRequestSet(allowedRequests,
    //     "All allowed requests (including from other origins)");
    for (var destBase in allowedRequests) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
            "destBase in allowedRequests: " + destBase);
      
      // Ignore allowed requests that are to the same site.
      // TODO: Improve on this. We should find out if any of the allowed
      // requests were due to rules rather than because it was the same
      // origin. Only skip the item if there aren't rules that could be
      // removed by the user or if we're in default allow mode.
      // var curBaseDomain = requestpolicy.mod.DomainUtil.getIdentifier(
      //       currentIdentifier, requestpolicy.mod.DomainUtil.LEVEL_DOMAIN);
      if (destBase == currentBaseDomain) {
        continue;
      }
      var submenu = this.addAllowedDestination(menu,
          this._allowedDestinationsBeforeReferenceItem, destBase, true);

      // TODO: go through the allowedRequests, find all of the rules that
      // caused the request to be allowed, and display a submenu entry to
      // remove the rule. Also, give an option to forbid the request.
      var rules = {};
      for (var destIdent in allowedRequests[destBase]) {
        var destinations = allowedRequests[destBase][destIdent];
        for (var destUri in destinations) {
          var results = destinations[destUri];
          for (var i in results.matchedAllowRules) {
            var policy, match;
            [policy, match] = results.matchedAllowRules[i];
            var rawRule = requestpolicy.mod.Policy.matchToRawRule(match);
            var rawRuleStr = requestpolicy.mod.Policy.rawRuleToCanonicalString(rawRule);
            // requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
            //       "matched allow rule: " + rawRuleStr);
            // This is how we remove duplicates: if two rules have the same
            // canonical string, they'll have in the same key.
            rules[rawRuleStr] = rawRule;
          }
        }
      }
      // TODO: sort these into some meaningful order.
      for (var i in rules) {
        this.addMenuItemRemoveAllowRule(submenu, rules[i]);
      }

      this.addMenuSeparator(submenu);

      // Show a "forbid ___" option that is specific to why the content is
      // allowed.

      // The "order" in which to show these may be worth further
      // consideration. Currently, the options for forbidding content start
      // from the "allow" rules that are most liberal if they exist and shows
      // the more specific ones if there aren't more liberal ones that would
      // apply. The big catch is putting it in any other order may result in
      // the user having to perform multiple "forbids" after successive
      // reloads, which would be unacceptable.

      // if (this._rpService.isAllowedOrigin(currentIdentifier)
      //     || this._rpService.isTemporarilyAllowedOrigin(currentIdentifier)) {
      //   this.addMenuItemForbidOrigin(submenu, currentIdentifier);
      // 
      // } else if (this._rpService.isAllowedDestination(destIdentifier)
      //     || this._rpService.isTemporarilyAllowedDestination(destIdentifier)) {
      //   this.addMenuItemForbidDest(submenu, destIdentifier);
      // 
      // } else if (this._rpService.isAllowedOriginToDestination(
      //     currentIdentifier, destIdentifier)
      //     || this._rpService.isTemporarilyAllowedOriginToDestination(
      //         currentIdentifier, destIdentifier)) {
      //   this.addMenuItemForbidOriginToDest(submenu, currentIdentifier,
      //       destIdentifier);
      // 
      // } else {
      //   // TODO: make very sure this can never happen or, better, get an idea
      //   // of when it can and make a sane default.
      // }
      
      // TODO: enable this by a pref for advanced users.
      // Add additional main menu entries under each base domain for each
      // full hostname (for each full identifier [scheme+host+port]?).

      // TODO 
      var defaultAllowMode = false;
      var alwaysShowHostnamesOfAllowedOrigins = false;
      if (defaultAllowMode || alwaysShowHostnamesOfAllowedOrigins) {
        
        for (var destIdent in allowedRequests[destBase]) {
          // TODO: continue if destIdentifier is an address rather than a domain name.
          
          requestpolicy.mod.Logger.dump("destIdent: " + destIdent);
          var spaceSepDestIdent = destIdent.replace("http://", "");
          spaceSepDestIdent = spaceSepDestIdent.replace("://", "://  ");
          var submenu = this.addAllowedDestination(menu,
                this._allowedDestinationsBeforeReferenceItem,
                spaceSepDestIdent, true, true);

          // if (this._rpService.isAllowedOrigin(destIdent)
          //     || this._rpService.isTemporarilyAllowedOrigin(destIdent)) {
          //   this.addMenuItemForbidOrigin(submenu, destIdent);
          //     
          // } else if (this._rpService.isAllowedDestination(destIdent)
          //     || this._rpService.isTemporarilyAllowedDestination(destIdent)) {
          //   this.addMenuItemForbidDest(submenu, fullIdent);
          //     
          // } else if (this._rpService.isAllowedOriginToDestination(
          //     currentIdentifier, fullIdent)
          //     || this._rpService.isTemporarilyAllowedOriginToDestination(
          //         currentIdentifier, fullIdent)) {
          //   this.addMenuItemForbidOriginToDest(submenu, currentIdentifier,
          //       fullIdent);
          //     
          // } else {
          //   // TODO: make very sure this can never happen or, better, get an idea
          //   // of when it can and make a sane default.
          // }
        }
      }         
    }
  },
  
  _addOtherOrigins : function(currentUri, currentUriObj, currentIdentifier,
        otherOrigins, privateBrowsingEnabled, currentBaseDomain) {  
    // TODO: reformat otherOrigins so that the first level of keys
    // is the base domain, the second level is the full identifier,
    // the third level is dest URIs and the values are rules that
    // were triggered.
    // That is, change it from origin[fullIdent][uri] to
    // origin[baseDomain][fullIdent][uri].

    // var newOtherOrigins = {}; 
    // for (var otherIdentifier in otherOrigins) {
    //   if (otherIdentifier == currentIdentifier) {
    //     // It's not a different origin, it's the same.
    //     continue;
    //   }
    //   var otherBaseDomain = requestpolicy.mod.DomainUtil.getDomain(
    //         otherIdentifier);
    //   if (!newOtherOrigins[otherBaseDomain]) {
    //     newOtherOrigins[otherBaseDomain] = {};
    //   }
    //   newOtherOrigins[otherBaseDomain][otherIdentifier] =
    //         otherOrigins[otherIdentifier];
    // }
    //var newOtherOrigins = otherOrigins;

    // Create menu for other origins.
    this._clearChildMenus(this._itemOtherOriginsPopup);
    var submenu;
    var otherOriginMenuCount = 0;
    for (var otherBase in otherOrigins) {
      // We didn't include the current base domain in newOtherOrigins
      // if the only full identifier was the currentIdentifier. So, we
      // don't need to check for this to skip it.

      for (var otherIdent in otherOrigins[otherBase]) {
        requestpolicy.mod.Logger.dump("otherIdent: " + otherIdent);
        var submenu = this._createOtherOriginMenu(
              otherBase, otherOrigins, otherIdent);
              
        var otherUriObj = requestpolicy.mod.DomainUtil.getUriObject(
              otherIdent);
              
        this._addRejectedRequests(submenu, null, otherUriObj, currentIdentifier,
              otherOrigins, privateBrowsingEnabled, currentBaseDomain);
  
        this._addAllowedRequests(submenu, null, otherUriObj, currentIdentifier,
              otherOrigins, privateBrowsingEnabled, currentBaseDomain);
      }

      requestpolicy.mod.Logger.dump("otherBase: " + otherBase);
      var submenu = this._createOtherOriginMenu(
            otherBase, otherOrigins, otherBase);

requestpolicy.mod.Logger.dump(" 1 otherBase: " + otherBase);

      var otherUriObj = requestpolicy.mod.DomainUtil.getUriObject(
            "http://" + otherBase);
            
requestpolicy.mod.Logger.dump(" 2 otherBase: " + otherBase);

      this._addRejectedRequests(submenu, null, otherUriObj, currentIdentifier,
            otherOrigins, privateBrowsingEnabled, currentBaseDomain);

      this._addAllowedRequests(submenu, null, otherUriObj, currentIdentifier,
            otherOrigins, privateBrowsingEnabled, currentBaseDomain);

      // currentOtherOriginMenu = this._createOtherOriginMenu(
      //     otherBase, otherOrigins);

      // If there are no blocked/allowed destinations from this other origin,
      // don't display it.
      // // TODO: remove "0 &&"
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
    // TODO: fix this
    this._itemOtherOrigins.hidden = true;
    //this._itemOtherOrigins.hidden = this._itemOtherOriginsSeparator.hidden = (otherOriginMenuCount == 0);
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

  addMenu2 : function(parentMenu, label, indent) {
    var menu = document.createElement("menu");
    var indentStr = indent ? "      " : "";
    menu.setAttribute("label", this._strbundle.getFormattedString(
            "indentedText", [indentStr, label]));
    //menu.setAttribute("label", label);
    parentMenu.insertBefore(menu, parentMenu.firstChild);
    // add the menu popup in the menu item
    var menuPopup = document.createElement("menupopup");
    menu.insertBefore(menuPopup, menu.firstChild);
    // return the popup as that's what will have items added to it
    return menuPopup;
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
      isMainMenu, isFullIdentifier) {
    var menu = document.createElement("menu");
    // This seems to be the easiest way to deal with indenting ltr/rtl text,
    // given that there was either a bug in the babelzilla system or having the
    // spaces in the properties files was confusing the translators. Don't want
    // to use css because I think it would require putting a margin/padding on
    // both the left and right, and so result in extra margin on the side that
    // doesn't need to be indented.
    //var indentStr = isFullIdentifier ? "        " : "    ";
    var indentStr = isFullIdentifier ? "      " : "";
    menu.setAttribute("label", this._strbundle.getFormattedString(
            "indentedText", [indentStr, label]));
    var cssClass = isFullIdentifier ? "requestpolicyBlockedFullIdentifier" :
          "requestpolicyBlocked";
    menu.setAttribute("class", cssClass);
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
      isMainMenu, isFullIdentifier) {
    var menu = document.createElement("menu");
    //var indentStr = isFullIdentifier ? "        " : "    ";
    var indentStr = isFullIdentifier ? "      " : "";
    menu.setAttribute("label", this._strbundle.getFormattedString(
            "indentedText", [indentStr, label]));
    var cssClass = isFullIdentifier ? "requestpolicyAllowedFullIdentifier" :
          "requestpolicyAllowed";
    menu.setAttribute("class", cssClass);
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

  _ruleDataPartToDisplayString : function(ruleDataPart) {
    var str = "";
    if (ruleDataPart["s"]) {
      str += ruleDataPart["s"] + "://";
    }
    str += ruleDataPart["h"] ? ruleDataPart["h"] : "*";
    if (ruleDataPart["port"]) {
      str += ":" + ruleDataPart["port"];
    }
    // TODO: path
    return str;
  },

  _ruleDataToFormatVariables : function(rawRule) {
    var fmtVars = [];
    if (rawRule["o"]) {
      fmtVars.push(this._ruleDataPartToDisplayString(rawRule["o"]));
    }
    if (rawRule["d"]) {
      fmtVars.push(this._ruleDataPartToDisplayString(rawRule["d"]));
    }
    return fmtVars;
  },

  addMenuItemAddAllowRule : function(menu, rawRule, isTemporary) {
    var fmtVars = this._ruleDataToFormatVariables(rawRule);
    
    if (rawRule["o"] && rawRule["d"]) {
      var fmtName = "allowOriginToDestination";
    } else if (rawRule["o"]) {
      fmtName = "allowOrigin";
    } else if (rawRule["d"]) {
      fmtName = "allowDestination";
    } else {
      throw "Invalid rule data: no origin or destination parts.";
    }

    if (isTemporary) {
      fmtName += "Temporarily";
      command = "requestpolicy.overlay.addAllowRule(event);";
    } else {
      command = "requestpolicy.overlay.addTemporaryAllowRule(event);";
    }
 
    var label = this._strbundle.getFormattedString(fmtName, fmtVars);
    var statustext = ""; // TODO
    var item = this.addMenuItem(menu, label, command, statustext);
    item.requestpolicyRawRule = rawRule;
    if (isTemporary) {
      item.setAttribute("class", "requestpolicyTemporary");
    }
    return item;
  },

  addMenuItemRemoveAllowRule : function(menu, rawRule) {
    var fmtVars = this._ruleDataToFormatVariables(rawRule);
    
    if (rawRule["o"] && rawRule["d"]) {
      var fmtName = "stopAllowingOriginToDestination";
    } else if (rawRule["o"]) {
      fmtName = "stopAllowingOrigin";
    } else if (rawRule["d"]) {
      fmtName = "stopAllowingDestination";
    } else {
      throw "Invalid rule data: no origin or destination parts.";
    }
    
    var label = this._strbundle.getFormattedString(fmtName, fmtVars);
    
    // TODO: implement removeAllowRule
    var command = "requestpolicy.overlay.removeAllowRule(event);";
    var statustext = ""; // TODO
    var item = this.addMenuItem(menu, label, command, statustext);
    item.requestpolicyRawRule = rawRule;
    // Take an argument to the current function that specifies whether this
    // is only a temporary rule.
    //item.setAttribute("class", "requestpolicyTemporary");
    return item;
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

  addMenuItemTemporarilyAllowDest : function(menu, ruleData) {
    // TODO: generate the text to include all aspects of the rule, then
    // rewrite code here and prepareMenu to call the same generator function
    // or two (maybe a separate one for temporary).
    var destHost = ruleData["d"]["h"];
    var label = this._strbundle.getFormattedString(
        "allowDestinationTemporarily", [destHost]);
    var command = "requestpolicy.overlay.temporarilyAllowDestination('"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    var item = this.addMenuItem(menu, label, command, statustext);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  },

  addMenuItemTemporarilyAllowOriginToDest : function(menu, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
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

  addMenuItemAllowDest : function(menu, ruleData) {
    var destHost = ruleData["d"]["h"];
    var label = this._strbundle.getFormattedString("allowDestination",
        [destHost]);
    var command = "requestpolicy.overlay.allowDestination('"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    return this.addMenuItem(menu, label, command, statustext);
  },

  addMenuItemAllowOriginToDest : function(menu, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
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

/*
  _createOtherOriginMenu : function(otherBaseDomain, otherOrigins, otherFullIdent) {
    // var originBaseDomain = requestpolicy.mod.DomainUtil.getDomain(
    //       originIdentifier);

    if (otherFullIdent) {
      // TODO: this isn't quite right. We need to take into account port
      // and scheme with nonstandard ports and https->http requests.
      // Do we really need different items for scheme? Maybe we can do
      // it just for non-standard ports.
      var label = requestpolicy.mod.DomainUtil.getHost(otherFullIdent);
      var menu = this.addMenu2(this._itemOtherOriginsPopup, label, true);  
    } else {
      var menu = this.addMenu2(this._itemOtherOriginsPopup, otherBaseDomain, false);  
    }
    //return menu;

    // for (var otherFullIdent in otherOrigins[otherBaseDomain]) {
    //    var subMenu
    // }

    // var menu = this.addAllowedDestination(this._itemOtherOriginsPopup, null,
    //       otherBaseDomain, false, false);
          
    //return menu;

    // var menu = addAllowedDestination(this._itemOtherOriginsPopup, null, label,
    //       isMainMenu, isFullIdentifier)

    //var menu = this.addMenu(this._itemOtherOriginsPopup, otherBaseDomain);
    var newNode;

    // This will indicate whether the menu is worth displaying.
    menu.meaningfulChildCount = 0;

    // TODO: this is the bottom of the submenu which gives the option
    // to whitelist/forbid the origin itself.
    // if (this._rpService.isTemporarilyAllowedOrigin(originIdentifier)
    //     || this._rpService.isAllowedOrigin(originIdentifier)) {
    //   this.addMenuItemForbidOrigin(menu, originIdentifier);
    // } else {
    //   this.addMenuItemTemporarilyAllowOrigin(menu, originIdentifier);
    //   this.addMenuItemAllowOrigin(menu, originIdentifier);
    // }
    // 
    // this.addMenuSeparator(menu);

    // Def:
    //     getAllowedRequests : function(currentUri, currentIdentifier, otherOrigins) 
    var allowedIdentifiers = requestpolicy.mod.RequestUtil.getAllowedRequests(
        null, otherFullIdent, otherOrigins);
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
*/

  _createOtherOriginMenu : function(otherBase, otherOrigins, otherIdent) {
    // var originBaseDomain = requestpolicy.mod.DomainUtil.getDomain(
    //       originIdentifier);

    if (otherIdent) {
      // TODO: this isn't quite right. We need to take into account port
      // and scheme with nonstandard ports and https->http requests.
      // Do we really need different items for scheme? Maybe we can do
      // it just for non-standard ports.
      var label = requestpolicy.mod.DomainUtil.getHost(otherIdent);
      var menu = this.addMenu2(this._itemOtherOriginsPopup, label, true);  
    } else {
      var menu = this.addMenu2(this._itemOtherOriginsPopup, otherBase, false);  
    }
    //return menu;

    // for (var otherFullIdent in otherOrigins[otherBaseDomain]) {
    //    var subMenu
    // }

    // var menu = this.addAllowedDestination(this._itemOtherOriginsPopup, null,
    //       otherBaseDomain, false, false);
          
    //return menu;

    // var menu = addAllowedDestination(this._itemOtherOriginsPopup, null, label,
    //       isMainMenu, isFullIdentifier)

    //var menu = this.addMenu(this._itemOtherOriginsPopup, otherBaseDomain);
    var newNode;

    // This will indicate whether the menu is worth displaying.
    menu.meaningfulChildCount = 0;
    // TODO: change back to 0
    //menu.meaningfulChildCount = 1;

    // TODO: this is the bottom of the submenu which gives the option
    // to whitelist/forbid the origin itself.
    // if (this._rpService.isTemporarilyAllowedOrigin(originIdentifier)
    //     || this._rpService.isAllowedOrigin(originIdentifier)) {
    //   this.addMenuItemForbidOrigin(menu, originIdentifier);
    // } else {
    //   this.addMenuItemTemporarilyAllowOrigin(menu, originIdentifier);
    //   this.addMenuItemAllowOrigin(menu, originIdentifier);
    // }
    // 
    // this.addMenuSeparator(menu);

    // Def:
    //     getAllowedRequests : function(currentUri, currentIdentifier, otherOrigins) 
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
          otherIdent);
    var allowedReqSet = requestpolicy.mod.RequestUtil.getAllowedRequests(
        null, otherIdent, otherOrigins);
    var allowedRequests = allowedReqSet.getAllMergedOrigins();
    allowedReqSet.print("other origins allowedReqSet: " +  otherIdent);
        
    // requestpolicy.mod.RequestUtil.dumpRequestSet(allowedIdentifiers,
    //       "other origin allowedRequests");
    
    for (var destBase in allowedRequests) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
        "destBase in other origin allowedRequests: " + destBase);
      // Ignore allowed requests that are to the same site.
      if (destBase == otherIdent) {
        continue;
      }
      menu.meaningfulChildCount++;
      var submenu = this.addAllowedDestination(menu, menu.firstChild, destBase, false);
      var otherOriginBase = requestpolicy.mod.DomainUtil.getDomain(otherIdent);
      var originRulePart = {"h" :  this._addWildcard(otherOriginBase)};
      var destRulePart = {"h" :  this._addWildcard(destBase)};
      this._populateOtherOriginsMenuItemAllowedDestinations(submenu,
          originRulePart, destRulePart);
    }

    newNode = this._allowedDestinationsHeadingMenuItem.cloneNode(true);
    newNode.setAttribute("id", null);
    menu.insertBefore(newNode, menu.firstChild);

    this.addMenuSeparator(menu);

    var blockedReqSet = requestpolicy.mod.RequestUtil.getRejectedRequests(
        null, otherIdent, otherOrigins);
    var blockedRequests = blockedReqSet.getAllMergedOrigins();
    blockedReqSet.print("other origins blockedRequests: " +  otherIdent);
    for (var destBase in blockedRequests) {
      menu.meaningfulChildCount++;
      var submenu = this.addBlockedDestination(menu, menu.firstChild, destBase, false);
      var otherOriginBase = requestpolicy.mod.DomainUtil.getDomain(otherIdent);
      var originRulePart = {"h" :  this._addWildcard(otherOriginBase)};
      var destRulePart = {"h" :  this._addWildcard(destBase)};
      this._populateOtherOriginsMenuItemBlockedDestinations(submenu,
          originRulePart, destRulePart);
    }

    newNode = this._blockedDestinationsHeadingMenuItem.cloneNode(true);
    newNode.setAttribute("id", null);
    menu.insertBefore(newNode, menu.firstChild);

    return menu;
  },

//  _populateOtherOriginsMenuItemBlockedDestinations : function(submenu,
//      originIdent, destIdent) {
  _populateOtherOriginsMenuItemBlockedDestinations : function(submenu,
      originRulePart, destRulePart) {
    // TODO
    var ruleData = {"d" : destRulePart};
//    var fakeRuleData = {"d":{"h":"*." + originBase},"o":{"h":"*." + destBase}};
    this.addMenuItemTemporarilyAllowDest(submenu, ruleData);
    this.addMenuItemAllowDest(submenu, ruleData);
    this.addMenuSeparator(submenu);
    ruleData["o"] = originRulePart;
    this.addMenuItemTemporarilyAllowOriginToDest(submenu, ruleData);
    this.addMenuItemAllowOriginToDest(submenu, ruleData);
  },

  _populateOtherOriginsMenuItemAllowedDestinations : function(submenu,
      originRulePart, destRulePart) {
    // TODO: implement
    // if (this._rpService.isAllowedOrigin(originIdentifier)
    //     || this._rpService.isTemporarilyAllowedOrigin(originIdentifier)) {
    //   this.addMenuItemForbidOrigin(submenu, originIdentifier);
    // 
    // } else if (this._rpService.isAllowedDestination(destIdentifier)
    //     || this._rpService.isTemporarilyAllowedDestination(destIdentifier)) {
    //   this.addMenuItemForbidDest(submenu, destIdentifier);
    // 
    // } else if (this._rpService.isAllowedOriginToDestination(originIdentifier,
    //     destIdentifier)
    //     || this._rpService.isTemporarilyAllowedOriginToDestination(
    //         originIdentifier, destIdentifier)) {
    //   this.addMenuItemForbidOriginToDest(submenu, originIdentifier,
    //       destIdentifier);
    // 
    // } else {
    //   // TODO: make very sure this can never happen or, better, get an idea
    //   // of when it can and make a sane default.
    // }
  },

  _sanitizeJsFunctionArg : function(str) {
    // strip single quotes and backslashes
    return str.replace(/['\\]/g, "");
  }

}
