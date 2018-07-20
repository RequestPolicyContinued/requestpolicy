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

import { RequestResult } from "lib/classes/request-result";

export interface IUriMap<T> {
  [destBase: string]: {
    [destIdent: string]: {
      [destUri: string]: T;
    };
  };
}

export interface IRequestMap<T> {
  [originUri: string]: IUriMap<T>;
}

export class RequestSet {
  // FIXME: should be private
  public origins: IRequestMap<RequestResult[]> = {};

  public print(
      name: string,
      printFn: (s: string) => void,
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
  public getAllMergedOrigins(): IUriMap<RequestResult[]> {
    const result: IUriMap<RequestResult[]> = {};
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
