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

  _originItem : null,
  _otherOriginsList : null,
  _blockedDestinationsList : null,
  _mixedDestinationsList : null,
  _allowedDestinationsList : null,
  _removeRulesList : null,
  _addRulesList : null,

  _isCurrentlySelectedDestBlocked : null,
  _isCurrentlySelectedDestAllowed : null,

  init : function() {
    if (this._initialized == false) {
      this._initialized = true;

      this._rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
          .getService(Components.interfaces.nsIRequestPolicy);
      this._rpServiceJSObject = this._rpService.wrappedJSObject;

      this._strbundle = document.getElementById("requestpolicyStrings");
      this._menu = document.getElementById("rp-popup");

      this._originItem = document.getElementById("rp-origin");
      this._otherOriginsList = document.getElementById("rp-other-origins-list");
      this._blockedDestinationsList = document
            .getElementById("rp-blocked-destinations-list");
      this._mixedDestinationsList = document
            .getElementById("rp-mixed-destinations-list");
      this._allowedDestinationsList = document
            .getElementById("rp-allowed-destinations-list");
      this._addRulesList = document.getElementById("rp-rules-add");
      this._removeRulesList = document.getElementById("rp-rules-remove");

      var conflictCount = this._rpServiceJSObject.getConflictingExtensions().length;
      var hideConflictInfo = (conflictCount == 0);
    }
  },

  prepareMenu : function() {
    try {
      this._currentUri = requestpolicy.overlay.getTopLevelDocumentUri();

      try {
        this._currentBaseDomain = requestpolicy.mod.DomainUtil.getDomain(
              this._currentUri);
      } catch (e) {
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
              "Unable to prepare menu because base domain can't be determined: " + this._currentUri);
        this._populateMenuForUncontrollableOrigin();
        return;
      }

      this._currentIdentifier = requestpolicy.overlay
            .getTopLevelDocumentUriIdentifier();

      //requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
      //                              "this._currentUri: " + this._currentUri);
      this._currentUriObj = requestpolicy.mod.DomainUtil.getUriObject(this._currentUri);

      this._isChromeUri = this._currentUriObj.scheme == "chrome";
      //this._currentUriIsHttps = this._currentUriObj.scheme == "https";

      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
                                    "this._currentUri: " + this._currentUri);

      if (this._isChromeUri) {
        this._populateMenuForUncontrollableOrigin();
        return;
      }

      // The fact that getOtherOrigins uses documentURI directly from
      // content.document is important because getTopLevelDocumentUri will
      // not return the real documentURI if there is an applicable
      // top-level document translation rule (these are used sometimes
      // for extension compatibility). For example, this is essential to the
      // menu showing relevant info when using the Update Scanner extension.
      this._otherOriginsReqSet = requestpolicy.mod.RequestUtil
            .getOtherOrigins(content.document);
      this._otherOrigins = this._otherOriginsReqSet.getAllMergedOrigins();
      this._otherOriginsReqSet.print("_otherOriginsReqSet");

      this._privateBrowsingEnabled = this._rpService.isPrivateBrowsingEnabled()
            && !this._rpService.prefs.getBoolPref("privateBrowsingPermanentWhitelisting");

//      var hidePrefetchInfo = !this._rpService.isPrefetchEnabled();
//      this._itemPrefetchWarning.hidden = hidePrefetchInfo;
//      this._itemPrefetchWarningSeparator.hidden = hidePrefetchInfo;
//
//      if (isChromeUri) {
//        this._itemUnrestrictedOrigin.setAttribute("label", this._strbundle
//          .getFormattedString("unrestrictedOrigin", ["chrome://"]));
//        this._itemUnrestrictedOrigin.hidden = false;
//        return;
//      }

      this._populateOrigin();
      this._populateOtherOrigins();
      this._activateOriginItem(this._originItem);

    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
                                      "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
                                      "Unable to prepare menu due to error.");
      throw e;
    }
  },

  _populateMenuForUncontrollableOrigin : function() {
    this._originItem.setAttribute('value', '[no origin]');
    this._removeChildren(this._otherOriginsList);
    this._removeChildren(this._blockedDestinationsList);
    this._removeChildren(this._mixedDestinationsList);
    this._removeChildren(this._allowedDestinationsList);
    this._removeChildren(this._removeRulesList);
    this._removeChildren(this._addRulesList);
    document.getElementById('rp-other-origins').hidden = true;
    document.getElementById('rp-blocked-destinations').hidden = true;
    document.getElementById('rp-mixed-destinations').hidden = true;
    document.getElementById('rp-allowed-destinations').hidden = true;
    // TODO: show some message about why the menu is empty.
  },

  _populateList : function(list, values) {
    this._removeChildren(list);
    values.sort();
    for (var i in values) {
      this._addListItem(list, 'rp-od-item', values[i]);
    }
    //this._disableIfNoChildren(list);
  },

  _populateOrigin : function() {
    this._originItem.setAttribute('value', this._currentBaseDomain);
  },

  _populateOtherOrigins : function() {
    var values = this._getOtherOrigins();
    this._populateList(this._otherOriginsList, values);
    document.getElementById('rp-other-origins').hidden = values.length == 0;
  },

  _populateDestinations : function(originIdentifier) {
    var rawBlocked = this._getBlockedDestinations();
    var rawAllowed = this._getAllowedDestinations();
    var blocked = [];
    var mixed = [];
    var allowed = [];

    // Set operations would be nice. These are small arrays, so keep it simple.
    for (var i = 0; i < rawBlocked.length; i++) {
      let dest = rawBlocked[i];
      if (rawAllowed.indexOf(dest) == -1) {
        blocked.push(dest);
      } else {
        mixed.push(dest);
      }
    }
    for (var i = 0; i < rawAllowed.length; i++) {
      let dest = rawAllowed[i];
      if (rawBlocked.indexOf(dest) == -1) {
        allowed.push(dest);
      } else if (mixed.indexOf(dest) == -1) {
        mixed.push(dest);
      }
    }

    this._populateList(this._blockedDestinationsList, blocked);
    document.getElementById('rp-blocked-destinations').hidden = blocked.length == 0;

    this._populateList(this._mixedDestinationsList, mixed);
    document.getElementById('rp-mixed-destinations').hidden = mixed.length == 0;

    this._populateList(this._allowedDestinationsList, allowed);
    document.getElementById('rp-allowed-destinations').hidden = allowed.length == 0;
  },

  _populateDetails : function() {
    var origin = this._currentlySelectedOrigin;
    var dest = this._currentlySelectedDest;
    this._removeChildren(this._removeRulesList);
    this._removeChildren(this._addRulesList);

    var ruleData = {
      'o' : {
        'h' : this._addWildcard(origin)
      }
    };

    // Note: in PBR we'll need to still use the old string for the temporary
    // rule. We won't be able to use just "allow temporarily".

    if (!this._currentlySelectedDest) {
      if (this._rpServiceJSObject.isDefaultAllow()) {
        // It seems pretty rare that someone will want to add a rule to block all
        // requests from a given origin.
        //if (!this._privateBrowsingEnabled) {
        //  var item = this._addMenuItemDenyOrigin(
        //    this._addRulesList, ruleData);
        //}
        //var item = this._addMenuItemTempDenyOrigin(this._addRulesList, ruleData);
      } else {
        if (!this._privateBrowsingEnabled) {
          var item = this._addMenuItemAllowOrigin(
            this._addRulesList, ruleData);
        }
        var item = this._addMenuItemTempAllowOrigin(this._addRulesList, ruleData);
      }
    }

    if (dest) {
      ruleData['d'] = {
        'h' : this._addWildcard(dest)
      };
      var destOnlyRuleData = {
        'd' : {
          'h' : this._addWildcard(dest)
        }
      };
      if (this._rpServiceJSObject.isDefaultAllow()) {
        if (!this._privateBrowsingEnabled) {
          var item = this._addMenuItemDenyOriginToDest(
            this._addRulesList, ruleData);
        }
        var item = this._addMenuItemTempDenyOriginToDest(
          this._addRulesList, ruleData);

        if (!this._privateBrowsingEnabled) {
          var item = this._addMenuItemDenyDest(
            this._addRulesList, destOnlyRuleData);
        }
        var item = this._addMenuItemTempDenyDest(
          this._addRulesList, destOnlyRuleData);

      } else {
        if (!this._privateBrowsingEnabled) {
          var item = this._addMenuItemAllowOriginToDest(
            this._addRulesList, ruleData);
        }
        var item = this._addMenuItemTempAllowOriginToDest(
          this._addRulesList, ruleData);

        if (!this._privateBrowsingEnabled) {
          var item = this._addMenuItemAllowDest(
            this._addRulesList, destOnlyRuleData);
        }
        var item = this._addMenuItemTempAllowDest(
          this._addRulesList, destOnlyRuleData);
      }
    }

    this._populateDetailsRemoveAllowRules(this._removeRulesList);
    this._populateDetailsRemoveDenyRules(this._removeRulesList);
  },

  _removeChildren : function(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  },

  _addListItem : function(list, cssClass, value) {
    var item = document.createElement("label");
    item.setAttribute("value", value);
    item.setAttribute("class", cssClass);
    item.setAttribute("onclick", 'requestpolicy.menu.itemSelected(event);');
    list.insertBefore(item, null);
    return item;
  },

  _disableIfNoChildren : function(el) {
    // TODO: this isn't working.
    el.hidden = el.firstChild ? false : true;
  },

  _resetSelectedOrigin : function() {
    this._originItem.setAttribute('selected-origin', 'false');
    for (var i = 0; i < this._otherOriginsList.childNodes.length; i++) {
      var child = this._otherOriginsList.childNodes[i];
      child.setAttribute('selected-origin', 'false');
    }
  },

  _resetSelectedDest : function() {
    for (var i = 0; i < this._blockedDestinationsList.childNodes.length; i++) {
      var child = this._blockedDestinationsList.childNodes[i];
      child.setAttribute('selected-dest', 'false');
    }
    for (var i = 0; i < this._mixedDestinationsList.childNodes.length; i++) {
      var child = this._mixedDestinationsList.childNodes[i];
      child.setAttribute('selected-dest', 'false');
    }
    for (var i = 0; i < this._allowedDestinationsList.childNodes.length; i++) {
      var child = this._allowedDestinationsList.childNodes[i];
      child.setAttribute('selected-dest', 'false');
    }
  },

  _activateOriginItem : function(item) {
    this._currentlySelectedOrigin = item.value;
    this._currentlySelectedDest = null;
    // TODO: if the document's origin (rather than an other origin) is being
    // activated, then regenerate the other origins list, as well.
    this._resetSelectedOrigin();
    item.setAttribute('selected-origin', 'true');
    this._populateDestinations();
    this._resetSelectedDest();
    this._populateDetails();
  },

  _activateDestinationItem : function(item) {
    this._currentlySelectedDest = item.value;

    if (item.parentNode.id == 'rp-blocked-destinations-list') {
      this._isCurrentlySelectedDestBlocked = true;
      this._isCurrentlySelectedDestAllowed = false;
    } else if (item.parentNode.id == 'rp-allowed-destinations-list') {
      this._isCurrentlySelectedDestBlocked = false;
      this._isCurrentlySelectedDestAllowed = true;
    } else {
      this._isCurrentlySelectedDestBlocked = true;
      this._isCurrentlySelectedDestAllowed = true;
    }

    this._resetSelectedDest();
    item.setAttribute('selected-dest', 'true');
    this._populateDetails();
  },


  itemSelected : function(event) {
    var item = event.target;
    // TODO: rather than compare IDs, this should probably compare against
    // the elements we already have stored in variables. That is, assuming
    // equality comparisons work that way here.
    if (item.id == 'rp-origin' ||
        item.parentNode.id == 'rp-other-origins-list') {
      this._activateOriginItem(item);
    } else if (item.parentNode.id == 'rp-blocked-destinations-list' ||
               item.parentNode.id == 'rp-mixed-destinations-list' ||
               item.parentNode.id == 'rp-allowed-destinations-list') {
      this._activateDestinationItem(item);
    } else if (item.parentNode.id == 'rp-rule-options' ||
               item.parentNode.id == 'rp-rules-remove' ||
               item.parentNode.id == 'rp-rules-add') {
      this._processRuleSelection(item);
    } else {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
            'Unable to figure out which item type was selected.');
    }
  },

  _processRuleSelection : function(item) {
    var ruleData = item.requestpolicyRuleData;
    var ruleAction = item.requestpolicyRuleAction;

    if (!ruleData) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
            'ruleData is empty in menu._processRuleSelection()');
      return;
    }
    if (!ruleAction) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
                                      'ruleAction is empty in menu._processRuleSelection()');
      return;
    }
    requestpolicy.mod.Logger.dump("ruleData: " + requestpolicy.mod.Policy.rawRuleToCanonicalString(ruleData));
    requestpolicy.mod.Logger.dump("ruleAction: " + ruleAction);

    // TODO: does all of this get replaced with a generic rule processor that
    // only cares whether it's an allow/deny and temporary and drops the ruleData
    // argument straight into the ruleset?
    var origin, dest;
    if (ruleData['o'] && ruleData['o']['h']) {
      origin = ruleData['o']['h'];
    }
    if (ruleData['d'] && ruleData['d']['h']) {
      dest = ruleData['d']['h'];
    }

    switch (ruleAction) {
      case 'allow':
        requestpolicy.overlay.addAllowRule(ruleData);
        break;
      case 'allow-temp':
        requestpolicy.overlay.addTemporaryAllowRule(ruleData);
        break;
      case 'stop-allow':
        requestpolicy.overlay.removeAllowRule(ruleData);
        break;
      case 'deny':
        requestpolicy.overlay.addDenyRule(ruleData);
        break;
      case 'deny-temp':
        requestpolicy.overlay.addTemporaryDenyRule(ruleData);
        break;
      case 'stop-deny':
        requestpolicy.overlay.removeDenyRule(ruleData);
        break;
      default:
        throw 'action not implemented: ' + ruleAction;
        break;
    }
  },


 // Note to self: It's been too long since I looked at some of the new code.
 // I think I may have assumed that I'd get rid of the different strictness
 // levels and just use what is currently called LEVEL_SOP. If using anything
 // else there will be errors from within RequestUtil.



  _getBlockedDestinations : function() {
    // Only pass a uri to getDeniedRequests if this isn't for listing the
    // blocked destinations of an other origin.
    var uri = null;
    if (this._currentBaseDomain == this._currentlySelectedOrigin) {
      uri = this._currentUri;
    }
    var ident = 'http://' + this._currentlySelectedOrigin;

    var reqSet = requestpolicy.mod.RequestUtil.getDeniedRequests(
          uri, ident, this._otherOrigins);
    var requests = reqSet.getAllMergedOrigins();

    var result = [];
    for (var destBase in requests) {
      result.push(destBase);
    }
    return result;
  },

  _getAllowedDestinations : function() {
    // Only pass a uri to getAllowedRequests if this isn't for listing the
    // blocked destinations of an other origin.
    var uri = null;
    if (this._currentBaseDomain == this._currentlySelectedOrigin) {
      uri = this._currentUri;
    }
    var ident = 'http://' + this._currentlySelectedOrigin;

    var reqSet = requestpolicy.mod.RequestUtil.getAllowedRequests(
          uri, ident, this._otherOrigins);
    var requests = reqSet.getAllMergedOrigins();

    var result = [];
    for (var destBase in requests) {
      result.push(destBase);
    }
    return result;
  },

  _getOtherOrigins : function() {
    var requests = this._otherOriginsReqSet.getAll();

    var result = [];
    for (var originUri in requests) {
      var domain = requestpolicy.mod.DomainUtil.getDomain(originUri);
      if (domain == this._currentBaseDomain) {
        continue;
      }
      // TODO: we should prevent chrome://browser/ URLs from getting anywhere
      // near here in the first place.
      // Is this an issue anymore? This may have been slipping through due to
      // a bug that has since been fixed. Disabling for now.
      //if (domain == 'browser') {
      //  continue;
      //}
      if (result.indexOf(domain) == -1) {
        result.push(domain);
      }
    }
    return result;
  },

  _sanitizeJsFunctionArg : function(str) {
    // strip single quotes and backslashes
    return str.replace(/['\\]/g, "");
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

  // TODO: the 12 _addMenuItem* functions below hopefully can be refactored.

  // Stop allowing

  _addMenuItemStopAllowingOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'stopAllowingOrigin', [originHost], 'stop-allow', 'rp-stop-allow');
  },

  _addMenuItemStopAllowingDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'stopAllowingDestination', [destHost], 'stop-allow', 'rp-stop-allow');
  },

  _addMenuItemStopAllowingOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'stopAllowingOriginToDestination', [originHost, destHost], 'stop-allow', 'rp-stop-allow');
  },

  // Allow

  _addMenuItemAllowOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowOrigin', [originHost], 'allow', 'rp-allow');
  },

  _addMenuItemAllowDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowDestination', [destHost], 'allow', 'rp-allow');
  },

  _addMenuItemAllowOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowOriginToDestination', [originHost, destHost], 'allow', 'rp-allow');
  },

  // Allow temp

  _addMenuItemTempAllowOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowOriginTemporarily', [originHost], 'allow-temp', 'rp-allow rp-temporary');
  },

  _addMenuItemTempAllowDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowDestinationTemporarily', [destHost], 'allow-temp', 'rp-allow rp-temporary');
  },

  _addMenuItemTempAllowOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowOriginToDestinationTemporarily', [originHost, destHost], 'allow-temp', 'rp-allow rp-temporary');
  },

  // Stop denying

  _addMenuItemStopDenyingOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'stopDenyingOrigin', [originHost], 'stop-deny', 'rp-stop-deny');
  },

  _addMenuItemStopDenyingDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'stopDenyingDestination', [destHost], 'stop-deny', 'rp-stop-deny');
  },

  _addMenuItemStopDenyingOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'stopDenyingOriginToDestination', [originHost, destHost], 'stop-deny', 'rp-stop-deny');
  },

  // Deny

  _addMenuItemDenyOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyOrigin', [originHost], 'deny', 'rp-deny');
  },

  _addMenuItemDenyDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyDestination', [destHost], 'deny', 'rp-deny');
  },

  _addMenuItemDenyOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyOriginToDestination', [originHost, destHost], 'deny', 'rp-deny');
  },

  // Deny temp

  _addMenuItemTempDenyOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyOriginTemporarily', [originHost], 'deny-temp', 'rp-deny rp-temporary');
  },

  _addMenuItemTempDenyDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyDestinationTemporarily', [destHost], 'deny-temp', 'rp-deny rp-temporary');
  },

  _addMenuItemTempDenyOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyOriginToDestinationTemporarily', [originHost, destHost], 'deny-temp', 'rp-deny rp-temporary');
  },

  _addMenuItemHelper : function(list, ruleData, fmtStrName, fmtStrArgs, ruleAction, cssClass) {
    var label = this._strbundle.getFormattedString(fmtStrName, fmtStrArgs);
    var item = this._addListItem(list, 'rp-od-item', label);
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = ruleAction;
    //var statustext = ''; // TODO
    item.setAttribute('class', 'rp-od-item ' + cssClass);
    return item;
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

  _addMenuItemRemoveAllowRule : function(list, rawRule) {
    var fmtVars = this._ruleDataToFormatVariables(rawRule);

    if (rawRule["o"] && rawRule["d"]) {
      return this._addMenuItemStopAllowingOriginToDest(list, rawRule);
    } else if (rawRule["o"]) {
      return this._addMenuItemStopAllowingOrigin(list, rawRule);
    } else if (rawRule["d"]) {
      return this._addMenuItemStopAllowingDest(list, rawRule);
    } else {
      throw "Invalid rule data: no origin or destination parts.";
    }
  },

  _addMenuItemRemoveDenyRule : function(list, rawRule) {
    var fmtVars = this._ruleDataToFormatVariables(rawRule);

    if (rawRule["o"] && rawRule["d"]) {
      return this._addMenuItemStopDenyingOriginToDest(list, rawRule);
    } else if (rawRule["o"]) {
      return this._addMenuItemStopDenyingOrigin(list, rawRule);
    } else if (rawRule["d"]) {
      return this._addMenuItemStopDenyingDest(list, rawRule);
    } else {
      throw "Invalid rule data: no origin or destination parts.";
    }
  },

  _populateDetailsRemoveAllowRules : function(list) {
    // TODO: can we avoid calling getAllowedRequests here and reuse a result
    // from calling it earlier?

    // Only pass a uri to getAllowedRequests if this isn't for listing the
    // blocked destinations of an other origin.
    var uri = null;
    if (this._currentBaseDomain == this._currentlySelectedOrigin) {
      uri = this._currentUri;
    }
    var ident = 'http://' + this._currentlySelectedOrigin;

    var reqSet = requestpolicy.mod.RequestUtil.getAllowedRequests(
          uri, ident, this._otherOrigins);
    var requests = reqSet.getAllMergedOrigins();

    var rules = {};

    //reqSet.print('allowedRequests');

    // TODO: there is no dest if no dest is selected (origin only).
    //var destBase = requestpolicy.mod.DomainUtil.getDomain(
    //      this._currentlySelectedDest);

    for (var destBase in requests) {

      if (this._currentlySelectedDest &&
          this._currentlySelectedDest != destBase) {
        continue;
      }

      for (var destIdent in requests[destBase]) {

        var destinations = requests[destBase][destIdent];
        for (var destUri in destinations) {

          // This will be null when the request was denied because of a default
          // allow rule. However about any other time?
          // TODO: we at least in default allow mode, we need to give an option
          // to add a deny rule for these requests.
          if (!destinations[destUri]) {
            requestpolicy.mod.Logger.dump("destinations[destUri] is null or undefined for destUri: " + destUri);
            continue;
          }
          requestpolicy.mod.Logger.dump("XXX allowed: " + destUri);

          var results = destinations[destUri];
          for (var i in results.matchedAllowRules) {

            var policy, match;
            [policy, match] = results.matchedAllowRules[i];
            var rawRule = requestpolicy.mod.Policy.matchToRawRule(match);
            var rawRuleStr = requestpolicy.mod.Policy.rawRuleToCanonicalString(rawRule);
            //requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
            //       "matched allow rule: " + rawRuleStr);
            // This is how we remove duplicates: if two rules have the same
            // canonical string, they'll have in the same key.
            rules[rawRuleStr] = rawRule;
          }
        }
      }
    }

    // TODO: sort these into some meaningful order.
    for (var i in rules) {
      this._addMenuItemRemoveAllowRule(list, rules[i]);
    }
  },

  _populateDetailsRemoveDenyRules : function(list) {
    // TODO: can we avoid calling getDeniedRequests here and reuse a result
    // from calling it earlier?

    // Only pass a uri to getDeniedRequests if this isn't for listing the
    // blocked destinations of an other origin.
    var uri = null;
    if (this._currentBaseDomain == this._currentlySelectedOrigin) {
      uri = this._currentUri;
    }
    var ident = 'http://' + this._currentlySelectedOrigin;

    var reqSet = requestpolicy.mod.RequestUtil.getDeniedRequests(
      uri, ident, this._otherOrigins);
    var requests = reqSet.getAllMergedOrigins();

    var rules = {};

    reqSet.print('deniedRequests');

    // TODO: there is no dest if no dest is selected (origin only).
    //var destBase = requestpolicy.mod.DomainUtil.getDomain(
    //      this._currentlySelectedDest);

    for (var destBase in requests) {

      if (this._currentlySelectedDest &&
        this._currentlySelectedDest != destBase) {
        continue;
      }

      for (var destIdent in requests[destBase]) {

        var destinations = requests[destBase][destIdent];
        for (var destUri in destinations) {

          // This will be null when the request was denied because of a default
          // deny rule. However about any other time?
          // TODO: we at least in default deny mode, we need to give an option
          // to add a allow rule for these requests.
          if (!destinations[destUri]) {
            requestpolicy.mod.Logger.dump("destinations[destUri] is null or undefined for destUri: " + destUri);
            continue;
          }
          requestpolicy.mod.Logger.dump("XXX denied: " + destUri);

          var results = destinations[destUri];
          for (var i in results.matchedDenyRules) {

            var policy, match;
            [policy, match] = results.matchedDenyRules[i];
            var rawRule = requestpolicy.mod.Policy.matchToRawRule(match);
            var rawRuleStr = requestpolicy.mod.Policy.rawRuleToCanonicalString(rawRule);
            //requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
            //       "matched allow rule: " + rawRuleStr);
            // This is how we remove duplicates: if two rules have the same
            // canonical string, they'll have in the same key.
            rules[rawRuleStr] = rawRule;
          }
        }
      }
    }

    // TODO: sort these into some meaningful order.
    for (var i in rules) {
      this._addMenuItemRemoveDenyRule(list, rules[i]);
    }
  },

}
