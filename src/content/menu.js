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
//      this._menu = document.getElementById("requestpolicyStatusbarPopup");

      this._otherOriginsList = document.getElementById("rp-other-origins-list");
      this._blockedDestinationsList = document
            .getElementById("rp-blocked-destinations-list");
      this._allowedDestinationsList = document
            .getElementById("rp-allowed-destinations-list");

      var conflictCount = this._rpServiceJSObject.getConflictingExtensions().length;
      var hideConflictInfo = (conflictCount == 0);
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

      var currentUri = requestpolicy.overlay.getTopLevelDocumentUri();
      var isChromeUri = currentUriObj.scheme == "chrome";

      var self = this;
      function populateList(list, values) {
        self._removeChildren(list);
        for (var i in values) {
          self._addListItem(list, 'rp-od-item', values[i]);
        }
      }

      populateList(this._otherOriginsList, this._getOtherOrigins());
      populateList(this._allowedDestinationsList, this._getAllowedDestinations());
      populateList(this._blockedDestinationsList, this._getBlockedDestinations());

    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Unable to prepare menu due to error.");
      throw e;
    }

  },

  _getBlockedDestinations : function(currentUri, currentUriObj,
        currentIdentifier, currentBaseDomain) {
    return ['foo.com', 'bar.com'];
  },

  _getAllowedDestinations : function(currentUri, currentUriObj,
                                     currentIdentifier, currentBaseDomain) {
    return ['yaz.com', 'example.com'];
  },

  _getOtherOrigins : function(currentUri, currentUriObj,
                              currentIdentifier, currentBaseDomain) {
    return ['otherorigin.com'];
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
    list.insertBefore(item, null);
  },

}
