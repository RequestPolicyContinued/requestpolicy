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

var EXPORTED_SYMBOLS = ["RequestUtil"]

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/DomainUtil.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Logger.jsm",
    requestpolicy.mod);

var RequestUtil = {

  _rpService : Components.classes["@requestpolicy.com/requestpolicy-service;1"]
      .getService(Components.interfaces.nsIRequestPolicy),

  _rpServiceJSObject : Components.classes["@requestpolicy.com/requestpolicy-service;1"]
      .getService(Components.interfaces.nsIRequestPolicy).wrappedJSObject,

  getRejectedRequests : function(currentUri, currentIdentifier, otherOrigins) {
    var rejectedRequests = {};
    if (currentUri in this._rpServiceJSObject._rejectedRequests) {
      for (var ident in this._rpServiceJSObject._rejectedRequests[currentUri]) {
        rejectedRequests[ident] = true;
      }
    }
    // Add the rejected requests from other origins within this page that have
    // the same uriIdentifier as the current page.
    if (currentIdentifier in otherOrigins) {
      for (var i in otherOrigins[currentIdentifier]) {
        if (i in this._rpServiceJSObject._rejectedRequests) {
          this.dumpRequestSet(this._rpServiceJSObject._rejectedRequests[i],
              "Rejected requests of " + i);
          for (var ident in this._rpServiceJSObject._rejectedRequests[i]) {
            rejectedRequests[ident] = true;
          }
        }
      }
    }
    return rejectedRequests;
  },

  getAllowedRequests : function(currentUri, currentIdentifier, otherOrigins) {
    var allowedRequests = {};
    if (currentUri in this._rpServiceJSObject._allowedRequests) {
      for (var ident in this._rpServiceJSObject._allowedRequests[currentUri]) {
        allowedRequests[ident] = true;
      }
    }
    // Add the allowed requests from other origins within this page that have
    // the same uriIdentifier as the current page.
    if (currentIdentifier in otherOrigins) {
      for (var i in otherOrigins[currentIdentifier]) {
        if (i in this._rpServiceJSObject._allowedRequests) {
          for (var ident in this._rpServiceJSObject._allowedRequests[i]) {
            allowedRequests[ident] = true;
          }
        }
      }
    }
    return allowedRequests;
  },

  /**
   * This will look both at the DOM as well as the recorded allowed requests to
   * determine which other origins exist within the document. This includes
   * other origins that have the same domain. The returned format is an object
   * with properties that are URI identifiers and the properties of those are
   * the actual other URIs (i.e. origin[uriIdent][uri]). The reason for also
   * needing to check the DOM is that some sites (like gmail) will make multiple
   * requests to the same uri for different iframs and this will cause us to
   * only have in the recorded requests from a source uri the destinations from
   * the most recent iframe that loaded that source uri. It may also help in
   * cases where the user has multiple tabs/windows open to the same page.
   * 
   * @param {}
   *          document
   * @return {}
   */
  getOtherOrigins : function(document) {
    var origins = {};
    this._getOtherOriginsHelperFromDOM(document, origins);
    this._getOtherOriginsHelperFromAllowedRequests(requestpolicy.mod.DomainUtil
            .stripFragment(document.documentURI), origins, {});
    return origins;
  },

  _getOtherOriginsHelperFromDOM : function(document, origins) {
    var documentUri = requestpolicy.mod.DomainUtil
        .stripFragment(document.documentURI);
    requestpolicy.mod.Logger.dump("Looking for other origins within DOM of "
        + documentUri);
    // TODO: Check other elements besides iframes and frames?
    var frameTagTypes = {
      "iframe" : null,
      "frame" : null
    };
    for (var tagType in frameTagTypes) {
      var iframes = document.getElementsByTagName(tagType);
      for (var i = 0; i < iframes.length; i++) {
        var child = iframes[i];
        var childDocument = child.contentDocument;
        // Flock's special home page is about:myworld. It has (i)frames in it
        // that have no contentDocument. It's probably related to the fact that
        // that is an xul page, but I have no reason to fully understand the
        // problem in order to fix it.
        if (childDocument === undefined) {
          continue;
        }
        var childUri = requestpolicy.mod.DomainUtil
            .stripFragment(childDocument.documentURI);
        if (childUri == "about:blank") {
          // iframe empty or not loaded yet, or maybe blocked.
          // childUri = child.src;
          // If it's not loaded or blocked, it's not the origin for anything
          // yet.
          continue;
        }
        requestpolicy.mod.Logger.dump("Found DOM child " + tagType
            + " with src <" + childUri + "> in document <" + documentUri + ">");
        var childUriIdent = this._rpService.getUriIdentifier(childUri);
        if (!origins[childUriIdent]) {
          origins[childUriIdent] = {};
        }
        origins[childUriIdent][childUri] = true;
        this._getOtherOriginsHelperFromDOM(childDocument, origins);
      }
    }
  },

  _getOtherOriginsHelperFromAllowedRequests : function(rootUri, origins,
      checkedOrigins) {
    requestpolicy.mod.Logger
        .dump("Looking for other origins within allowed requests from "
            + rootUri);
    var allowedRequests = this._rpServiceJSObject._allowedRequests[rootUri];
    if (allowedRequests) {
      for (var i in allowedRequests) {
        for (var allowedUri in allowedRequests[i]) {
          if (checkedOrigins[allowedUri] || allowedUri == "count") {
            continue;
          }
          checkedOrigins[allowedUri] = true;

          requestpolicy.mod.Logger.dump("Found allowed request to <"
              + allowedUri + "> from <" + rootUri + ">");
          var allowedUriIdent = this._rpService.getUriIdentifier(allowedUri);
          if (!origins[allowedUriIdent]) {
            origins[allowedUriIdent] = {};
          }
          origins[allowedUriIdent][allowedUri] = true;
          this._getOtherOriginsHelperFromAllowedRequests(allowedUri, origins,
              checkedOrigins);
        }
      }
    }
  },

  dumpRequestSet : function(requestSet, name) {
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
    requestpolicy.mod.Logger.dump(name);
    for (i in requestSet) {
      requestpolicy.mod.Logger.dump("\t" + "Identifier: <" + i + ">");
      for (var j in requestSet[i]) {
        requestpolicy.mod.Logger.dump("\t\t" + j);
      }
    }
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
  },

  dumpOtherOrigins : function(otherOrigins) {
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
    requestpolicy.mod.Logger.dump("Other origins");
    for (i in otherOrigins) {
      requestpolicy.mod.Logger.dump("\t" + "Origin identifier: <" + i + ">");
      for (var j in otherOrigins[i]) {
        requestpolicy.mod.Logger.dump("\t\t" + j);
      }
    }
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
  }

};
