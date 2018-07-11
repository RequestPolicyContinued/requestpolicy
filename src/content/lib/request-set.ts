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

import { App } from "app/interfaces";
import {log} from "app/log";
import {RequestResult} from "lib/classes/request-result";

// =============================================================================
// utilities
// =============================================================================

function getUriIdentifier(uri: string, uriService: App.services.IUriService) {
  try {
    return uriService.getIdentifier(uri, uriService.hostLevels.SOP);
  } catch (e) {
    const msg = `getUriIdentifier exception on uri <${uri}>. ` +
        `Exception was: ${e}`;
    throw new Error(msg);
  }
}

// =============================================================================
// RequestSet
// =============================================================================

export class RequestSet {
  // FIXME: should be private
  public origins: any = {};

  public print(
      name: string,
      printFn: (s: string) => void = log.log.bind(log),
  ) {
    printFn("-------------------------------------------------");
    printFn(`== Request Set <${name}> ==`);
    // "Take that, Big-O!"
    const origins = this.origins;
    // tslint:disable:forin
    for (const oUri in origins) {
      printFn(`${"      " + "Origin uri: <"}${oUri}>`);
      for (const dBase in origins[oUri]) {
        const dests = origins[oUri];
        printFn(`${"        " + "Dest base domain: <"}${dBase}>`);
        for (const dIdent in dests[dBase]) {
          printFn(`${"          " + "Dest identifier: <"}${dIdent}>`);
          for (const dUri in dests[dBase][dIdent]) {
            const n = dests[dBase][dIdent][dUri].length;
            printFn(`${"            " + "Dest uri: ("}${n} requests) <${
              dUri}>`);
          }
        }
      }
    }
    printFn("-------------------------------------------------");
  }

  public getAll() {
    return this.origins;
  }

  // TODO: the name of this method, getAllMergedOrigins, is confusing. Is it
  // getting all of the "merged origins" is it "getting all" and merging the
  // origins when it does it?
  public getAllMergedOrigins() {
    const result: any = {};
    // tslint:disable:forin
    for (const originUri in this.origins) {
      const dests = this.origins[originUri];
      for (const destBase in dests) {
        if (!result[destBase]) {
          result[destBase] = {};
        }
        for (const destIdent in dests[destBase]) {
          if (!result[destBase][destIdent]) {
            result[destBase][destIdent] = {};
          }
          for (const destUri in dests[destBase][destIdent]) {
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

  public getOriginUri(originUri: string) {
    return this.origins[originUri] || {};
  }

  public addRequest(
      originUri: string,
      destUri: string,
      aRequestResult: RequestResult,
      uriService: App.services.IUriService,
  ) {
    let requestResult = aRequestResult;
    if (requestResult === undefined) {
      log.warn(
          "addRequest() was called without a requestResult object!" +
          " Creating a new one. -- " +
          `"origin: <${originUri}>, destination: <${destUri}>`,
      );
      requestResult = new RequestResult();
    }

    if (!this.origins[originUri]) {
      this.origins[originUri] = {};
    }
    const dests = this.origins[originUri];

    const destBaseOrNull = uriService.getBaseDomain(destUri);
    if (destBaseOrNull === null) {
      log.warn(`Got 'null' base domain for URI <${destUri}>`);
    }
    // FIXME
    const destBase = destBaseOrNull!;
    if (!dests[destBase]) {
      dests[destBase] = {};
    }

    const destIdent = getUriIdentifier(destUri, uriService);
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
            dests[destBase][destIdent][destUri].
                concat(requestResult);
    } else {
      dests[destBase][destIdent][destUri].push(requestResult);
    }
  }

  public removeRequest(
      originUri: string,
      destUri: string,
      uriService: App.services.IUriService,
  ) {
    if (!this.origins[originUri]) { return; }
    const dests = this.origins[originUri];

    const destBaseOrNull = uriService.getBaseDomain(destUri);
    if (destBaseOrNull === null) {
      log.warn(`Got 'null' base domain for URI <${destUri}>`);
    }
    // FIXME
    const destBase = destBaseOrNull!;
    if (!dests[destBase]) { return; }

    const destIdent = getUriIdentifier(destUri, uriService);
    if (!dests[destBase][destIdent]) { return; }

    if (!dests[destBase][destIdent][destUri]) { return; }
    delete dests[destBase][destIdent][destUri];

    if (Object.getOwnPropertyNames(dests[destBase][destIdent]).length > 0) {
      return;
    }
    delete dests[destBase][destIdent];

    if (Object.getOwnPropertyNames(dests[destBase]).length > 0) { return; }
    delete dests[destBase];

    if (Object.getOwnPropertyNames(dests).length > 0) { return; }
    delete this.origins[originUri];
  }

  public removeOriginUri(originUri: string) {
    delete this.origins[originUri];
  }

  public containsBlockedRequests() {
    const origins = this.origins;
    // tslint:disable:forin
    for (const originURI in origins) {
      const originUriRequests = origins[originURI];
      for (const destBase in originUriRequests) {
        const destBaseRequests = originUriRequests[destBase];
        for (const destIdent in destBaseRequests) {
          const destIdentRequests = destBaseRequests[destIdent];
          for (const destURI in destIdentRequests) {
            const destUriRequests = destIdentRequests[destURI];
            for (const request of destUriRequests) {
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
