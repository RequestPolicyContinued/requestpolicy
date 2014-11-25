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

var EXPORTED_SYMBOLS = ["RequestUtil", "RequestSet"];

Components.utils.import("chrome://requestpolicy/content/lib/domain-util.jsm");
Components.utils.import("chrome://requestpolicy/content/lib/Logger.jsm");
Components.utils.import("chrome://requestpolicy/content/lib/RequestResult.jsm");

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
            for (var i in dests[dBase][dIdent][dUri]) {
              log.dump("              " + "#: " + i);
              for (var ruleStr in dests[dBase][dIdent][dUri][i]) {
                log.dump("                " + "Rule: <" + ruleStr + ">");
              }
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
            if (!result[destBase][destIdent][destUri]) {
              result[destBase][destIdent][destUri] = dests[destBase][destIdent][destUri];
            } else {
              result[destBase][destIdent][destUri] =
                    result[destBase][destIdent][destUri]
                    .concat(dests[destBase][destIdent][destUri]);
            }
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
  addRequest : function(originUri, destUri, requestResult) {
    if (requestResult == undefined) {
      Logger.warning(Logger.TYPE_INTERNAL,
          "addRequest() was called without a requestResult object!"
          +" Creating a new one.\n"
          +"\torigin: <"+originUri+">\n"
          +"\tdestination: <"+destUri+">"
      );
      requestResult = new RequestResult();
    }

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
/*
    if (!dests[destBase][destIdent][destUri]) {
      // TODO: this is a little sketchy. What if we clobber rules
      // that were already here? Arguably if we are told to add the
      // same origin and dest pair, this will happen. Is that supposed
      // to be possible?
      dests[destBase][destIdent][destUri] = requestResult;
    } else {
      // TODO: append rules, removing duplicates.
    }
    */
    if (!dests[destBase][destIdent][destUri]) {
      dests[destBase][destIdent][destUri] = [];
    }
    if (requestResult instanceof Array) {
      dests[destBase][destIdent][destUri] =
            dests[destBase][destIdent][destUri]
            .concat(requestResult);
    } else {
      dests[destBase][destIdent][destUri].push(requestResult);
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
  },

  containsBlockedRequests : function() {
    var origins = this._origins
    for (var originURI in origins) {
      for (var destBase in origins[originURI]) {
        for (var destIdent in origins[originURI][destBase]) {
          for (var destURI in origins[originURI][destBase][destIdent]) {
            for (var i in origins[originURI][destBase][destIdent][destURI]) {
              if (true !==
                  origins[originURI][destBase][destIdent][destURI][i].isAllowed) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
};

var RequestUtil = {

  setRPService : function (rpService) {
    this._rpService = rpService;
  },

  _getRequestsHelper : function(currentlySelectedOrigin, allRequestsOnDocument, isAllowed) {
    var result = new RequestSet();
    var requests = allRequestsOnDocument.getAll();

    // We're assuming ident is fullIdent (LEVEL_SOP). We plan to remove base
    // domain and hostname levels.
    for (var originUri in requests) {
      if (getBaseDomain(originUri) != currentlySelectedOrigin) {
        // only return requests from the given base domain
        continue;
      }
      Logger.dump("test destBase: " + destBase);
      for (var destBase in requests[originUri]) {
        Logger.dump("test destBase: " + destBase);
        for (var destIdent in requests[originUri][destBase]) {
          Logger.dump("test destIdent: " + destIdent);
          for (var destUri in requests[originUri][destBase][destIdent]) {
            Logger.dump("test destUri: " + destUri);
            var dest = requests[originUri][destBase][destIdent][destUri];
            for (var i in dest) {
              // TODO: This variable could have been created easily already in
              //       getAllRequestsOnDocument(). ==> rewrite RequestSet to
              //       contain a blocked list, an allowed list (and maybe a list
              //       of all requests).
              if (isAllowed === dest[i].isAllowed) {
                result.addRequest(originUri, destUri, dest[i]);
              }
            }
          }
        }
      }
    }

    return result;
  },

  getDeniedRequests : function(currentlySelectedOrigin, allRequestsOnDocument) {
    Logger.dump("## getDeniedRequests");
    return this._getRequestsHelper(currentlySelectedOrigin, allRequestsOnDocument, false);
  },

  getAllowedRequests : function(currentlySelectedOrigin, allRequestsOnDocument) {
    Logger.dump("## getAllowedRequests");
    return this._getRequestsHelper(currentlySelectedOrigin, allRequestsOnDocument, true);
  },

  /**
   * TODO: This comment is quite old. It might not be necessary anymore to
   *       check the DOM since all requests are recorded, like:
   *       RequestSet._origins[originURI][destBase][destIdent][destURI][i]
   * Info: As soon as requests are saved per Tab, this function isn't needed
   *       anymore.
   *
   * This will look both at the DOM as well as the recorded allowed requests to
   * determine which other origins exist within the document. This includes
   * other origins that have the same domain.
   *
   * The reason for also
   * needing to check the DOM is that some sites (like gmail) will make multiple
   * requests to the same uri for different iframes and this will cause us to
   * only have in the recorded requests from a source uri the destinations from
   * the most recent iframe that loaded that source uri. It may also help in
   * cases where the user has multiple tabs/windows open to the same page.
   *
   * @param {}
   *          document
   * @return {}
   *          RequestSet
   */
  getAllRequestsOnDocument : function(document) {
    //var origins = {};
    var reqSet = new RequestSet();

    // If we get these from the DOM, then we won't know the relevant
    // rules that were involved with allowing/denying the request.
    // Maybe just look up the allowed/blocked requests in the
    // main allowed/denied request sets before adding them.
    //this._getOtherOriginsHelperFromDOM(document, reqSet);

    var documentURI = DomainUtil.stripFragment(document.documentURI);
    this._addRecursivelyAllRequestsFromURI(documentURI, reqSet, {});
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

  _addRecursivelyAllRequestsFromURI : function(originURI, reqSet, checkedOrigins) {
    Logger.dump("Looking for other origins within allowed requests from "
            + originURI);
    if (!checkedOrigins[originURI]) {
      // this "if" is needed for the first call of this function.
      checkedOrigins[originURI] = true;
    }
    this._addAllDeniedRequestsFromURI(originURI, reqSet);
    var allowedRequests = this._rpService._requestProcessor.
        _allowedRequests.getOriginUri(originURI);
    if (allowedRequests) {
      for (var destBase in allowedRequests) {
        for (var destIdent in allowedRequests[destBase]) {
          for (var destURI in allowedRequests[destBase][destIdent]) {
            Logger.dump("Found allowed request to <"
                + destURI + "> from <" + originURI + ">");
            reqSet.addRequest(originURI, destURI,
                              allowedRequests[destBase][destIdent][destURI]);

            if (!checkedOrigins[destURI]) {
              // only check the destination URI if it hasn't been checked yet.
              checkedOrigins[destURI] = true;

              this._addRecursivelyAllRequestsFromURI(destURI, reqSet, checkedOrigins);
            }
          }
        }
      }
    }
  },

  _addAllDeniedRequestsFromURI : function(originURI, reqSet) {
    Logger
      .dump("Looking for other origins within denied requests from "
              + originURI);
    var requests = this._rpService._requestProcessor._rejectedRequests.getOriginUri(originURI);
    if (requests) {
      for (var destBase in requests) {
        for (var destIdent in requests[destBase]) {
          for (var destUri in requests[destBase][destIdent]) {
            Logger.dump("Found denied request to <"
                          + destUri + "> from <" + originURI + ">");
            reqSet.addRequest(originURI, destUri,
                              requests[destBase][destIdent][destUri]);
          }
        }
      }
    }
  },

};
