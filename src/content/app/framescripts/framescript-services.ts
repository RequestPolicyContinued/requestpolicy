/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

export class FramescriptServices extends Module {
  private messageListeners = {
    notifyDocumentLoaded: this.notifyDocumentLoaded.bind(this),
  };

  constructor(
      parentLog: Common.ILog,
      private runtimeApi: typeof browser.runtime,

      private requestMemory: App.webRequest.IRequestMemory,
      private uriService: App.services.IUriService,
      private cachedSettings: App.storage.ICachedSettings,
  ) {
    super("app.framescripts.services", parentLog);
  }

  protected startupSelf() {
    this.runtimeApi.onMessage.addListener(this.onMessage.bind(this));
    return Promise.resolve();
  }

  private containsNonBlacklistedRequests(aRequests: RequestResult[]) {
    for (let i = 0, len = aRequests.length; i < len; i++) {
      if (!aRequests[i].isOnBlacklist()) {
        // This request has not been blocked by the blacklist
        return true;
      }
    }
    return false;
  }

  private notifyDocumentLoaded(
      aMessage: any,
      aSender: browser.runtime.MessageSender,
      aSendResponse: any,
  ) {
    const {documentURI} = aMessage;
    // The document URI could contain a "fragment" part.
    const originURI = this.uriService.getUriObject(documentURI).specIgnoringRef;

    const blockedURIs: any = {};

    if (this.cachedSettings.get("indicateBlockedObjects")) {
      const indicateBlacklisted =
          this.cachedSettings.get("indicateBlacklistedObjects");

      const rejectedRequests = this.requestMemory.requestSets.rejectedRequests.
          getOriginUri(originURI);
      // tslint:disable-next-line:forin
      for (const destBase in rejectedRequests) {
        // tslint:disable-next-line:forin
        for (const destIdent in rejectedRequests[destBase]) {
          // tslint:disable-next-line:forin
          for (const destUri in rejectedRequests[destBase][destIdent]) {
            // case 1: indicateBlacklisted == true
            //         ==> indicate the object has been blocked
            //
            // case 2: indicateBlacklisted == false
            // case 2a: all requests have been blocked because of a blacklist
            //          ==> do *not* indicate
            //
            // case 2b: at least one of the blocked (identical) requests
            //          has been blocked by a rule *other than* the blacklist
            //          ==> *do* indicate
            const requests = rejectedRequests[destBase][destIdent][destUri];
            if (indicateBlacklisted ||
                this.containsNonBlacklistedRequests(requests)) {
              blockedURIs[destUri] = blockedURIs[destUri] ||
                  {identifier: this.uriService.getIdentifier(destUri)};
            }
          }
        }
      }
    }

    // send the list of blocked URIs back to the frame script
    aSendResponse({blockedURIs});
  }

  private onMessage(
      aMessage: any,
      aSender: browser.runtime.MessageSender,
      aSendResponse: any,
  ) {
    if (typeof aMessage.type === "undefined") {
      return;
    }
    if (typeof (this.messageListeners as any)[aMessage.type] === "undefined") {
      return;
    }
    return (this.messageListeners as any)[aMessage.type].
        call(null, aMessage, aSender, aSendResponse);
  }
}
