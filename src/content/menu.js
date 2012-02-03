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
      this._populateDetails();

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
    this._originItem.setAttribute('value', 'foo.com');
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
    var list = document.getElementById('rp-rule-options');
    this._removeChildren(list);
    var item = this._addListItem(list, 'rp-details-item', 'blah');
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
  },

  _activateDestinationItem : function(item) {
    this._currentlySelectedDest = item.value;
    this._resetSelectedDest();
    item.setAttribute('selected-dest', 'true');
    this._populateDetails();
  },


  itemSelected : function(event) {
    var item = event.target;
    if (item.id == 'rp-origin' || item.parentNode.id == 'rp-other-origins-list') {
      this._activateOriginItem(item);
    } else {
      this._activateDestinationItem(item);
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


//  _addRejectedRequests : function(menu, currentUri, currentUriObj, currentIdentifier,
//                                  otherOrigins, privateBrowsingEnabled, currentBaseDomain) {
//
//    var currentUri = this._currentUri;
//    var currentUriObj = this._currentUriObj;
//    var currentIdentifier = this._currentIdentifier;
//    var privateBrowsingEnabled = false;
//    var currentBaseDomain = this._currentBaseDomain;
//    var otherOrigins = {};
//
//    // Get the requests rejected by the current uri.
//    var rejectedReqSet = requestpolicy.mod.RequestUtil.getRejectedRequests(
//      currentUri, currentIdentifier, otherOrigins);
//    var rejectedRequests = rejectedReqSet.getAllMergedOrigins();
//    rejectedReqSet.print("rejectedReqSet");
//    //requestpolicy.mod.RequestUtil.dumpRequestSet(rejectedRequests,
//    //    "All rejected requests (including from other origins)");
//    // TODO: destIdentifier is now supposed to be the base domain, so this
//    // should be renamed to baseDomain. Right now these are equivalent while
//    // in base domain strictness mode.
//    for (var destBase in rejectedRequests) {
//      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY,
//                                    "destBase in rejectedRequests: " + destBase);
//
//      // TODO: continue if destIdentifier is an address rather than a domain name.
//
//      var ruleData = {"d" : {"h" : this._addWildcard(destBase)} };
//
//      if (!requestpolicy.mod.DomainUtil.hasStandardPort(currentUriObj)) {
//        if (!ruleData["o"]) {
//          ruleData["o"] = {};
//        }
//        ruleData["o"]["port"] = currentUriObj.port;
//      }
//
//      var submenu = this.addBlockedDestination(menu,
//                                               this._blockedDestinationsBeforeReferenceItem, destBase,
//                                               true);
//    }
//  },

}
