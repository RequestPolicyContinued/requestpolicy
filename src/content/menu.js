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
      this._currentIdentifier = requestpolicy.overlay
        .getTopLevelDocumentUriIdentifier();
      this._currentUriObj = requestpolicy.mod.DomainUtil.getUriObject(
        requestpolicy.overlay.getTopLevelDocumentUri());
      this._currentUri = requestpolicy.overlay.getTopLevelDocumentUri();
      this._isChromeUri = this._currentUriObj.scheme == "chrome";

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
  },

  _getBlockedDestinations : function() {
    return ['foo.com', 'bar.com', Math.random()];
  },

  _getAllowedDestinations : function() {
    return ['yaz.com', 'example.com', Math.random()];
  },

  _getOtherOrigins : function() {
    return ['otherorigin.com', Math.random()];
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
    var value = item.value;
    this._resetSelectedOrigin();
    item.setAttribute('selected-origin', 'true');
    this._populateDestinations();
    this._resetSelectedDest();
  },

  _activateDestinationItem : function(item) {
    var value = item.value;
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

}
