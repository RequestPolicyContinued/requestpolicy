/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

if (!rp) {
  var rp = {mod : {}};
}

Components.utils.import("chrome://requestpolicy/content/lib/domain-util.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/logger.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/ruleset.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/request-util.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/gui-location.jsm", rp.mod);

requestpolicy.menu = {

  _initialized : false,
  _rpService : null,

  _strbundle : null,
  addedMenuItems : [],
  _menu : null,

  _originItem : null,
  _originDomainnameItem : null,
  _originNumRequestsItem : null,

  _otherOriginsList : null,
  _blockedDestinationsList : null,
  _mixedDestinationsList : null,
  _allowedDestinationsList : null,
  _removeRulesList : null,
  _addRulesList : null,

  _isCurrentlySelectedDestBlocked : null,
  _isCurrentlySelectedDestAllowed : null,

  _ruleChangeQueues : {},

  init : function() {
    if (this._initialized == false) {
      this._initialized = true;

      this._rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
          .getService().wrappedJSObject;

      this._strbundle = document.getElementById("requestpolicyStrings");
      this._menu = document.getElementById("rp-popup");

      this._originItem = document.getElementById("rp-origin");
      this._originDomainnameItem = document.getElementById('rp-origin-domainname');
      this._originNumRequestsItem = document.getElementById('rp-origin-num-requests');

      this._otherOriginsList = document.getElementById("rp-other-origins-list");
      this._blockedDestinationsList = document
            .getElementById("rp-blocked-destinations-list");
      this._mixedDestinationsList = document
            .getElementById("rp-mixed-destinations-list");
      this._allowedDestinationsList = document
            .getElementById("rp-allowed-destinations-list");
      this._addRulesList = document.getElementById("rp-rules-add");
      this._removeRulesList = document.getElementById("rp-rules-remove");

      var conflictCount = this._rpService.getConflictingExtensions().length;
      var hideConflictInfo = (conflictCount == 0);
    }
  },

  prepareMenu : function() {
    try {
      var disabled = this._rpService._blockingDisabled;
      document.getElementById('rp-link-enable-blocking').hidden = !disabled;
      document.getElementById('rp-link-disable-blocking').hidden = disabled;

      document.getElementById('rp-revoke-temporary-permissions').hidden =
          !this._rpService.temporaryRulesExist();

      this._currentUri = requestpolicy.overlay.getTopLevelDocumentUri();

      try {
        this._currentBaseDomain = rp.mod.DomainUtil.getDomain(
              this._currentUri);
      } catch (e) {
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
              "Unable to prepare menu because base domain can't be determined: " + this._currentUri);
        this._populateMenuForUncontrollableOrigin();
        return;
      }

      this._currentIdentifier = requestpolicy.overlay
            .getTopLevelDocumentUriIdentifier();

      //rp.mod.Logger.info(rp.mod.Logger.TYPE_POLICY,
      //                              "this._currentUri: " + this._currentUri);
      this._currentUriObj = rp.mod.DomainUtil.getUriObject(this._currentUri);

      this._isChromeUri = this._currentUriObj.scheme == "chrome";
      //this._currentUriIsHttps = this._currentUriObj.scheme == "https";

      rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
                                    "this._currentUri: " + this._currentUri);

      if (this._isChromeUri) {
        this._populateMenuForUncontrollableOrigin();
        return;
      }

      // The fact that getAllRequestsOnDocument uses documentURI directly from
      // content.document is important because getTopLevelDocumentUri will
      // not return the real documentURI if there is an applicable
      // top-level document translation rule (these are used sometimes
      // for extension compatibility). For example, this is essential to the
      // menu showing relevant info when using the Update Scanner extension.
      this._allRequestsOnDocument = rp.mod.RequestUtil
            .getAllRequestsOnDocument(content.document);
      this._allRequestsOnDocument.print("_allRequestsOnDocument");

      this._privateBrowsingEnabled = this._rpService.isPrivateBrowsingEnabled()
            && !this._rpService.prefs.getBoolPref("privateBrowsingPermanentWhitelisting");

      this._setPrivateBrowsingStyles();

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
      rp.mod.Logger.severe(rp.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      rp.mod.Logger.severe(rp.mod.Logger.TYPE_ERROR,
          "Unable to prepare menu due to error.");
      throw e;
    }
  },

  _populateMenuForUncontrollableOrigin : function() {
    this._originDomainnameItem.setAttribute('value',
        this._strbundle.getFormattedString('noOrigin', []));
    this._originNumRequestsItem.setAttribute('value', '');
    this._originItem.removeAttribute("default-policy");
    this._originItem.removeAttribute("requests-blocked");

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

    // check whether there are objects of GUILocation or just strings
    var guiLocations = values[0] && (values[0] instanceof rp.mod.GUILocation);

    if (true === guiLocations) {
      // get prefs
      var sorting = this._rpService.prefs.getCharPref('menu.sorting');
      var showNumRequests = this._rpService.prefs.
          getBoolPref('menu.info.showNumRequests');

      if (sorting == "numRequests") {
        values.sort(rp.mod.GUILocation.sortByNumRequestsCompareFunction);
      } else if (sorting == "destName") {
        values.sort(rp.mod.GUILocation.compareFunction);
      }

      for (var i in values) {
        var guiLocation = values[i];
        var props = guiLocation.properties;

        var num = undefined;
        if (true === showNumRequests) {
          num = props.numRequests;
          if (props.numAllowedRequests > 0 && props.numBlockedRequests > 0) {
            num += " (" + props.numBlockedRequests +
                "+" + props.numAllowedRequests + ")";
          }
        }
        var newitem = this._addListItem(list, 'rp-od-item', guiLocation, num);

        newitem.setAttribute("default-policy",
            (props.numDefaultPolicyRequests > 0 ? "true" : "false"));
        newitem.setAttribute("requests-blocked",
            (props.numBlockedRequests > 0 ? "true" : "false"));
      }
    } else {
      values.sort();
      for (var i in values) {
        this._addListItem(list, 'rp-od-item', values[i]);
      }
    }
  },

  _populateOrigin : function() {
    this._originDomainnameItem.setAttribute("value", this._currentBaseDomain);

    var showNumRequests = this._rpService.prefs.
        getBoolPref('menu.info.showNumRequests');

    var props = this._getOriginGUILocationProperties();

    var numRequests = '';
    if (true === showNumRequests) {
      if (props.numAllowedRequests > 0 && props.numBlockedRequests > 0) {
        numRequests = props.numRequests + " (" +
            props.numBlockedRequests + "+" + props.numAllowedRequests + ")";
      } else {
        numRequests = props.numRequests;
      }
    }
    this._originNumRequestsItem.setAttribute("value", numRequests);

    this._originItem.setAttribute("default-policy",
        (props.numDefaultPolicyRequests > 0 ? "true" : "false"));
    this._originItem.setAttribute("requests-blocked",
        (props.numBlockedRequests > 0 ? "true" : "false"));
  },

  _populateOtherOrigins : function() {
    var guiOrigins = this._getOtherOriginsAsGUILocations();
    this._populateList(this._otherOriginsList, guiOrigins);
    document.getElementById('rp-other-origins').hidden = guiOrigins.length == 0;
  },

  _populateDestinations : function(originIdentifier) {
    var destsWithBlockedRequests = this._getBlockedDestinationsAsGUILocations();
    var destsWithAllowedRequests = this._getAllowedDestinationsAsGUILocations();

    var destsWithSolelyBlockedRequests = [];
    var destsMixed = [];
    var destsWithSolelyAllowedRequests = [];

    // Set operations would be nice. These are small arrays, so keep it simple.
    for (var i = 0; i < destsWithBlockedRequests.length; i++) {
      let blockedGUIDest = destsWithBlockedRequests[i];

      if (false === rp.mod.GUILocation.existsInArray(blockedGUIDest,
          destsWithAllowedRequests)) {
        destsWithSolelyBlockedRequests.push(blockedGUIDest);
      } else {
        destsMixed.push(blockedGUIDest);
      }
    }
    for (var i = 0; i < destsWithAllowedRequests.length; i++) {
      let allowedGUIDest = destsWithAllowedRequests[i];

      var indexRawBlocked = rp.mod.GUIDestination.
          indexOfDestInArray(allowedGUIDest, destsWithBlockedRequests);
      var destsMixedIndex = rp.mod.GUIDestination.
          indexOfDestInArray(allowedGUIDest, destsMixed);

      if (indexRawBlocked == -1) {
        destsWithSolelyAllowedRequests.push(allowedGUIDest);
      } else {
        if (destsMixedIndex != -1) {
          rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
              "Merging dest: <" + allowedGUIDest + ">");
          destsMixed[destsMixedIndex] = rp.mod.GUIDestination.merge(
              allowedGUIDest, destsMixed[destsMixedIndex]);
        } else {
          // If the allowedGUIDest is in destsWithBlockedRequests and
          // destsWithAllowedRequests, but not in destsMixed.
          // This should never happen, the destsMixed destination should have
          // been added in the destsWithBlockedRequests-loop.
          rp.mod.Logger.warning(rp.mod.Logger.TYPE_INTERNAL, "mixed dest was" +
              " not added to `destsMixed` list: <" + dest.dest + ">");
          destsMixed.push(allowedGUIDest);
        }
      }
    }

    this._populateList(this._blockedDestinationsList,
        destsWithSolelyBlockedRequests);
    document.getElementById('rp-blocked-destinations').hidden =
        destsWithSolelyBlockedRequests.length == 0;

    this._populateList(this._mixedDestinationsList, destsMixed);
    document.getElementById('rp-mixed-destinations').hidden =
        destsMixed.length == 0;

    this._populateList(this._allowedDestinationsList,
        destsWithSolelyAllowedRequests);
    document.getElementById('rp-allowed-destinations').hidden =
        destsWithSolelyAllowedRequests.length == 0;
  },

  _populateDetails : function() {
    var policyMgr = this._rpService._policyMgr;
    const RULE_ACTION_ALLOW = rp.mod.RULE_ACTION_ALLOW;
    const RULE_ACTION_DENY = rp.mod.RULE_ACTION_DENY;

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
      if (this._rpService.isDefaultAllow()) {
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
      //if (this._rpService.isDefaultAllow()) {
      if (this._isCurrentlySelectedDestAllowed ||
           (!policyMgr.ruleExists(RULE_ACTION_DENY, ruleData) &&
            !policyMgr.ruleExists(RULE_ACTION_DENY, destOnlyRuleData))) {
        // show "Block requests" if the destination was allowed
        // OR if there's no blocking rule (i.e. the request was blocked "by default")
        //  -- this enables support for blacklisting.
        if (!policyMgr.ruleExists(RULE_ACTION_ALLOW, ruleData) &&
            !policyMgr.ruleExists(RULE_ACTION_DENY, ruleData)) {
          if (!this._privateBrowsingEnabled) {
              var item = this._addMenuItemDenyOriginToDest(
                this._addRulesList, ruleData);
          }
          var item = this._addMenuItemTempDenyOriginToDest(
            this._addRulesList, ruleData);
        }

        if (!policyMgr.ruleExists(RULE_ACTION_ALLOW, destOnlyRuleData) &&
            !policyMgr.ruleExists(RULE_ACTION_DENY, destOnlyRuleData)) {
          if (!this._privateBrowsingEnabled) {
            var item = this._addMenuItemDenyDest(
              this._addRulesList, destOnlyRuleData);
          }
          var item = this._addMenuItemTempDenyDest(
            this._addRulesList, destOnlyRuleData);
        }
      }
      if (this._isCurrentlySelectedDestBlocked ||
           (!policyMgr.ruleExists(RULE_ACTION_ALLOW, ruleData) &&
            !policyMgr.ruleExists(RULE_ACTION_ALLOW, destOnlyRuleData))) {
        // show "Allow requests" if the destination was blocked
        // OR if there's no allow-rule (i.e. the request was allowed "by default")
        //  -- this enables support for whitelisting.
        if (!policyMgr.ruleExists(RULE_ACTION_ALLOW, ruleData) &&
            !policyMgr.ruleExists(RULE_ACTION_DENY, ruleData)) {
          if (!this._privateBrowsingEnabled) {
            var item = this._addMenuItemAllowOriginToDest(
              this._addRulesList, ruleData);
          }
          var item = this._addMenuItemTempAllowOriginToDest(
            this._addRulesList, ruleData);
        }

        if (!policyMgr.ruleExists(RULE_ACTION_ALLOW, destOnlyRuleData) &&
            !policyMgr.ruleExists(RULE_ACTION_DENY, destOnlyRuleData)) {
          if (!this._privateBrowsingEnabled) {
            var item = this._addMenuItemAllowDest(
              this._addRulesList, destOnlyRuleData);
          }
          var item = this._addMenuItemTempAllowDest(
            this._addRulesList, destOnlyRuleData);
        }
      }
    }

    if (this._currentlySelectedDest) {
      if (!this._rpService.isDefaultAllow() &&
          !this._rpService.isDefaultAllowSameDomain()) {
        this._populateDetailsAddSubdomainAllowRules(this._addRulesList);
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

  _addListItem : function(list, cssClass, value, numRequests) {
    var hbox = document.createElement("hbox");
    hbox.setAttribute("class", cssClass);
    hbox.setAttribute("onclick", 'requestpolicy.menu.itemSelected(event);');
    list.insertBefore(hbox, null);

    var destLabel = document.createElement("label");
    destLabel.setAttribute("value", value);
    destLabel.setAttribute("class", "domainname");
    destLabel.setAttribute("flex", "2");
    hbox.insertBefore(destLabel, null);

    if (numRequests) {
      var numReqLabel = document.createElement("label");
      numReqLabel.setAttribute("value", numRequests);
      numReqLabel.setAttribute("class", "numRequests");
      hbox.insertBefore(numReqLabel, null);
    }

    return hbox;
  },

  _disableIfNoChildren : function(el) {
    // TODO: this isn't working.
    el.hidden = el.firstChild ? false : true;
  },

  _setPrivateBrowsingStyles : function() {
    document.getElementById('rp-details').setAttribute(
      'class', this._privateBrowsingEnabled ? 'privatebrowsing' : '');
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
    if (item.id == 'rp-origin') {
      // it's _the_ origin
      this._currentlySelectedOrigin = this._originDomainnameItem.value;
    } else if (item.parentNode.id == 'rp-other-origins-list') {
      // it's an otherOrigin
      this._currentlySelectedOrigin = item.getElementsByClassName("domainname")[0].value;
    }
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
    this._currentlySelectedDest = item.getElementsByClassName("domainname")[0].value;

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
    if (item.nodeName == "label" && item.parentNode.nodeName == "hbox") {
      // item should be the <hbox>
      item = item.parentNode;
    }
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
      rp.mod.Logger.severe(rp.mod.Logger.TYPE_ERROR,
            'Unable to figure out which item type was selected.');
    }
  },

  _processRuleSelection : function(item) {
    var ruleData = item.requestpolicyRuleData;
    var ruleAction = item.requestpolicyRuleAction;

    if (item.getAttribute('selected-rule') == 'true') {
      item.setAttribute('selected-rule', 'false');
      var undo = true;
    } else {
      item.setAttribute('selected-rule', 'true');
      var undo = false;
    }

    if (!ruleData) {
      rp.mod.Logger.severe(rp.mod.Logger.TYPE_ERROR,
          'ruleData is empty in menu._processRuleSelection()');
      return;
    }
    if (!ruleAction) {
      rp.mod.Logger.severe(rp.mod.Logger.TYPE_ERROR,
          'ruleAction is empty in menu._processRuleSelection()');
      return;
    }

    var canonicalRule = rp.mod.Ruleset.rawRuleToCanonicalString(ruleData);
    rp.mod.Logger.dump("ruleData: " + canonicalRule);
    rp.mod.Logger.dump("ruleAction: " + ruleAction);
    rp.mod.Logger.dump("undo: " + undo);

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

    if (!this._ruleChangeQueues[ruleAction]) {
      this._ruleChangeQueues[ruleAction] = {};
    }

    if (undo) {
      delete this._ruleChangeQueues[ruleAction][canonicalRule];
    } else {
      this._ruleChangeQueues[ruleAction][canonicalRule] = ruleData;
    }
  },

  processQueuedRuleChanges: function() {
    var rulesChanged = false;
    for (var ruleAction in this._ruleChangeQueues) {
      for (var canonicalRule in this._ruleChangeQueues[ruleAction]) {
        var ruleData = this._ruleChangeQueues[ruleAction][canonicalRule];
        this._processRuleChange(ruleAction, ruleData);
        var rulesChanged = true;
      }
    }

    this._ruleChangeQueues = {};
    return rulesChanged;
  },

  _processRuleChange: function(ruleAction, ruleData) {

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


  _getBlockedDestinationsAsGUILocations : function() {
    var reqSet = rp.mod.RequestUtil.getDeniedRequests(
          this._currentlySelectedOrigin, this._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    var result = [];
    for (var destBase in requests) {
      var properties = new rp.mod.GUILocationProperties();
      properties.accumulate(requests[destBase], rp.mod.RULE_ACTION_DENY);
      result.push(new rp.mod.GUIDestination(destBase, properties));
    }
    return result;
  },

  _getAllowedDestinationsAsGUILocations : function() {
    var reqSet = rp.mod.RequestUtil.getAllowedRequests(
          this._currentlySelectedOrigin, this._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    var result = [];
    for (var destBase in requests) {
      // For everybody except users with default deny who are not allowing all
      // requests to the same domain:
      // Ignore the selected origin's domain when listing destinations.
      if (this._rpService.isDefaultAllow() ||
        this._rpService.isDefaultAllowSameDomain()) {
        if (destBase == this._currentlySelectedOrigin) {
          continue;
        }
      }

      var properties = new rp.mod.GUILocationProperties();
      properties.accumulate(requests[destBase], rp.mod.RULE_ACTION_ALLOW);
      result.push(new rp.mod.GUIDestination(destBase, properties));
    }
    return result;
  },

  /**
   * TODO: optimize this for performance (_getOriginGUILocationProperties and
   * _getOtherOriginsAsGUILocations could be merged.)
   *
   * @return {GUILocationProperties}
   *         the properties of the "main" origin (the one in the location bar).
   */
  _getOriginGUILocationProperties : function() {
    var allRequests = this._allRequestsOnDocument.getAll();

    var allowSameDomain = this._rpService.isDefaultAllow() ||
          this._rpService.isDefaultAllowSameDomain();

    var properties = new rp.mod.GUILocationProperties();

    for (var originUri in allRequests) {
      var originBase = rp.mod.DomainUtil.getDomain(originUri);
      if (originBase != this._currentBaseDomain) {
        continue;
      }

      for (var destBase in allRequests[originUri]) {
        properties.accumulate(allRequests[originUri][destBase]);
      }
    }
    return properties;
  },

  _getOtherOriginsAsGUILocations : function() {
    var allRequests = this._allRequestsOnDocument.getAll();

    var allowSameDomain = this._rpService.isDefaultAllow() ||
          this._rpService.isDefaultAllowSameDomain();

    var guiOrigins = [];
    for (var originUri in allRequests) {
      var originBase = rp.mod.DomainUtil.getDomain(originUri);
      if (originBase == this._currentBaseDomain) {
        continue;
      }

      // TODO: we should prevent chrome://browser/ URLs from getting anywhere
      // near here in the first place.
      // Is this an issue anymore? This may have been slipping through due to
      // a bug that has since been fixed. Disabling for now.
      //if (originBase == 'browser') {
      //  continue;
      //}

      var guiOriginsIndex = rp.mod.GUIOrigin.indexOfOriginInArray(originBase,
          guiOrigins);
      var properties;
      if (guiOriginsIndex == -1) {
        properties = new rp.mod.GUILocationProperties();
      } else {
        properties = guiOrigins[guiOriginsIndex].properties;
      }
      var addThisOriginBase = false;

      for (var destBase in allRequests[originUri]) {
        // Search for a destBase which wouldn't be allowed by the default policy.
        // TODO: some users might want to know those "other origins" as well.
        //       this should be made possible.

        // For everybody except users with default deny who are not allowing all
        // guiOrigins to the same domain:
        // Only list other origins where there is a destination from that origin
        // that is at a different domain, not just a different subdomain.
        if (allowSameDomain && destBase == originBase) {
          continue;
        }
        addThisOriginBase = true;
        properties.accumulate(allRequests[originUri][destBase]);
      }

      if (addThisOriginBase && guiOriginsIndex == -1) {
        guiOrigins.push(new rp.mod.GUIOrigin(originBase, properties));
      }
    }
    return guiOrigins;
  },

  _sanitizeJsFunctionArg : function(str) {
    // strip single quotes and backslashes
    return str.replace(/['\\]/g, "");
  },

  _isIPAddressOrSingleName : function(hostname) {
    return rp.mod.DomainUtil.isIPAddress(hostname) ||
      hostname.indexOf(".") == -1;
  },

  _addWildcard : function(hostname) {
    if (this._isIPAddressOrSingleName(hostname)) {
      return hostname;
    } else {
      return "*." + hostname;
    }
  },

  // TODO: the 12 _addMenuItem* functions below hopefully can be refactored.

  // Stop allowing

  _addMenuItemStopAllowingOrigin : function(list, ruleData, subscriptionOverride) {
    var originHost = ruleData["o"]["h"];
    var ruleAction = subscriptionOverride ? 'deny' : 'stop-allow';
    return this._addMenuItemHelper(list, ruleData, 'stopAllowingOrigin', [originHost], ruleAction, 'rp-stop-rule rp-stop-allow');
  },

  _addMenuItemStopAllowingDest : function(list, ruleData, subscriptionOverride) {
    var destHost = ruleData["d"]["h"];
    var ruleAction = subscriptionOverride ? 'deny' : 'stop-allow';
    return this._addMenuItemHelper(list, ruleData, 'stopAllowingDestination', [destHost], ruleAction, 'rp-stop-rule rp-stop-allow');
  },

  _addMenuItemStopAllowingOriginToDest : function(list, ruleData, subscriptionOverride) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    var ruleAction = subscriptionOverride ? 'deny' : 'stop-allow';
    return this._addMenuItemHelper(list, ruleData, 'stopAllowingOriginToDestination', [originHost, destHost], ruleAction, 'rp-stop-rule rp-stop-allow');
  },

  // Allow

  _addMenuItemAllowOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowOrigin', [originHost], 'allow', 'rp-start-rule rp-allow');
  },

  _addMenuItemAllowDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowDestination', [destHost], 'allow', 'rp-start-rule rp-allow');
  },

  _addMenuItemAllowOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowOriginToDestination', [originHost, destHost], 'allow', 'rp-start-rule rp-allow');
  },

  // Allow temp

  _addMenuItemTempAllowOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowOriginTemporarily', [originHost], 'allow-temp', 'rp-start-rule rp-allow rp-temporary');
  },

  _addMenuItemTempAllowDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowDestinationTemporarily', [destHost], 'allow-temp', 'rp-start-rule rp-allow rp-temporary');
  },

  _addMenuItemTempAllowOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'allowOriginToDestinationTemporarily', [originHost, destHost], 'allow-temp', 'rp-start-rule rp-allow rp-temporary');
  },

  // Stop denying

  _addMenuItemStopDenyingOrigin : function(list, ruleData, subscriptionOverride) {
    var originHost = ruleData["o"]["h"];
    var ruleAction = subscriptionOverride ? 'allow' : 'stop-deny';
    return this._addMenuItemHelper(list, ruleData, 'stopDenyingOrigin', [originHost], ruleAction, 'rp-stop-rule rp-stop-deny');
  },

  _addMenuItemStopDenyingDest : function(list, ruleData, subscriptionOverride) {
    var destHost = ruleData["d"]["h"];
    var ruleAction = subscriptionOverride ? 'allow' : 'stop-deny';
    return this._addMenuItemHelper(list, ruleData, 'stopDenyingDestination', [destHost], ruleAction, 'rp-stop-rule rp-stop-deny');
  },

  _addMenuItemStopDenyingOriginToDest : function(list, ruleData, subscriptionOverride) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    var ruleAction = subscriptionOverride ? 'allow' : 'stop-deny';
    return this._addMenuItemHelper(list, ruleData, 'stopDenyingOriginToDestination', [originHost, destHost], ruleAction, 'rp-stop-rule rp-stop-deny');
  },

  // Deny

  _addMenuItemDenyOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyOrigin', [originHost], 'deny', 'rp-start-rule rp-deny');
  },

  _addMenuItemDenyDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyDestination', [destHost], 'deny', 'rp-start-rule rp-deny');
  },

  _addMenuItemDenyOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyOriginToDestination', [originHost, destHost], 'deny', 'rp-start-rule rp-deny');
  },

  // Deny temp

  _addMenuItemTempDenyOrigin : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyOriginTemporarily', [originHost], 'deny-temp', 'rp-start-rule rp-deny rp-temporary');
  },

  _addMenuItemTempDenyDest : function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyDestinationTemporarily', [destHost], 'deny-temp', 'rp-start-rule rp-deny rp-temporary');
  },

  _addMenuItemTempDenyOriginToDest : function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return this._addMenuItemHelper(list, ruleData, 'denyOriginToDestinationTemporarily', [originHost, destHost], 'deny-temp', 'rp-start-rule rp-deny rp-temporary');
  },

  _addMenuItemHelper : function(list, ruleData, fmtStrName, fmtStrArgs, ruleAction, cssClass) {
    var label = this._strbundle.getFormattedString(fmtStrName, fmtStrArgs);
    var item = this._addListItem(list, 'rp-od-item', label);
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = ruleAction;
    //var statustext = ''; // TODO
    item.setAttribute('class', 'rp-od-item ' + cssClass);
    var canonicalRule = rp.mod.Ruleset.rawRuleToCanonicalString(ruleData);
    if (this._ruleChangeQueues[ruleAction]) {
      if (this._ruleChangeQueues[ruleAction][canonicalRule]) {
        item.setAttribute('selected-rule', 'true');
      }
    }
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

  _addMenuItemRemoveAllowRule : function(list, rawRule, subscriptionOverride) {
    var fmtVars = this._ruleDataToFormatVariables(rawRule);

    if (rawRule["o"] && rawRule["d"]) {
      return this._addMenuItemStopAllowingOriginToDest(list, rawRule, subscriptionOverride);
    } else if (rawRule["o"]) {
      return this._addMenuItemStopAllowingOrigin(list, rawRule, subscriptionOverride);
    } else if (rawRule["d"]) {
      return this._addMenuItemStopAllowingDest(list, rawRule, subscriptionOverride);
    } else {
      throw "Invalid rule data: no origin or destination parts.";
    }
  },

  _addMenuItemRemoveDenyRule : function(list, rawRule, subscriptionOverride) {
    var fmtVars = this._ruleDataToFormatVariables(rawRule);

    if (rawRule["o"] && rawRule["d"]) {
      return this._addMenuItemStopDenyingOriginToDest(list, rawRule, subscriptionOverride);
    } else if (rawRule["o"]) {
      return this._addMenuItemStopDenyingOrigin(list, rawRule, subscriptionOverride);
    } else if (rawRule["d"]) {
      return this._addMenuItemStopDenyingDest(list, rawRule, subscriptionOverride);
    } else {
      throw "Invalid rule data: no origin or destination parts.";
    }
  },

  _populateDetailsRemoveAllowRules : function(list) {
    // TODO: can we avoid calling getAllowedRequests here and reuse a result
    // from calling it earlier?

    var reqSet = rp.mod.RequestUtil.getAllowedRequests(
          this._currentlySelectedOrigin, this._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    //var rules = {};

    var userRules = {};
    var subscriptionRules = {};

    //reqSet.print('allowedRequests');

    // TODO: there is no dest if no dest is selected (origin only).
    //var destBase = rp.mod.DomainUtil.getDomain(
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
            rp.mod.Logger.dump("destinations[destUri] is null or undefined for destUri: " + destUri);
            continue;
          }


          var results = destinations[destUri][0]; // TODO: Do not look only
          // at the first RequestResult object, but at all. (there might be
          // several requests with identical origin and destination URI.)

          for (var i in results.matchedAllowRules) {

            var ruleset, match;
            [ruleset, match] = results.matchedAllowRules[i];
            var rawRule = rp.mod.Ruleset.matchToRawRule(match);

            if (!this._currentlySelectedDest) {
              if (rawRule['d'] && rawRule['d']['h']) {
                continue;
              }
            }

            var rawRuleStr = rp.mod.Ruleset.rawRuleToCanonicalString(rawRule);
            //rp.mod.Logger.info(rp.mod.Logger.TYPE_POLICY,
            //       "matched allow rule: " + rawRuleStr);
            // This is how we remove duplicates: if two rules have the same
            // canonical string, they'll have in the same key.
            if (ruleset.userRuleset) {
              userRules[rawRuleStr] = rawRule;
            } else {
              subscriptionRules[rawRuleStr] = rawRule;
            }
          }
        }
      }
    }

    for (var i in userRules) {
      this._addMenuItemRemoveAllowRule(list, userRules[i], false);
    }
    // TODO: for subscription rules, we need the effect of the menu item to be
    // adding a deny rule instead of removing an allow rule. However, the text
    // used for the item needs to be the same as removing an allow rule.
    for (var i in subscriptionRules) {
      this._addMenuItemRemoveAllowRule(list, subscriptionRules[i], true);
    }
  },

  _populateDetailsRemoveDenyRules : function(list) {
    // TODO: can we avoid calling getDeniedRequests here and reuse a result
    // from calling it earlier?

    var reqSet = rp.mod.RequestUtil.getDeniedRequests(
          this._currentlySelectedOrigin, this._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    //var rules = {};

    var userRules = {};
    var subscriptionRules = {};

    reqSet.print('deniedRequests');

    // TODO: there is no dest if no dest is selected (origin only).
    //var destBase = rp.mod.DomainUtil.getDomain(
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
            rp.mod.Logger.dump("destinations[destUri] is null or undefined for destUri: " + destUri);
            continue;
          }

          var results = destinations[destUri][0]; // TODO: Do not look only
          // at the first RequestResult object, but at all. (there may be
          // several requests with identical origin and destination URI.)

          for (var i in results.matchedDenyRules) {

            var ruleset, match;
            [ruleset, match] = results.matchedDenyRules[i];
            var rawRule = rp.mod.Ruleset.matchToRawRule(match);

            if (!this._currentlySelectedDest) {
              if (rawRule['d'] && rawRule['d']['h']) {
                continue;
              }
            }

            var rawRuleStr = rp.mod.Ruleset.rawRuleToCanonicalString(rawRule);
            //rp.mod.Logger.info(rp.mod.Logger.TYPE_POLICY,
            //       "matched allow rule: " + rawRuleStr);
            // This is how we remove duplicates: if two rules have the same
            // canonical string, they'll have in the same key.
            if (ruleset.userRuleset) {
              userRules[rawRuleStr] = rawRule;
            } else {
              subscriptionRules[rawRuleStr] = rawRule;
            }
          }
        }
      }
    }

    for (var i in userRules) {
      this._addMenuItemRemoveDenyRule(list, userRules[i], false);
    }
    // TODO: for subscription rules, we need the effect of the menu item to be
    // adding an allow rule instead of removing a deny rule. However, the text
    // used for the item needs to be the same as removing a deny rule.
    for (var i in subscriptionRules) {
      this._addMenuItemRemoveDenyRule(list, subscriptionRules[i], true);
    }
  },

  _populateDetailsAddSubdomainAllowRules : function(list) {
    var policyMgr = this._rpService._policyMgr;
    const RULE_ACTION_ALLOW = rp.mod.RULE_ACTION_ALLOW;
    const RULE_ACTION_DENY = rp.mod.RULE_ACTION_DENY;

    var origin = this._currentlySelectedOrigin;

    // TODO: can we avoid calling getDeniedRequests here and reuse a result
    // from calling it earlier?

    var reqSet = rp.mod.RequestUtil.getDeniedRequests(
          this._currentlySelectedOrigin, this._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    var destHosts = {};

    for (var destBase in requests) {
      if (this._currentlySelectedDest &&
          this._currentlySelectedDest != destBase) {
        continue;
      }
      for (var destIdent in requests[destBase]) {
        var destinations = requests[destBase][destIdent];
        for (var destUri in destinations) {
          destHosts[rp.mod.DomainUtil.getHost(destUri)] = null;
        }
      }
    }

    for (var destHost in destHosts) {
      var ruleData = {
        'o' : {
          'h' : this._addWildcard(origin)
        },
        'd' : {
          'h': destHost
        }
      };
      if (!policyMgr.ruleExists(RULE_ACTION_ALLOW, ruleData) &&
          !policyMgr.ruleExists(RULE_ACTION_DENY, ruleData)) {
        if (!this._privateBrowsingEnabled) {
          var item = this._addMenuItemAllowOriginToDest(list, ruleData);
        }
        var item = this._addMenuItemTempAllowOriginToDest(list, ruleData);
      }

      var destOnlyRuleData = {
        'd' : {
          'h': destHost
        }
      };
      if (!policyMgr.ruleExists(RULE_ACTION_ALLOW, destOnlyRuleData) &&
          !policyMgr.ruleExists(RULE_ACTION_DENY, destOnlyRuleData)) {
        if (!this._privateBrowsingEnabled) {
          var item = this._addMenuItemAllowDest(list, destOnlyRuleData);
        }
        var item = this._addMenuItemTempAllowDest(list, destOnlyRuleData);
      }
    }

  },

}
