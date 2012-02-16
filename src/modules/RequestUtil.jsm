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

var EXPORTED_SYMBOLS = ["RequestUtil", "RequestSet"];

Components.utils.import("resource://requestpolicy/DomainUtil.jsm");
Components.utils.import("resource://requestpolicy/Logger.jsm");

function getUriObject(uri) {
  return DomainUtil.getUriObject(uri);
}

function getUriIdentifier(uri) {
  try {
    return DomainUtil.getIdentifier(
          uri, DomainUtil.LEVEL_SOP);
  } catch (e) {
    var msg = "RequestUtil.getUriIdentifier exception on uri <" + uri + "> "
          + ". Exception was: " + e;
    throw msg;
  }
}

function getBaseDomain(uri) {
  return DomainUtil.getDomain(uri);
}

function RequestSet() {
  this._origins = {};
}
RequestSet.prototype = {
  _origins : null,
  
  print : function(name) {
    var log = Logger;
    log.dump("-------------------------------------------------");
    log.dump("== Request Set <" + name + "> ==");
    // "Take that, Big-O!"
    var origins = this._origins;
    for (var oUri in origins) {
      log.dump("      " + "Origin uri: <" + oUri + ">");
      for (var dBase in origins[oUri]) {
        var dests = origins[oUri];
        log.dump("        " + "Dest base domain: <" + dBase + ">");
        for (var dIdent in dests[dBase]) {
          log.dump("          " + "Dest identifier: <" + dIdent + ">");
          for (var dUri in dests[dBase][dIdent]) {
            log.dump("            " + "Dest uri: <" + dUri + ">");
            for (var ruleStr in dests[dBase][dIdent][dUri]) {
              log.dump("              " + "Rule: <" + ruleStr + ">");
            }
          }
        }
      }
    }
    log.dump("-------------------------------------------------");
  },

  getAll : function() {
    return this._origins;
  },

  // TODO: the name of this method, getAllMergedOrigins, is confusing. Is it
  // getting all of the "merged origins" is it "getting all" and merging the
  // origins when it does it?
  getAllMergedOrigins : function() {
    var result = {};
    for (var originUri in this._origins) {
      var dests = this._origins[originUri];
      for (var destBase in dests) {
        if (!result[destBase]) {
           result[destBase] = {};
        }
        for (var destIdent in dests[destBase]) {
          if (!result[destBase][destIdent]) {
             result[destBase][destIdent] = {};
          }
          for (var destUri in dests[destBase][destIdent]) {
            // TODO: handle the case where we encounter the uri more than
            // once (that is, we need to merge the triggered rules).
            result[destBase][destIdent][destUri] = dests[destBase][destIdent][destUri];
          }
        }
      }
    }
    return result;
  },

  getOriginUri : function(originUri) {
    return this._origins[originUri];
  },

  /**
   * @param {Array} rules The rules that were triggered by this request.
   */
  addRequest : function(originUri, destUri, checkRequestResult) {
    if (!this._origins[originUri]) {
      this._origins[originUri] = {};
    }
    var dests = this._origins[originUri];
    
    var destBase = getBaseDomain(destUri);
    if (!dests[destBase]) {
      dests[destBase] = {};
    }

    var destIdent = getUriIdentifier(destUri);
    if (!dests[destBase][destIdent]) {
      dests[destBase][destIdent] = {};
    }

    // if (typeof rules != "object") {
    //   throw "addRequest 'rules' argument must be an object where each " +
    //         "key/val is ruleStr/rule";
    // }

    if (!dests[destBase][destIdent][destUri]) {
      // TODO: this is a little sketchy. What if we clobber rules
      // that were already here? Arguably if we are told to add the
      // same origin and dest pair, this will happen. Is that supposed
      // to be possible?
      dests[destBase][destIdent][destUri] = checkRequestResult;
    } else {
      // TODO: append rules, removing duplicates.
    }
  },
  
  /**
   */
  removeRequest : function(originUri, destUri) {
    if (!this._origins[originUri]) {
      return;
    }
    var dests = this._origins[originUri];
    
    var destBase = getBaseDomain(destUri);
    if (!dests[destBase]) {
      return;
    }

    var destIdent = getUriIdentifier(destUri);
    if (!dests[destBase][destIdent]) {
      return;
    }

    if (!dests[destBase][destIdent][destUri]) {
      return;
    }
    delete dests[destBase][destIdent][destUri];
    
    if (Object.getOwnPropertyNames(dests[destBase][destIdent]).length > 0) {
      return;
    }
    delete dests[destBase][destIdent];

    if (Object.getOwnPropertyNames(dests[destBase]).length > 0) {
      return;
    }
    delete dests[destBase];
    
    if (Object.getOwnPropertyNames(dests).length > 0) {
      return;
    }
    delete this._origins[originUri];
  },
  
  /**
   */
  removeOriginUri : function(originUri) {
    delete this._origins[originUri];
  }
};

var RequestUtil = {

  setRPService : function (rpService) {
    this._rpServiceJSObject = rpService;
  },

  /**
   * Returns an object whose keys are the rejected URIs from |currentUri|.
   */
  getDirectRejectedRequests : function(currentUri) {
    // Let's try this: returning the same data structure we already have.
    return this._rpServiceJSObject._rejectedRequests.getOriginUri(currentUri);
  },

  _getRequestsHelper : function(currentUri, curIdent, otherOrigins, requests) {
    var result = new RequestSet();

    // We're assuming ident is fullIdent (LEVEL_SOP). We plan to remove base
    // domain and hostname levels.
    for (var destBase in requests[currentUri]) {
      Logger.dump("test direct destBase: " + destBase);
      for (var destIdent in requests[currentUri][destBase]) {
        Logger.dump("test direct destIdent: " + destIdent);
        for (var destUri in requests[currentUri][destBase][destIdent]) {
          Logger.dump("test direct destUri: " + destUri);
          result.addRequest(currentUri, destUri,
                            requests[currentUri][destBase][destIdent][destUri]);
        }
      }
    }

    // Add the rejected requests from other origins within this page that have
    // the same uriIdentifier as the current page.
    //Logger.dump("test xxx: " + "originUri");
    if (curIdent) {
      var curBase = getBaseDomain(curIdent);
      Logger.dump("test curBase: " + curBase);
      for (var curIdent in otherOrigins[curBase]) {
        Logger.dump("test curIdent: " + curIdent);
        for (var originUri in otherOrigins[curBase][curIdent]) {
          Logger.dump("test originUri: " + originUri);
          for (var destBase in requests[originUri]) {
            Logger.dump("test destBase: " + destBase);
            for (var destIdent in requests[originUri][destBase]) {
              for (var destUri in requests[originUri][destBase][destIdent]) {
                result.addRequest(originUri, destUri,
                                  requests[originUri][destBase][destIdent][destUri]);
              }
            }
          }
        }
      }
    }

    return result;
  },

  getDeniedRequests : function(currentUri, currentIdentifier, otherOrigins) {
    Logger.dump("## getDeniedRequests");
    //this._rpServiceJSObject._rejectedRequests.print("from getRejectedRequests");
    return this._getRequestsHelper(currentUri, currentIdentifier, otherOrigins,
          this._rpServiceJSObject._rejectedRequests.getAll());
  },

  getAllowedRequests : function(currentUri, currentIdentifier, otherOrigins) {
    Logger.dump("## getAllowedRequests");
    return this._getRequestsHelper(currentUri, currentIdentifier, otherOrigins,
          this._rpServiceJSObject._allowedRequests.getAll());
  },

  /**
   * This will look both at the DOM as well as the recorded allowed requests to
   * determine which other origins exist within the document. This includes
   * other origins that have the same domain. The returned format is an object
   * with properties that are URI identifiers and the properties of those are
   * the actual other URIs (i.e. origin[uriIdent][uri]). The reason for also
   * needing to check the DOM is that some sites (like gmail) will make multiple
   * requests to the same uri for different iframes and this will cause us to
   * only have in the recorded requests from a source uri the destinations from
   * the most recent iframe that loaded that source uri. It may also help in
   * cases where the user has multiple tabs/windows open to the same page.
   * 
   * @param {}
   *          document
   * @return {}
   */
  getOtherOrigins : function(document) {
    //var origins = {};
    var reqSet = new RequestSet();

    // If we get these from the DOM, then we won't know the relevant
    // rules that were involved with allowing/denying the request.
    // Maybe just look up the allowed/blocked requests in the
    // main allowed/denied request sets before adding them.
    //this._getOtherOriginsHelperFromDOM(document, reqSet);

    this._getOtherOriginsHelperFromAllowedRequests(DomainUtil
            .stripFragment(document.documentURI), reqSet, {});
    return reqSet;
  },

//  _getOtherOriginsHelperFromDOM : function(document, reqSet) {
//    var documentUri = DomainUtil
//        .stripFragment(document.documentURI);
//    Logger.dump("Looking for other origins within DOM of "
//        + documentUri);
//    // TODO: Check other elements besides iframes and frames?
//    var frameTagTypes = {
//      "iframe" : null,
//      "frame" : null
//    };
//    for (var tagType in frameTagTypes) {
//      var iframes = document.getElementsByTagName(tagType);
//      for (var i = 0; i < iframes.length; i++) {
//        var child = iframes[i];
//        var childDocument = child.contentDocument;
//        // Flock's special home page is about:myworld. It has (i)frames in it
//        // that have no contentDocument. It's probably related to the fact that
//        // that is an xul page, but I have no reason to fully understand the
//        // problem in order to fix it.
//        if (!childDocument) {
//          continue;
//        }
//        var childUri = DomainUtil
//            .stripFragment(childDocument.documentURI);
//        if (childUri == "about:blank") {
//          // iframe empty or not loaded yet, or maybe blocked.
//          // childUri = child.src;
//          // If it's not loaded or blocked, it's not the origin for anything
//          // yet.
//          continue;
//        }
//        Logger.dump("Found DOM child " + tagType
//            + " with src <" + childUri + "> in document <" + documentUri + ">");
//        //var childUriIdent = getUriIdentifier(childUri);
//        // if (!origins[childUriIdent]) {
//        //   origins[childUriIdent] = {};
//        // }
//        // origins[childUriIdent][childUri] = true;
//        reqSet.addRequest(documentUri, childUri);
//        this._getOtherOriginsHelperFromDOM(childDocument, reqSet);
//      }
//    }
//  },

  _getOtherOriginsHelperFromAllowedRequests : function(rootUri, reqSet,
      checkedOrigins) {
    Logger
        .dump("Looking for other origins within allowed requests from "
            + rootUri);
    var allowedRequests = this._rpServiceJSObject._allowedRequests.getOriginUri(rootUri);
    if (allowedRequests) {
      for (var destBase in allowedRequests) {
        for (var destIdent in allowedRequests[destBase]) {
          for (var destUri in allowedRequests[destBase][destIdent]) {
            if (checkedOrigins[destUri]) {
              continue;
            }
            checkedOrigins[destUri] = true;
  
            Logger.dump("Found allowed request to <"
                + destUri + "> from <" + rootUri + ">");
            // var allowedUriIdent = getUriIdentifier(allowedUri);
            // if (!origins[allowedUriIdent]) {
            //   origins[allowedUriIdent] = {};
            // }
            // origins[allowedUriIdent][allowedUri] = true;
            reqSet.addRequest(rootUri, destUri);
            this._getOtherOriginsHelperFromAllowedRequests(destUri, reqSet,
                checkedOrigins);
            this._getOtherOriginsHelperFromDeniedRequests(destUri, reqSet,
                                                           checkedOrigins);
          }
        }
      }
    }
  },

  _getOtherOriginsHelperFromDeniedRequests : function(rootUri, reqSet,
                                                       checkedOrigins) {
    Logger
      .dump("Looking for other origins within denied requests from "
              + rootUri);
    var requests = this._rpServiceJSObject._rejectedRequests.getOriginUri(rootUri);
    if (requests) {
      for (var destBase in requests) {
        for (var destIdent in requests[destBase]) {
          for (var destUri in requests[destBase][destIdent]) {
//            if (checkedOrigins[destUri]) {
//              continue;
//            }
//            checkedOrigins[destUri] = true;
            Logger.dump("Found denied request to <"
                          + destUri + "> from <" + rootUri + ">");
            reqSet.addRequest(rootUri, destUri);
          }
        }
      }
    }
  },

  originHasRejectedRequests : function(originUri) {
    return this._originHasRejectedRequestsHelper(originUri, {});
  },
  
  _originHasRejectedRequestsHelper : function(originUri, checkedUris) {
    if (checkedUris[originUri]) {
      return false;
    }
    checkedUris[originUri] = true;
  
    var rejectedRequests = this._rpServiceJSObject._rejectedRequests.getOriginUri(originUri);
    if (rejectedRequests) {
      for (var i in rejectedRequests) {
        for (var j in rejectedRequests[i]) {
          if (rejectedRequests[i][j]) {
            return true;
          }
        }
      }
    }
    // If this url had an allowed redirect to another url which in turn had a
    // rejected redirect (e.g. installing extensions from AMO with full domain
    // strictness enabled), then it will show up by recursively checking each
    // allowed request.
    // I think this logic will also indicate rejected requests if this
    // origin has rejected requests from other origins within it. I don't
    // believe this will cause a problem.
    var allowedRequests = this._rpServiceJSObject._allowedRequests.getOriginUri(originUri);
    if (allowedRequests) {
      for (var i in allowedRequests) {
        for (var j in allowedRequests[i]) {
          if (this._originHasRejectedRequestsHelper(j, checkedUris)) {
            return true;
          }
        }
      }
    }
    return false;
  },

};
