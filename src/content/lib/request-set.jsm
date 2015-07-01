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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["RequestSet"];

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/logger",
  "lib/utils/domains",
  "lib/request-result"
], this);



function getUriIdentifier(uri) {
  try {
    return DomainUtil.getIdentifier(uri, DomainUtil.LEVEL_SOP);
  } catch (e) {
    var msg = "getUriIdentifier exception on uri <" + uri + "> " +
        ". Exception was: " + e;
    throw new Error(msg);
  }
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
    return this._origins[originUri] || {};
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

    var destBase = DomainUtil.getBaseDomain(destUri);
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

    var destBase = DomainUtil.getBaseDomain(destUri);
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
