/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

import {Log as log} from "content/models/log";
import {DomainUtil} from "content/lib/utils/domain-utils";
import {RequestResult} from "content/lib/request-result";

// =============================================================================
// utilities
// =============================================================================

function getUriIdentifier(uri) {
  try {
    return DomainUtil.getIdentifier(uri, DomainUtil.LEVEL_SOP);
  } catch (e) {
    const msg = "getUriIdentifier exception on uri <" + uri + "> " +
        ". Exception was: " + e;
    // eslint-disable-next-line no-throw-literal
    throw new Error(msg);
  }
}

// =============================================================================
// RequestSet
// =============================================================================

export class RequestSet {
  constructor() {
    this._origins = {};
  }

  print(name, printFn = log.log.bind(log)) {
    printFn("-------------------------------------------------");
    printFn("== Request Set <" + name + "> ==");
    // "Take that, Big-O!"
    const origins = this._origins;
    for (let oUri in origins) {
      printFn("      " + "Origin uri: <" + oUri + ">");
      for (let dBase in origins[oUri]) {
        const dests = origins[oUri];
        printFn("        " + "Dest base domain: <" + dBase + ">");
        for (let dIdent in dests[dBase]) {
          printFn("          " + "Dest identifier: <" + dIdent + ">");
          for (let dUri in dests[dBase][dIdent]) {
            const n = dests[dBase][dIdent][dUri].length;
            printFn("            " + "Dest uri: (" + n + " requests) <" +
                dUri + ">");
          }
        }
      }
    }
    printFn("-------------------------------------------------");
  }

  getAll() {
    return this._origins;
  }

  // TODO: the name of this method, getAllMergedOrigins, is confusing. Is it
  // getting all of the "merged origins" is it "getting all" and merging the
  // origins when it does it?
  getAllMergedOrigins() {
    const result = {};
    for (let originUri in this._origins) {
      const dests = this._origins[originUri];
      for (let destBase in dests) {
        if (!result[destBase]) {
          result[destBase] = {};
        }
        for (let destIdent in dests[destBase]) {
          if (!result[destBase][destIdent]) {
            result[destBase][destIdent] = {};
          }
          for (let destUri in dests[destBase][destIdent]) {
            if (!result[destBase][destIdent][destUri]) {
              result[destBase][destIdent][destUri] =
                  dests[destBase][destIdent][destUri];
            } else {
              result[destBase][destIdent][destUri] =
                  result[destBase][destIdent][destUri].
                      concat(dests[destBase][destIdent][destUri]);
            }
          }
        }
      }
    }
    return result;
  }

  getOriginUri(originUri) {
    return this._origins[originUri] || {};
  }

  /**
   * @param {string} originUri
   * @param {string} destUri
   * @param {RequestResult} requestResult
   */
  addRequest(originUri, destUri, requestResult) {
    if (requestResult === undefined) {
      log.warn(
          "addRequest() was called without a requestResult object!" +
          " Creating a new one. -- " +
          "origin: <" + originUri + ">, destination: <" + destUri + ">");
      requestResult = new RequestResult();
    }

    if (!this._origins[originUri]) {
      this._origins[originUri] = {};
    }
    const dests = this._origins[originUri];

    const destBase = DomainUtil.getBaseDomain(destUri);
    if (!dests[destBase]) {
      dests[destBase] = {};
    }

    const destIdent = getUriIdentifier(destUri);
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
  }

  /**
   * @param {string} originUri
   * @param {string} destUri
   */
  removeRequest(originUri, destUri) {
    if (!this._origins[originUri]) {
      return;
    }
    const dests = this._origins[originUri];

    const destBase = DomainUtil.getBaseDomain(destUri);
    if (!dests[destBase]) {
      return;
    }

    const destIdent = getUriIdentifier(destUri);
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
  }

  /**
   * @param {string} originUri
   */
  removeOriginUri(originUri) {
    delete this._origins[originUri];
  }

  containsBlockedRequests() {
    let origins = this._origins;
    for (let originURI in origins) {
      let originUriRequests = origins[originURI];
      for (let destBase in originUriRequests) {
        let destBaseRequests = originUriRequests[destBase];
        for (let destIdent in destBaseRequests) {
          let destIdentRequests = destBaseRequests[destIdent];
          for (let destURI in destIdentRequests) {
            let destUriRequests = destIdentRequests[destURI];
            for (let request of destUriRequests) {
              if (true !== request.isAllowed) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
}
