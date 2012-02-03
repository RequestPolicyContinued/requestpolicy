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
  _allowedDestinationsList : null,
  _ruleOptionsList : null,

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
      this._allowedDestinationsList = document
            .getElementById("rp-allowed-destinations-list");
      this._ruleOptionsList = document.getElementById("rp-rule-options");

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
        return;
      }

      this._currentIdentifier = requestpolicy.overlay
            .getTopLevelDocumentUriIdentifier();

      //requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
      //                              "this._currentUri: " + this._currentUri);
      this._currentUriObj = requestpolicy.mod.DomainUtil.getUriObject(this._currentUri);

//      this._isChromeUri = this._currentUriObj.scheme == "chrome";
//      this._currentUriIsHttps = currentUriObj.scheme == "https";

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

  _populateList : function(list, values) {
    this._removeChildren(list);
    for (var i in values) {
      this._addListItem(list, 'rp-od-item', values[i]);
    }
    this._disableIfNoChildren(list);
  },

  _populateOrigin : function() {
    this._originItem.setAttribute('value', this._currentBaseDomain);
  },

  _populateOtherOrigins : function() {
    this._populateList(this._otherOriginsList, this._getOtherOrigins());
  },

  _populateDestinations : function(originIdentifier) {
    this._populateList(this._allowedDestinationsList, this._getAllowedDestinations());
    this._populateList(this._blockedDestinationsList, this._getBlockedDestinations());
  },

  _populateDetails : function() {
    var origin = this._currentlySelectedOrigin;
    var dest = this._currentlySelectedDest;
    var list = this._ruleOptionsList;
    this._removeChildren(list);

    var ruleData = {
      'o' : {
        'h' : this._addWildcard(origin)
      }
    };
    if (!this._privateBrowsingEnabled) {
      var item = this._addMenuItemAllowOrigin(
            this._ruleOptionsList, ruleData);
    }
    var item = this._addMenuItemTemporarilyAllowOrigin(
          this._ruleOptionsList, ruleData);

    if (dest) {
      ruleData['d'] = {
        'h' : this._addWildcard(dest)
      };
      if (!this._privateBrowsingEnabled) {
        var item = this._addMenuItemAllowOriginToDest(
              this._ruleOptionsList, ruleData);
      }
      var item = this._addMenuItemTemporarilyAllowOriginToDest(
            this._ruleOptionsList, ruleData);
    }

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
    el.disabled = el.firstChild ? false : true;
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
    for (var i = 0; i < this._allowedDestinationsList.childNodes.length; i++) {
      var child = this._allowedDestinationsList.childNodes[i];
      child.setAttribute('selected-dest', 'false');
    }
  },

  _activateOriginItem : function(item) {
    this._currentlySelectedOrigin = item.value;
    this._currentlySelectedDest = null;
    this._resetSelectedOrigin();
    item.setAttribute('selected-origin', 'true');
    this._populateDestinations();
    this._resetSelectedDest();
    this._populateDetails();
  },

  _activateDestinationItem : function(item) {
    this._currentlySelectedDest = item.value;
    this._resetSelectedDest();
    item.setAttribute('selected-dest', 'true');
    this._populateDetails();
  },


  itemSelected : function(event) {
    var item = event.target;
    // TODO: rather than compare IDs, this should probably compare against
    // the elements we already have stored in variables. That is, assuming
    // equality comparisons work that way here.
    if (item.id == 'rp-origin' || item.parentNode.id == 'rp-other-origins-list') {
      this._activateOriginItem(item);
    } else if (item.parentNode.id == 'rp-other-origins-list' ||
               item.parentNode.id == 'rp-mixed-destinations-list' ||
               item.parentNode.id == 'rp-blocked-destinations-list' ||
               item.parentNode.id == 'rp-allowed-destinations-list') {
      this._activateDestinationItem(item);
    } else if (item.parentNode.id == 'rp-rule-options') {
      this._processRuleSelection(item);
    } else {
      throw 'Hulk confused';
    }
  },

  _processRuleSelection : function(item) {
    var ruleData = item.requestpolicyRuleData;
    var ruleAction = item.requestpolicyRuleAction;
    var ruleTemporary = item.requestpolicyRuleTemporary;

    requestpolicy.mod.Logger.dump("ruleData: " + requestpolicy.mod.Policy.rawRuleToCanonicalString(ruleData));
    requestpolicy.mod.Logger.dump("ruleAction: " + ruleAction);
    requestpolicy.mod.Logger.dump("ruleTemporary: " + ruleTemporary);

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
    if (ruleAction == 'allow') {
      if (ruleTemporary == 'true') {
        if (origin && dest) {
          requestpolicy.overlay.temporarilyAllowOriginToDestination(origin, dest);
        } else if (origin) {
          requestpolicy.overlay.temporarilyAllowOrigin(origin);
        } else if (dest) {
          requestpolicy.overlay.temporarilyAllowDestination(dest);
        } else {
          throw 'invalid ruleData';
        }
      } else {
        if (origin && dest) {
          requestpolicy.overlay.allowOriginToDestination(origin, dest);
        } else if (origin) {
          requestpolicy.overlay.allowOrigin(origin);
        } else if (dest) {
          requestpolicy.overlay.allowDestination(dest);
        } else {
          throw 'invalid ruleData';
        }
      }
    } else {
      if (origin && dest) {
        requestpolicy.overlay.forbidOriginToDestination(origin, dest);
      } else if (origin) {
        requestpolicy.overlay.forbidOrigin(origin);
      } else if (dest) {
        requestpolicy.overlay.forbidDestination(dest);
      } else {
        throw 'invalid ruleData';
      }
    }
  },


 // Note to self: It's been too long since I looked at some of the new code.
 // I think I may have assumed that I'd get rid of the different strictness
 // levels and just use what is currently called LEVEL_SOP. If using anything
 // else there will be errors from within RequestUtil.



  _getBlockedDestinations : function() {
    var reqSet = requestpolicy.mod.RequestUtil.getRejectedRequests(
          this._currentUri, this._currentIdentifier, this._otherOrigins);
    var requests = reqSet.getAllMergedOrigins();
    //reqSet.print("rejectedReqSet");

    var result = [];
    for (var destBase in requests) {
      result.push(destBase);
    }
    return result;
  },

  _getAllowedDestinations : function() {
    var reqSet = requestpolicy.mod.RequestUtil.getAllowedRequests(
      this._currentUri, this._currentIdentifier, this._otherOrigins);
    var requests = reqSet.getAllMergedOrigins();
    //reqSet.print("rejectedReqSet");

    var result = [];
    for (var destBase in requests) {
      result.push(destBase);
    }
    return result;
  },


  _getOtherOrigins : function() {
    return ['otherorigin.com', Math.random()];
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

  // TODO: the six _addMenuItem* functions below hopefully can be refactored.

  _addMenuItemForbidOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var label = this._strbundle.getFormattedString(
      "forbidOrigin", [originHost]);
    var item = this._addListItem(list, '', label);
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = 'forbid';
    //var statustext = destHost; // TODO
    // TODO: set a cssClass
    return item;
  },

  _addMenuItemForbidOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    var label = this._strbundle.getFormattedString(
      "forbidOriginToDestination", [originHost, destHost]);
    var item = this._addListItem(list, '', label);
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = 'forbid';
    //var statustext = destHost; // TODO
    // TODO: set a cssClass
    return item;
  },

  _addMenuItemAllowOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var label = this._strbundle.getFormattedString(
      "allowOrigin", [originHost]);
    var item = this._addListItem(list, '', label);
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = 'allow';
    //var statustext = destHost; // TODO
    // TODO: set a cssClass
    return item;
  },

  _addMenuItemAllowOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    var label = this._strbundle.getFormattedString(
      "allowOriginToDestination", [originHost, destHost]);
    var item = this._addListItem(list, '', label);
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = 'allow';
    //var statustext = destHost; // TODO
    // TODO: set a cssClass
    return item;
  },

  _addMenuItemTemporarilyAllowOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var label = this._strbundle.getFormattedString(
      "allowOriginTemporarily", [originHost]);
    var item = this._addListItem(list, '', label);
    item.requestpolicyRuleTemporary = true;
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = 'allow';
    //var statustext = destHost; // TODO
    // TODO: set a cssClass
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  },

  _addMenuItemTemporarilyAllowOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    var label = this._strbundle.getFormattedString(
      "allowOriginToDestinationTemporarily", [originHost, destHost]);
    var item = this._addListItem(list, '', label);
    item.requestpolicyRuleTemporary = true;
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = 'allow';
    //var statustext = destHost; // TODO
    // TODO: set a cssClass
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  },

//  _foo : function() {
//    var rules = {};
//    for (var destIdent in this._allowedRequests[destBase]) {
//      var destinations = allowedRequests[destBase][destIdent];
//      for (var destUri in destinations) {
//        var results = destinations[destUri];
//        for (var i in results.matchedAllowRules) {
//          var policy, match;
//          [policy, match] = results.matchedAllowRules[i];
//          var rawRule = requestpolicy.mod.Policy.matchToRawRule(match);
//          var rawRuleStr = requestpolicy.mod.Policy.rawRuleToCanonicalString(rawRule);
//          // requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
//          //       "matched allow rule: " + rawRuleStr);
//          // This is how we remove duplicates: if two rules have the same
//          // canonical string, they'll have in the same key.
//          rules[rawRuleStr] = rawRule;
//        }
//      }
//    }
//    // TODO: sort these into some meaningful order.
//    for (var i in rules) {
//      this.addMenuItemRemoveAllowRule(submenu, rules[i]);
//    }
//  },
//
//  _addMenuItemRemoveAllowRule : function(menu, rawRule) {
//    var fmtVars = this._ruleDataToFormatVariables(rawRule);
//
//    if (rawRule["o"] && rawRule["d"]) {
//      var fmtName = "stopAllowingOriginToDestination";
//    } else if (rawRule["o"]) {
//      fmtName = "stopAllowingOrigin";
//    } else if (rawRule["d"]) {
//      fmtName = "stopAllowingDestination";
//    } else {
//      throw "Invalid rule data: no origin or destination parts.";
//    }
//
//    var label = this._strbundle.getFormattedString(fmtName, fmtVars);
//
//    // TODO: implement removeAllowRule
//    var command = "requestpolicy.overlay.removeAllowRule(event);";
//    var statustext = ""; // TODO
//    var item = this._addListItem(this._ruleOptionsList, '', label);
//    item.requestpolicyRawRule = rawRule;
//    // Take an argument to the current function that specifies whether this
//    // is only a temporary rule.
//    //item.setAttribute("class", "requestpolicyTemporary");
//    return item;
//  },

}
