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
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";
import { RequestResult } from "lib/classes/request-result";
import { RequestSet } from "lib/classes/request-set";

export class RequestSetService extends Module {
  constructor(
      parentLog: Common.ILog,
      private uriService: App.services.IUriService,
  ) {
    super("app.services.requestSet", parentLog);
  }

  public addRequest(
      requestSet: RequestSet,
      originUri: string,
      destUri: string,
      aRequestResult: RequestResult | RequestResult[],
  ) {
    let requestResult = aRequestResult;
    if (requestResult === undefined) {
      this.log.warn(
          "addRequest() was called without a requestResult object!" +
          " Creating a new one. -- " +
          `"origin: <${originUri}>, destination: <${destUri}>`,
      );
      requestResult = new RequestResult();
    }

    if (!requestSet.origins[originUri]) {
      requestSet.origins[originUri] = {};
    }
    const dests = requestSet.origins[originUri];

    const destBaseOrNull = this.uriService.getBaseDomain(destUri);
    if (destBaseOrNull === null) {
      this.log.warn(`Got 'null' base domain for URI <${destUri}>`);
    }
    // FIXME
    const destBase = destBaseOrNull!;
    if (!dests[destBase]) {
      dests[destBase] = {};
    }

    const destIdent = this.getUriIdentifier(destUri);
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
      requestSet: RequestSet,
      originUri: string,
      destUri: string,
  ) {
    if (!requestSet.origins[originUri]) { return; }
    const dests = requestSet.origins[originUri];

    const destBaseOrNull = this.uriService.getBaseDomain(destUri);
    if (destBaseOrNull === null) {
      this.log.warn(`Got 'null' base domain for URI <${destUri}>`);
    }
    // FIXME
    const destBase = destBaseOrNull!;
    if (!dests[destBase]) { return; }

    const destIdent = this.getUriIdentifier(destUri);
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
    delete requestSet.origins[originUri];
  }

  private getUriIdentifier(uri: string) {
    try {
      return this.uriService.getIdentifier(uri, this.uriService.hostLevels.SOP);
    } catch (e) {
      const msg = `getUriIdentifier exception on uri <${uri}>. ` +
          `Exception was: ${e}`;
      throw new Error(msg);
    }
  }
}
