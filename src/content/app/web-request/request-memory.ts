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
import { XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { IListenInterface, Listeners } from "lib/classes/listeners";
import { Module } from "lib/classes/module";
import { RequestResult } from "lib/classes/request-result";
import { RequestSet } from "lib/classes/request-set";
import { createListenersMap } from "lib/utils/listener-factories";

export class RequestMemory extends Module {
  public readonly requestSets = {
    allowedRequests: new RequestSet(),
    rejectedRequests: new RequestSet(),
  };

  private readonly eventTargets: {[key: string]: IListenInterface};
  private readonly eventListenersMap: {[key: string]: Listeners};
  public get onRequest() { return this.eventTargets.onRequest; }

  constructor(
      log: Common.ILog,
      private readonly requestSetService: App.services.IRequestSetService,
      private readonly uriService: App.services.IUriService,
  ) {
    super("webRequest.requestMemory", log);
    const rv = createListenersMap([
      "onRequest",
    ]);
    this.eventTargets = rv.interfaces;
    this.eventListenersMap = rv.listenersMap;
  }

  // ===========================================================================

  /**
   * Remove all saved requests from a specific origin URI. Remove both
   * accepted and rejected requests.
   *
   * @param {string} uri The origin URI.
   */
  public removeSavedRequestsByOriginURI(uri: string) {
    this.requestSets.allowedRequests.removeOriginUri(uri);
    this.requestSets.rejectedRequests.removeOriginUri(uri);
  }

  public notifyNewRequest({
      originUri,
      destUri,
      isAllowed,
      requestResult,
      unforbidable,
      isInsert,
  }: {
      originUri: string,
      destUri: string,
      isAllowed: boolean,
      requestResult: RequestResult,
      unforbidable?: boolean,
      isInsert: boolean,
  }) {
    if (isAllowed) {
      // We aren't recording the request so it doesn't show up in the menu,
      // but we want it to still show up in the request log.
      if (!unforbidable) {
        if (!isInsert) {
          // The destination URI may itself originate further requests.
          this.removeSavedRequestsByOriginURI(destUri);
        }
        this.requestSetService.removeRequest(
            this.requestSets.rejectedRequests,
            originUri,
            destUri,
        );
        this.requestSetService.addRequest(
          this.requestSets.allowedRequests,
          originUri,
          destUri,
          requestResult,
        );
      }
    } else {
      this.requestSetService.addRequest(
          this.requestSets.rejectedRequests,
          originUri,
          destUri,
          requestResult,
      );
      this.requestSetService.removeRequest(
          this.requestSets.allowedRequests,
          originUri,
          destUri,
      );
    }
    this.eventListenersMap.onRequest.emit({
      destUri,
      isAllowed,
      originUri,
      requestResult,
    });
  }

  public getDeniedRequests(
      currentlySelectedOrigin: string,
      allRequestsOnDocument: RequestSet,
  ) {
    this.log.log("## getDeniedRequests");
    return this.getRequestsHelper(
        currentlySelectedOrigin,
        allRequestsOnDocument,
        false,
    );
  }

  public getAllowedRequests(
      currentlySelectedOrigin: string,
      allRequestsOnDocument: RequestSet,
  ) {
    this.log.log("## getAllowedRequests");
    return this.getRequestsHelper(
        currentlySelectedOrigin,
        allRequestsOnDocument,
        true,
    );
  }

  /**
   * TODO: This comment is quite old. It might not be necessary anymore to
   *       check the DOM since all requests are recorded, like:
   *       RequestSet.origins[originURI][destBase][destIdent][destURI][i]
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
   */
  public getAllRequestsInBrowser(browser: XUL.tabBrowser): RequestSet {
    // var origins = {};
    const reqSet = new RequestSet();

    // If we get these from the DOM, then we won't know the relevant
    // rules that were involved with allowing/denying the request.
    // Maybe just look up the allowed/blocked requests in the
    // main allowed/denied request sets before adding them.
    // _getOtherOriginsHelperFromDOM(document, reqSet);

    const uri = this.uriService.stripFragment(browser.currentURI.spec);
    this.addRecursivelyAllRequestsFromURI(uri, reqSet, {});
    return reqSet;
  }

  private getRequestsHelper(
      currentlySelectedOrigin: string,
      allRequestsOnDocument: RequestSet,
      isAllowed: boolean,
  ) {
    const result = new RequestSet();
    const requests = allRequestsOnDocument.getAll();

    // We're assuming ident is fullIdent (LEVEL_SOP). We plan to remove base
    // domain and hostname levels.
    // tslint:disable-next-line prefer-const
    for (let originUri in requests) {
      if (this.uriService.getBaseDomain(originUri) !==
              currentlySelectedOrigin) {
        // only return requests from the given base domain
        continue;
      }
      this.log.log("test originUri: " + originUri);

      const originUriRequests = requests[originUri];
      // tslint:disable-next-line prefer-const forin
      for (let destBase in originUriRequests) {
        this.log.log("test destBase: " + destBase);

        const destBaseRequests = originUriRequests[destBase];
        // tslint:disable-next-line prefer-const forin
        for (let destIdent in destBaseRequests) {
          this.log.log("test destIdent: " + destIdent);

          const destIdentRequests = destBaseRequests[destIdent];
          // tslint:disable-next-line prefer-const forin
          for (let destUri in destIdentRequests) {
            this.log.log("test destUri: " + destUri);

            const dest = destIdentRequests[destUri];
            // tslint:disable-next-line prefer-const
            for (let i in dest) {
              // TODO: This variable could have been created easily already in
              //       getAllRequestsInBrowser(). ==> rewrite RequestSet to
              //       contain a blocked list, an allowed list (and maybe a list
              //       of all requests).
              if (isAllowed === dest[i].isAllowed) {
                this.requestSetService.addRequest(
                    result,
                    originUri,
                    destUri,
                    dest[i],
                );
              }
            }
          }
        }
      }
    }

    return result;
  }

  private addRecursivelyAllRequestsFromURI(
      originURI: string,
      reqSet: RequestSet,
      checkedOrigins: {[key: string]: boolean},
  ) {
    this.log.log(
        "Looking for other origins within allowed requests from " +
        originURI);

    if (!checkedOrigins[originURI]) {
      // this "if" is needed for the first call of this function.
      checkedOrigins[originURI] = true;
    }
    this.addAllDeniedRequestsFromURI(originURI, reqSet);
    const allowedRequests = this.requestSets.allowedRequests.
        getOriginUri(originURI);
    if (allowedRequests) {
      // tslint:disable-next-line prefer-const forin
      for (let destBase in allowedRequests) {
        // tslint:disable-next-line prefer-const forin
        for (let destIdent in allowedRequests[destBase]) {
          // tslint:disable-next-line prefer-const forin
          for (let destURI in allowedRequests[destBase][destIdent]) {
            this.log.log(
                "Found allowed request to <" + destURI + "> " +
                "from <" + originURI + ">");
            this.requestSetService.addRequest(
                reqSet,
                originURI,
                destURI,
                allowedRequests[destBase][destIdent][destURI],
            );

            if (!checkedOrigins[destURI]) {
              // only check the destination URI if it hasn't been checked yet.
              checkedOrigins[destURI] = true;

              this.addRecursivelyAllRequestsFromURI(destURI, reqSet,
                  checkedOrigins);
            }
          }
        }
      }
    }
  }

  private addAllDeniedRequestsFromURI(originUri: string, reqSet: RequestSet) {
    this.log.log(
        "Looking for other origins within denied requests from " + originUri);

    const requests = this.requestSets.rejectedRequests.getOriginUri(originUri);
    if (requests) {
      // tslint:disable-next-line prefer-const forin
      for (let destBase in requests) {
        // tslint:disable-next-line prefer-const forin
        for (let destIdent in requests[destBase]) {
          // tslint:disable-next-line prefer-const forin
          for (let destUri in requests[destBase][destIdent]) {
            this.log.log(
                "Found denied request to <" + destUri + "> " +
                `from <${originUri}>`);

            this.requestSetService.addRequest(
                reqSet,
                originUri,
                destUri,
                requests[destBase][destIdent][destUri],
            );
          }
        }
      }
    }
  }
}
