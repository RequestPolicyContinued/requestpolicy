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


requestpolicy.menu = (function() {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;


  let {ScriptLoader} = (function() {
    let mod = {};
    Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm", mod);
    return mod;
  }());
  // iMod: Alias for ScriptLoader.importModule
  let iMod = ScriptLoader.importModule;
  let {Logger} = iMod("lib/logger");
  let {rpPrefBranch, Prefs} = iMod("lib/prefs");
  let {RequestProcessor} = iMod("lib/request-processor");
  let {PolicyManager} = iMod("lib/policy-manager");
  let {DomainUtil} = iMod("lib/utils/domains");
  let {Ruleset} = iMod("lib/ruleset");
  let {GUIOrigin, GUIDestination,
       GUILocation, GUILocationProperties} = iMod("lib/gui-location");
  let {StringUtils} = iMod("lib/utils/strings");
  let {DOMUtils} = iMod("lib/utils/dom");
  let {WindowUtils} = iMod("lib/utils/windows");
  let {C} = iMod("lib/utils/constants");

  let gBrowser = WindowUtils.getTabBrowser(window);


  let $id = document.getElementById.bind(document);


  let initialized = false;


  let self = {
    addedMenuItems : [],

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

    _ruleChangeQueues : {}
  };

  self.init = function() {
    if (initialized === false) {
      initialized = true;

      self._originItem = document.getElementById("rp-origin");
      self._originDomainnameItem = $id('rp-origin-domainname');
      self._originNumRequestsItem = $id('rp-origin-num-requests');

      self._otherOriginsList = $id("rp-other-origins-list");
      self._blockedDestinationsList = $id("rp-blocked-destinations-list");
      self._mixedDestinationsList = $id("rp-mixed-destinations-list");
      self._allowedDestinationsList = $id("rp-allowed-destinations-list");
      self._addRulesList = $id("rp-rules-add");
      self._removeRulesList = $id("rp-rules-remove");

      var conflictCount = RequestProcessor.getConflictingExtensions().length;
      var hideConflictInfo = (conflictCount == 0);
    }
  };


  self.prepareMenu = function() {
    try {
      var disabled = Prefs.isBlockingDisabled();
      $id('rp-link-enable-blocking').hidden = !disabled;
      $id('rp-link-disable-blocking').hidden = disabled;

      $id('rp-revoke-temporary-permissions').hidden =
          !PolicyManager.temporaryRulesExist();

      self._currentUri = requestpolicy.overlay.getTopLevelDocumentUri();

      try {
        self._currentBaseDomain = DomainUtil.getBaseDomain(self._currentUri);
        if (self._currentBaseDomain === null) {
          Logger.info(Logger.TYPE_INTERNAL, "Unable to prepare menu because " +
              "the current uri has no host: " + self._currentUri);
          self._populateMenuForUncontrollableOrigin();
          return;
        }
      } catch (e) {
        Logger.info(Logger.TYPE_INTERNAL, "Unable to prepare menu because " +
            "base domain can't be determined: " + self._currentUri);
        self._populateMenuForUncontrollableOrigin();
        return;
      }

      self._currentIdentifier = requestpolicy.overlay
          .getTopLevelDocumentUriIdentifier();

      //Logger.info(Logger.TYPE_POLICY,
      //                              "self._currentUri: " + self._currentUri);
      self._currentUriObj = DomainUtil.getUriObject(self._currentUri);

      self._isChromeUri = self._currentUriObj.scheme == "chrome";
      //self._currentUriIsHttps = self._currentUriObj.scheme == "https";

      Logger.info(Logger.TYPE_INTERNAL,
          "self._currentUri: " + self._currentUri);

      if (self._isChromeUri) {
        self._populateMenuForUncontrollableOrigin();
        return;
      }

      // The fact that getAllRequestsInBrowser uses currentURI.spec directly
      // from the browser is important because getTopLevelDocumentUri will
      // not return the real URI if there is an applicable
      // top-level document translation rule (these are used sometimes
      // for extension compatibility). For example, this is essential to the
      // menu showing relevant info when using the Update Scanner extension.
      self._allRequestsOnDocument = RequestProcessor
            .getAllRequestsInBrowser(gBrowser.selectedBrowser);
      self._allRequestsOnDocument.print("_allRequestsOnDocument");

      self._setPrivateBrowsingStyles();

  //      var hidePrefetchInfo = !Prefs.isPrefetchEnabled();
  //      self._itemPrefetchWarning.hidden = hidePrefetchInfo;
  //      self._itemPrefetchWarningSeparator.hidden = hidePrefetchInfo;
  //
  //      if (isChromeUri) {
  //        self._itemUnrestrictedOrigin.setAttribute("label",
  //            StringUtils.$str("unrestrictedOrigin", ["chrome://"]));
  //        self._itemUnrestrictedOrigin.hidden = false;
  //        return;
  //      }

      self._populateOrigin();
      self._populateOtherOrigins();
      self._activateOriginItem($id("rp-origin"));

    } catch (e) {
      Logger.severe(Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      Logger.severe(Logger.TYPE_ERROR, "Unable to prepare menu due to error.");
      throw e;
    }
  };

  self._populateMenuForUncontrollableOrigin = function() {
    self._originDomainnameItem.setAttribute('value',
        StringUtils.$str('noOrigin'));
    self._originNumRequestsItem.setAttribute('value', '');
    self._originItem.removeAttribute("default-policy");
    self._originItem.removeAttribute("requests-blocked");

    DOMUtils.removeChildren([
        self._otherOriginsList,
        self._blockedDestinationsList,
        self._mixedDestinationsList,
        self._allowedDestinationsList,
        self._removeRulesList,
        self._addRulesList]);
    $id('rp-other-origins').hidden = true;
    $id('rp-blocked-destinations').hidden = true;
    $id('rp-mixed-destinations').hidden = true;
    $id('rp-allowed-destinations').hidden = true;
    // TODO: show some message about why the menu is empty.
  };

  self._populateList = function(list, values) {
    DOMUtils.removeChildren(list);

    // check whether there are objects of GUILocation or just strings
    var guiLocations = values[0] && (values[0] instanceof GUILocation);

    if (true === guiLocations) {
      // get prefs
      var sorting = rpPrefBranch.getCharPref('menu.sorting');
      var showNumRequests = rpPrefBranch.getBoolPref('menu.info.showNumRequests');

      if (sorting == "numRequests") {
        values.sort(GUILocation.sortByNumRequestsCompareFunction);
      } else if (sorting == "destName") {
        values.sort(GUILocation.compareFunction);
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
        var newitem = self._addListItem(list, 'rp-od-item', guiLocation, num);

        newitem.setAttribute("default-policy",
            (props.numDefaultPolicyRequests > 0 ? "true" : "false"));
        newitem.setAttribute("requests-blocked",
            (props.numBlockedRequests > 0 ? "true" : "false"));
      }
    } else {
      values.sort();
      for (var i in values) {
        self._addListItem(list, 'rp-od-item', values[i]);
      }
    }
  };

  self._populateOrigin = function() {
    self._originDomainnameItem.setAttribute("value", self._currentBaseDomain);

    var showNumRequests = rpPrefBranch
        .getBoolPref('menu.info.showNumRequests');

    var props = self._getOriginGUILocationProperties();

    var numRequests = '';
    if (true === showNumRequests) {
      if (props.numAllowedRequests > 0 && props.numBlockedRequests > 0) {
        numRequests = props.numRequests + " (" +
            props.numBlockedRequests + "+" + props.numAllowedRequests + ")";
      } else {
        numRequests = props.numRequests;
      }
    }
    self._originNumRequestsItem.setAttribute("value", numRequests);

    self._originItem.setAttribute("default-policy",
        (props.numDefaultPolicyRequests > 0 ? "true" : "false"));
    self._originItem.setAttribute("requests-blocked",
        (props.numBlockedRequests > 0 ? "true" : "false"));
  };

  self._populateOtherOrigins = function() {
    var guiOrigins = self._getOtherOriginsAsGUILocations();
    self._populateList(self._otherOriginsList, guiOrigins);
    $id('rp-other-origins').hidden = guiOrigins.length == 0;
  };

  self._populateDestinations = function(originIdentifier) {
    var destsWithBlockedRequests = self._getBlockedDestinationsAsGUILocations();
    var destsWithAllowedRequests = self._getAllowedDestinationsAsGUILocations();

    var destsWithSolelyBlockedRequests = [];
    var destsMixed = [];
    var destsWithSolelyAllowedRequests = [];

    // Set operations would be nice. These are small arrays, so keep it simple.
    for (var i = 0; i < destsWithBlockedRequests.length; i++) {
      let blockedGUIDest = destsWithBlockedRequests[i];

      if (false === GUILocation.existsInArray(blockedGUIDest,
          destsWithAllowedRequests)) {
        destsWithSolelyBlockedRequests.push(blockedGUIDest);
      } else {
        destsMixed.push(blockedGUIDest);
      }
    }
    for (var i = 0; i < destsWithAllowedRequests.length; i++) {
      let allowedGUIDest = destsWithAllowedRequests[i];

      var indexRawBlocked = GUIDestination.
          indexOfDestInArray(allowedGUIDest, destsWithBlockedRequests);
      var destsMixedIndex = GUIDestination.
          indexOfDestInArray(allowedGUIDest, destsMixed);

      if (indexRawBlocked == -1) {
        destsWithSolelyAllowedRequests.push(allowedGUIDest);
      } else {
        if (destsMixedIndex != -1) {
          Logger.info(Logger.TYPE_INTERNAL,
              "Merging dest: <" + allowedGUIDest + ">");
          destsMixed[destsMixedIndex] = GUIDestination.merge(
              allowedGUIDest, destsMixed[destsMixedIndex]);
        } else {
          // If the allowedGUIDest is in destsWithBlockedRequests and
          // destsWithAllowedRequests, but not in destsMixed.
          // This should never happen, the destsMixed destination should have
          // been added in the destsWithBlockedRequests-loop.
          Logger.warning(Logger.TYPE_INTERNAL, "mixed dest was" +
              " not added to `destsMixed` list: <" + dest.dest + ">");
          destsMixed.push(allowedGUIDest);
        }
      }
    }

    self._populateList(self._blockedDestinationsList,
        destsWithSolelyBlockedRequests);
    $id('rp-blocked-destinations').hidden =
        destsWithSolelyBlockedRequests.length == 0;

    self._populateList(self._mixedDestinationsList, destsMixed);
    $id('rp-mixed-destinations').hidden = destsMixed.length == 0;

    self._populateList(self._allowedDestinationsList,
        destsWithSolelyAllowedRequests);
    $id('rp-allowed-destinations').hidden =
        destsWithSolelyAllowedRequests.length == 0;
  };

  self._populateDetails = function() {
    var origin = self._currentlySelectedOrigin;
    var dest = self._currentlySelectedDest;
    DOMUtils.removeChildren([self._removeRulesList, self._addRulesList]);

    var ruleData = {
      'o' : {
        'h' : self._addWildcard(origin)
      }
    };

    let mayPermRulesBeAdded = WindowUtils.mayPermanentRulesBeAdded(window);

    // Note: in PBR we'll need to still use the old string for the temporary
    // rule. We won't be able to use just "allow temporarily".

    if (!self._currentlySelectedDest) {
      if (Prefs.isDefaultAllow()) {
        // It seems pretty rare that someone will want to add a rule to block all
        // requests from a given origin.
        //if (mayPermRulesBeAdded === true) {
        //  var item = self._addMenuItemDenyOrigin(
        //    self._addRulesList, ruleData);
        //}
        //var item = self._addMenuItemTempDenyOrigin(self._addRulesList, ruleData);
      } else {
        if (mayPermRulesBeAdded === true) {
          var item = self._addMenuItemAllowOrigin(self._addRulesList, ruleData);
        }
        var item = self._addMenuItemTempAllowOrigin(self._addRulesList, ruleData);
      }
    }

    if (dest) {
      ruleData['d'] = {
        'h' : self._addWildcard(dest)
      };
      var destOnlyRuleData = {
        'd' : {
          'h' : self._addWildcard(dest)
        }
      };
      //if (Prefs.isDefaultAllow()) {
      if (self._isCurrentlySelectedDestAllowed ||
           (!PolicyManager.ruleExists(C.RULE_ACTION_DENY, ruleData) &&
            !PolicyManager.ruleExists(C.RULE_ACTION_DENY, destOnlyRuleData))) {
        // show "Block requests" if the destination was allowed
        // OR if there's no blocking rule (i.e. the request was blocked "by default")
        //  -- this enables support for blacklisting.
        if (!PolicyManager.ruleExists(C.RULE_ACTION_ALLOW, ruleData) &&
            !PolicyManager.ruleExists(C.RULE_ACTION_DENY, ruleData)) {
          if (mayPermRulesBeAdded === true) {
              var item = self._addMenuItemDenyOriginToDest(
                  self._addRulesList, ruleData);
          }
          var item = self._addMenuItemTempDenyOriginToDest(
            self._addRulesList, ruleData);
        }

        if (!PolicyManager.ruleExists(C.RULE_ACTION_ALLOW, destOnlyRuleData) &&
            !PolicyManager.ruleExists(C.RULE_ACTION_DENY, destOnlyRuleData)) {
          if (mayPermRulesBeAdded === true) {
            var item = self._addMenuItemDenyDest(
                self._addRulesList, destOnlyRuleData);
          }
          var item = self._addMenuItemTempDenyDest(
              self._addRulesList, destOnlyRuleData);
        }
      }
      if (self._isCurrentlySelectedDestBlocked ||
           (!PolicyManager.ruleExists(C.RULE_ACTION_ALLOW, ruleData) &&
            !PolicyManager.ruleExists(C.RULE_ACTION_ALLOW, destOnlyRuleData))) {
        // show "Allow requests" if the destination was blocked
        // OR if there's no allow-rule (i.e. the request was allowed "by default")
        //  -- this enables support for whitelisting.
        if (!PolicyManager.ruleExists(C.RULE_ACTION_ALLOW, ruleData) &&
            !PolicyManager.ruleExists(C.RULE_ACTION_DENY, ruleData)) {
          if (mayPermRulesBeAdded === true) {
            var item = self._addMenuItemAllowOriginToDest(
                self._addRulesList, ruleData);
          }
          var item = self._addMenuItemTempAllowOriginToDest(
              self._addRulesList, ruleData);
        }

        if (!PolicyManager.ruleExists(C.RULE_ACTION_ALLOW, destOnlyRuleData) &&
            !PolicyManager.ruleExists(C.RULE_ACTION_DENY, destOnlyRuleData)) {
          if (mayPermRulesBeAdded === true) {
            var item = self._addMenuItemAllowDest(
                self._addRulesList, destOnlyRuleData);
          }
          var item = self._addMenuItemTempAllowDest(
              self._addRulesList, destOnlyRuleData);
        }
      }
    }

    if (self._currentlySelectedDest) {
      if (!Prefs.isDefaultAllow() &&
          !Prefs.isDefaultAllowSameDomain()) {
        self._populateDetailsAddSubdomainAllowRules(self._addRulesList);
      }
    }

    self._populateDetailsRemoveAllowRules(self._removeRulesList);
    self._populateDetailsRemoveDenyRules(self._removeRulesList);
  };

  self._addListItem = function(list, cssClass, value, numRequests) {
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
  };

  self._disableIfNoChildren = function(el) {
    // TODO: this isn't working.
    el.hidden = el.firstChild ? false : true;
  };

  self._setPrivateBrowsingStyles = function() {
    let mayPermRulesBeAdded = WindowUtils.mayPermanentRulesBeAdded(window);
    let val = mayPermRulesBeAdded === true ? '' : 'privatebrowsing';
    $id('rp-details').setAttribute('class', val);
  };

  self._resetSelectedOrigin = function() {
    self._originItem.setAttribute('selected-origin', 'false');
    for (var i = 0; i < self._otherOriginsList.childNodes.length; i++) {
      var child = self._otherOriginsList.childNodes[i];
      child.setAttribute('selected-origin', 'false');
    }
  };

  self._resetSelectedDest = function() {
    for (var i = 0; i < self._blockedDestinationsList.childNodes.length; i++) {
      var child = self._blockedDestinationsList.childNodes[i];
      child.setAttribute('selected-dest', 'false');
    }
    for (var i = 0; i < self._mixedDestinationsList.childNodes.length; i++) {
      var child = self._mixedDestinationsList.childNodes[i];
      child.setAttribute('selected-dest', 'false');
    }
    for (var i = 0; i < self._allowedDestinationsList.childNodes.length; i++) {
      var child = self._allowedDestinationsList.childNodes[i];
      child.setAttribute('selected-dest', 'false');
    }
  };

  self._activateOriginItem = function(item) {
    if (item.id == 'rp-origin') {
      // it's _the_ origin
      self._currentlySelectedOrigin = self._originDomainnameItem.value;
    } else if (item.parentNode.id == 'rp-other-origins-list') {
      // it's an otherOrigin
      self._currentlySelectedOrigin = item.getElementsByClassName("domainname")[0].value;
    }
    self._currentlySelectedDest = null;
    // TODO: if the document's origin (rather than an other origin) is being
    // activated, then regenerate the other origins list, as well.
    self._resetSelectedOrigin();
    item.setAttribute('selected-origin', 'true');
    self._populateDestinations();
    self._resetSelectedDest();
    self._populateDetails();
  };

  self._activateDestinationItem = function(item) {
    self._currentlySelectedDest = item.getElementsByClassName("domainname")[0].value;

    if (item.parentNode.id == 'rp-blocked-destinations-list') {
      self._isCurrentlySelectedDestBlocked = true;
      self._isCurrentlySelectedDestAllowed = false;
    } else if (item.parentNode.id == 'rp-allowed-destinations-list') {
      self._isCurrentlySelectedDestBlocked = false;
      self._isCurrentlySelectedDestAllowed = true;
    } else {
      self._isCurrentlySelectedDestBlocked = true;
      self._isCurrentlySelectedDestAllowed = true;
    }

    self._resetSelectedDest();
    item.setAttribute('selected-dest', 'true');
    self._populateDetails();
  };


  self.itemSelected = function(event) {
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
      self._activateOriginItem(item);
    } else if (item.parentNode.id == 'rp-blocked-destinations-list' ||
               item.parentNode.id == 'rp-mixed-destinations-list' ||
               item.parentNode.id == 'rp-allowed-destinations-list') {
      self._activateDestinationItem(item);
    } else if (item.parentNode.id == 'rp-rule-options' ||
               item.parentNode.id == 'rp-rules-remove' ||
               item.parentNode.id == 'rp-rules-add') {
      self._processRuleSelection(item);
    } else {
      Logger.severe(Logger.TYPE_ERROR,
          'Unable to figure out which item type was selected.');
    }
  };

  self._processRuleSelection = function(item) {
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
      Logger.severe(Logger.TYPE_ERROR,
          'ruleData is empty in menu._processRuleSelection()');
      return;
    }
    if (!ruleAction) {
      Logger.severe(Logger.TYPE_ERROR,
          'ruleAction is empty in menu._processRuleSelection()');
      return;
    }

    var canonicalRule = Ruleset.rawRuleToCanonicalString(ruleData);
    Logger.dump("ruleData: " + canonicalRule);
    Logger.dump("ruleAction: " + ruleAction);
    Logger.dump("undo: " + undo);

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

    if (!self._ruleChangeQueues[ruleAction]) {
      self._ruleChangeQueues[ruleAction] = {};
    }

    if (undo) {
      delete self._ruleChangeQueues[ruleAction][canonicalRule];
    } else {
      self._ruleChangeQueues[ruleAction][canonicalRule] = ruleData;
    }
  };

  self.processQueuedRuleChanges = function() {
    var rulesChanged = false;
    for (var ruleAction in self._ruleChangeQueues) {
      for (var canonicalRule in self._ruleChangeQueues[ruleAction]) {
        var ruleData = self._ruleChangeQueues[ruleAction][canonicalRule];
        self._processRuleChange(ruleAction, ruleData);
        var rulesChanged = true;
      }
    }

    self._ruleChangeQueues = {};
    return rulesChanged;
  };

  self._processRuleChange = function(ruleAction, ruleData) {

    switch (ruleAction) {
      case 'allow':
        PolicyManager.addAllowRule(ruleData);
        break;
      case 'allow-temp':
        PolicyManager.addTemporaryAllowRule(ruleData);
        break;
      case 'stop-allow':
        PolicyManager.removeAllowRule(ruleData);
        break;
      case 'deny':
        PolicyManager.addDenyRule(ruleData);
        break;
      case 'deny-temp':
        PolicyManager.addTemporaryDenyRule(ruleData);
        break;
      case 'stop-deny':
        PolicyManager.removeDenyRule(ruleData);
        break;
      default:
        throw 'action not implemented: ' + ruleAction;
        break;
    }
  };


  // Note by @jsamuel:
  // „It's been too long since I looked at some of the new code.
  //  I think I may have assumed that I'd get rid of the different strictness
  //  levels and just use what is currently called LEVEL_SOP. If using anything
  //  else there will be errors from within getDeniedRequests().“


  self._getBlockedDestinationsAsGUILocations = function() {
    var reqSet = RequestProcessor.getDeniedRequests(
        self._currentlySelectedOrigin, self._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    var result = [];
    for (var destBase in requests) {
      var properties = new GUILocationProperties();
      properties.accumulate(requests[destBase], C.RULE_ACTION_DENY);
      result.push(new GUIDestination(destBase, properties));
    }
    return result;
  };

  self._getAllowedDestinationsAsGUILocations = function() {
    var reqSet = RequestProcessor.getAllowedRequests(
        self._currentlySelectedOrigin, self._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    var result = [];
    for (var destBase in requests) {
      // For everybody except users with default deny who are not allowing all
      // requests to the same domain:
      // Ignore the selected origin's domain when listing destinations.
      if (Prefs.isDefaultAllow() || Prefs.isDefaultAllowSameDomain()) {
        if (destBase == self._currentlySelectedOrigin) {
          continue;
        }
      }

      var properties = new GUILocationProperties();
      properties.accumulate(requests[destBase], C.RULE_ACTION_ALLOW);
      result.push(new GUIDestination(destBase, properties));
    }
    return result;
  };

  /**
   * TODO: optimize this for performance (_getOriginGUILocationProperties and
   * _getOtherOriginsAsGUILocations could be merged.)
   *
   * @return {GUILocationProperties}
   *         the properties of the "main" origin (the one in the location bar).
   */
  self._getOriginGUILocationProperties = function() {
    var allRequests = self._allRequestsOnDocument.getAll();

    var allowSameDomain = Prefs.isDefaultAllow() ||
        Prefs.isDefaultAllowSameDomain();

    var properties = new GUILocationProperties();

    for (var originUri in allRequests) {
      var originBase = DomainUtil.getBaseDomain(originUri);
      if (originBase !== self._currentBaseDomain) {
        continue;
      }

      for (var destBase in allRequests[originUri]) {
        properties.accumulate(allRequests[originUri][destBase]);
      }
    }
    return properties;
  };

  self._getOtherOriginsAsGUILocations = function() {
    var allRequests = self._allRequestsOnDocument.getAll();

    var allowSameDomain = Prefs.isDefaultAllow() ||
        Prefs.isDefaultAllowSameDomain();

    var guiOrigins = [];
    for (var originUri in allRequests) {
      var originBase = DomainUtil.getBaseDomain(originUri);
      if (originBase === self._currentBaseDomain) {
        continue;
      }

      // TODO: we should prevent chrome://browser/ URLs from getting anywhere
      // near here in the first place.
      // Is this an issue anymore? This may have been slipping through due to
      // a bug that has since been fixed. Disabling for now.
      //if (originBase == 'browser') {
      //  continue;
      //}

      var guiOriginsIndex = GUIOrigin.indexOfOriginInArray(originBase,
          guiOrigins);
      var properties;
      if (guiOriginsIndex == -1) {
        properties = new GUILocationProperties();
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
        guiOrigins.push(new GUIOrigin(originBase, properties));
      }
    }
    return guiOrigins;
  };

  self._sanitizeJsFunctionArg = function(str) {
    // strip single quotes and backslashes
    return str.replace(/['\\]/g, "");
  };

  self._isIPAddressOrSingleName = function(hostname) {
    return DomainUtil.isIPAddress(hostname) ||
        hostname.indexOf(".") == -1;
  };

  self._addWildcard = function(hostname) {
    if (self._isIPAddressOrSingleName(hostname)) {
      return hostname;
    } else {
      return "*." + hostname;
    }
  };

  // TODO: the 12 _addMenuItem* functions below hopefully can be refactored.

  // Stop allowing

  self._addMenuItemStopAllowingOrigin = function(list, ruleData, subscriptionOverride) {
    var originHost = ruleData["o"]["h"];
    var ruleAction = subscriptionOverride ? 'deny' : 'stop-allow';
    return self._addMenuItemHelper(list, ruleData, 'stopAllowingOrigin', [originHost], ruleAction, 'rp-stop-rule rp-stop-allow');
  };

  self._addMenuItemStopAllowingDest = function(list, ruleData, subscriptionOverride) {
    var destHost = ruleData["d"]["h"];
    var ruleAction = subscriptionOverride ? 'deny' : 'stop-allow';
    return self._addMenuItemHelper(list, ruleData, 'stopAllowingDestination', [destHost], ruleAction, 'rp-stop-rule rp-stop-allow');
  };

  self._addMenuItemStopAllowingOriginToDest = function(list, ruleData, subscriptionOverride) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    var ruleAction = subscriptionOverride ? 'deny' : 'stop-allow';
    return self._addMenuItemHelper(list, ruleData, 'stopAllowingOriginToDestination', [originHost, destHost], ruleAction, 'rp-stop-rule rp-stop-allow');
  };

  // Allow

  self._addMenuItemAllowOrigin = function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'allowOrigin', [originHost], 'allow', 'rp-start-rule rp-allow');
  };

  self._addMenuItemAllowDest = function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'allowDestination', [destHost], 'allow', 'rp-start-rule rp-allow');
  };

  self._addMenuItemAllowOriginToDest = function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'allowOriginToDestination', [originHost, destHost], 'allow', 'rp-start-rule rp-allow');
  };

  // Allow temp

  self._addMenuItemTempAllowOrigin = function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'allowOriginTemporarily', [originHost], 'allow-temp', 'rp-start-rule rp-allow rp-temporary');
  };

  self._addMenuItemTempAllowDest = function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'allowDestinationTemporarily', [destHost], 'allow-temp', 'rp-start-rule rp-allow rp-temporary');
  };

  self._addMenuItemTempAllowOriginToDest = function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'allowOriginToDestinationTemporarily', [originHost, destHost], 'allow-temp', 'rp-start-rule rp-allow rp-temporary');
  };

  // Stop denying

  self._addMenuItemStopDenyingOrigin = function(list, ruleData, subscriptionOverride) {
    var originHost = ruleData["o"]["h"];
    var ruleAction = subscriptionOverride ? 'allow' : 'stop-deny';
    return self._addMenuItemHelper(list, ruleData, 'stopDenyingOrigin', [originHost], ruleAction, 'rp-stop-rule rp-stop-deny');
  };

  self._addMenuItemStopDenyingDest = function(list, ruleData, subscriptionOverride) {
    var destHost = ruleData["d"]["h"];
    var ruleAction = subscriptionOverride ? 'allow' : 'stop-deny';
    return self._addMenuItemHelper(list, ruleData, 'stopDenyingDestination', [destHost], ruleAction, 'rp-stop-rule rp-stop-deny');
  };

  self._addMenuItemStopDenyingOriginToDest = function(list, ruleData, subscriptionOverride) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    var ruleAction = subscriptionOverride ? 'allow' : 'stop-deny';
    return self._addMenuItemHelper(list, ruleData, 'stopDenyingOriginToDestination', [originHost, destHost], ruleAction, 'rp-stop-rule rp-stop-deny');
  };

  // Deny

  self._addMenuItemDenyOrigin = function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'denyOrigin', [originHost], 'deny', 'rp-start-rule rp-deny');
  };

  self._addMenuItemDenyDest = function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'denyDestination', [destHost], 'deny', 'rp-start-rule rp-deny');
  };

  self._addMenuItemDenyOriginToDest = function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'denyOriginToDestination', [originHost, destHost], 'deny', 'rp-start-rule rp-deny');
  };

  // Deny temp

  self._addMenuItemTempDenyOrigin = function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'denyOriginTemporarily', [originHost], 'deny-temp', 'rp-start-rule rp-deny rp-temporary');
  };

  self._addMenuItemTempDenyDest = function(list, ruleData) {
    var destHost = ruleData["d"]["h"];
    return self._addMenuItemHelper(list, ruleData, 'denyDestinationTemporarily', [destHost], 'deny-temp', 'rp-start-rule rp-deny rp-temporary');
  };

  self._addMenuItemTempDenyOriginToDest = function(list, ruleData) {
    var originHost = ruleData["o"]["h"];
    var destHost = ruleData["d"]["h"];
    return self._addMenuItemHelper(list, ruleData,
        'denyOriginToDestinationTemporarily', [originHost, destHost],
        'deny-temp', 'rp-start-rule rp-deny rp-temporary');
  };

  self._addMenuItemHelper = function(list, ruleData, fmtStrName, fmtStrArgs,
      ruleAction, cssClass) {
    var label = StringUtils.$str(fmtStrName, fmtStrArgs);
    var item = self._addListItem(list, 'rp-od-item', label);
    item.requestpolicyRuleData = ruleData;
    item.requestpolicyRuleAction = ruleAction;
    //var statustext = ''; // TODO
    item.setAttribute('class', 'rp-od-item ' + cssClass);
    var canonicalRule = Ruleset.rawRuleToCanonicalString(ruleData);
    if (self._ruleChangeQueues[ruleAction]) {
      if (self._ruleChangeQueues[ruleAction][canonicalRule]) {
        item.setAttribute('selected-rule', 'true');
      }
    }
    return item;
  };

  self._ruleDataPartToDisplayString = function(ruleDataPart) {
    var str = "";
    if (ruleDataPart["s"]) {
      str += ruleDataPart["s"] + "://";
    }
    str += ruleDataPart["h"] || "*";
    if (ruleDataPart["port"]) {
      str += ":" + ruleDataPart["port"];
    }
    // TODO: path
    return str;
  };

  self._ruleDataToFormatVariables = function(rawRule) {
    var fmtVars = [];
    if (rawRule["o"]) {
      fmtVars.push(self._ruleDataPartToDisplayString(rawRule["o"]));
    }
    if (rawRule["d"]) {
      fmtVars.push(self._ruleDataPartToDisplayString(rawRule["d"]));
    }
    return fmtVars;
  };

  self._addMenuItemRemoveAllowRule = function(list, rawRule, subscriptionOverride) {
    var fmtVars = self._ruleDataToFormatVariables(rawRule);

    if (rawRule["o"] && rawRule["d"]) {
      return self._addMenuItemStopAllowingOriginToDest(list, rawRule, subscriptionOverride);
    } else if (rawRule["o"]) {
      return self._addMenuItemStopAllowingOrigin(list, rawRule, subscriptionOverride);
    } else if (rawRule["d"]) {
      return self._addMenuItemStopAllowingDest(list, rawRule, subscriptionOverride);
    } else {
      throw "Invalid rule data: no origin or destination parts.";
    }
  };

  self._addMenuItemRemoveDenyRule = function(list, rawRule, subscriptionOverride) {
    var fmtVars = self._ruleDataToFormatVariables(rawRule);

    if (rawRule["o"] && rawRule["d"]) {
      return self._addMenuItemStopDenyingOriginToDest(list, rawRule, subscriptionOverride);
    } else if (rawRule["o"]) {
      return self._addMenuItemStopDenyingOrigin(list, rawRule, subscriptionOverride);
    } else if (rawRule["d"]) {
      return self._addMenuItemStopDenyingDest(list, rawRule, subscriptionOverride);
    } else {
      throw "Invalid rule data: no origin or destination parts.";
    }
  };

  self._populateDetailsRemoveAllowRules = function(list) {
    // TODO: can we avoid calling getAllowedRequests here and reuse a result
    // from calling it earlier?

    var reqSet = RequestProcessor.getAllowedRequests(
        self._currentlySelectedOrigin, self._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    //var rules = {};

    var userRules = {};
    var subscriptionRules = {};

    //reqSet.print('allowedRequests');

    // TODO: there is no dest if no dest is selected (origin only).
    //var destBase = DomainUtil.getBaseDomain(
    //      self._currentlySelectedDest);

    for (var destBase in requests) {

      if (self._currentlySelectedDest &&
          self._currentlySelectedDest != destBase) {
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
            Logger.dump("destinations[destUri] is null or undefined for " +
                "destUri: " + destUri);
            continue;
          }


          var results = destinations[destUri][0]; // TODO: Do not look only
          // at the first RequestResult object, but at all. (there might be
          // several requests with identical origin and destination URI.)

          for (var i in results.matchedAllowRules) {

            var ruleset, match;
            [ruleset, match] = results.matchedAllowRules[i];
            var rawRule = Ruleset.matchToRawRule(match);

            if (!self._currentlySelectedDest) {
              if (rawRule['d'] && rawRule['d']['h']) {
                continue;
              }
            }

            var rawRuleStr = Ruleset.rawRuleToCanonicalString(rawRule);
            //Logger.info(Logger.TYPE_POLICY,
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
      self._addMenuItemRemoveAllowRule(list, userRules[i], false);
    }
    // TODO: for subscription rules, we need the effect of the menu item to be
    // adding a deny rule instead of removing an allow rule. However, the text
    // used for the item needs to be the same as removing an allow rule.
    for (var i in subscriptionRules) {
      self._addMenuItemRemoveAllowRule(list, subscriptionRules[i], true);
    }
  };

  self._populateDetailsRemoveDenyRules = function(list) {
    // TODO: can we avoid calling getDeniedRequests here and reuse a result
    // from calling it earlier?

    var reqSet = RequestProcessor.getDeniedRequests(
        self._currentlySelectedOrigin, self._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    //var rules = {};

    var userRules = {};
    var subscriptionRules = {};

    reqSet.print('deniedRequests');

    // TODO: there is no dest if no dest is selected (origin only).
    //var destBase = DomainUtil.getBaseDomain(
    //      self._currentlySelectedDest);

    for (var destBase in requests) {

      if (self._currentlySelectedDest &&
        self._currentlySelectedDest != destBase) {
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
            Logger.dump("destinations[destUri] is null or undefined for destUri: " + destUri);
            continue;
          }

          var results = destinations[destUri][0]; // TODO: Do not look only
          // at the first RequestResult object, but at all. (there may be
          // several requests with identical origin and destination URI.)

          for (var i in results.matchedDenyRules) {

            var ruleset, match;
            [ruleset, match] = results.matchedDenyRules[i];
            var rawRule = Ruleset.matchToRawRule(match);

            if (!self._currentlySelectedDest) {
              if (rawRule['d'] && rawRule['d']['h']) {
                continue;
              }
            }

            var rawRuleStr = Ruleset.rawRuleToCanonicalString(rawRule);
            //Logger.info(Logger.TYPE_POLICY,
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
      self._addMenuItemRemoveDenyRule(list, userRules[i], false);
    }
    // TODO: for subscription rules, we need the effect of the menu item to be
    // adding an allow rule instead of removing a deny rule. However, the text
    // used for the item needs to be the same as removing a deny rule.
    for (var i in subscriptionRules) {
      self._addMenuItemRemoveDenyRule(list, subscriptionRules[i], true);
    }
  };

  self._populateDetailsAddSubdomainAllowRules = function(list) {
    var origin = self._currentlySelectedOrigin;

    // TODO: can we avoid calling getDeniedRequests here and reuse a result
    // from calling it earlier?

    var reqSet = RequestProcessor.getDeniedRequests(
        self._currentlySelectedOrigin, self._allRequestsOnDocument);
    var requests = reqSet.getAllMergedOrigins();

    var destHosts = {};

    for (var destBase in requests) {
      if (self._currentlySelectedDest &&
          self._currentlySelectedDest != destBase) {
        continue;
      }
      for (var destIdent in requests[destBase]) {
        var destinations = requests[destBase][destIdent];
        for (var destUri in destinations) {
          destHosts[DomainUtil.getHost(destUri)] = null;
        }
      }
    }

    let mayPermRulesBeAdded = WindowUtils.mayPermanentRulesBeAdded(window);

    for (var destHost in destHosts) {
      var ruleData = {
        'o' : {
          'h' : self._addWildcard(origin)
        },
        'd' : {
          'h': destHost
        }
      };
      if (!PolicyManager.ruleExists(C.RULE_ACTION_ALLOW, ruleData) &&
          !PolicyManager.ruleExists(C.RULE_ACTION_DENY, ruleData)) {
        if (mayPermRulesBeAdded === true) {
          var item = self._addMenuItemAllowOriginToDest(list, ruleData);
        }
        var item = self._addMenuItemTempAllowOriginToDest(list, ruleData);
      }

      var destOnlyRuleData = {
        'd' : {
          'h': destHost
        }
      };
      if (!PolicyManager.ruleExists(C.RULE_ACTION_ALLOW, destOnlyRuleData) &&
          !PolicyManager.ruleExists(C.RULE_ACTION_DENY, destOnlyRuleData)) {
        if (mayPermRulesBeAdded === true) {
          var item = self._addMenuItemAllowDest(list, destOnlyRuleData);
        }
        var item = self._addMenuItemTempAllowDest(list, destOnlyRuleData);
      }
    }
  };

  return self;
}());
