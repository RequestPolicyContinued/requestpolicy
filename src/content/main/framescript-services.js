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

import {RequestProcessor} from "lib/request-processor";
import {DomainUtil} from "lib/utils/domains";
import {Prefs} from "models/prefs";

const initFunctions = [];

export var FramescriptServices = {
  init: function() {
    for (let fn of initFunctions) {
      fn();
    }
  }
};

// notifyDocumentLoaded

(function() {
  const messageListeners = {};

  function containsNonBlacklistedRequests(aRequests) {
    for (let i = 0, len = aRequests.length; i < len; i++) {
      if (!aRequests[i].isOnBlacklist()) {
        // This request has not been blocked by the blacklist
        return true;
      }
    }
    return false;
  }

  messageListeners.notifyDocumentLoaded = function(aMessage, aSender,
      aSendResponse) {
    const {documentURI} = aMessage;
    // The document URI could contain a "fragment" part.
    const originURI = DomainUtil.getUriObject(documentURI).specIgnoringRef;

    const blockedURIs = {};

    if (Prefs.get("indicateBlockedObjects")) {
      const indicateBlacklisted = Prefs.get("indicateBlacklistedObjects");

      const rejectedRequests = RequestProcessor._rejectedRequests.
          getOriginUri(originURI);
      for (let destBase in rejectedRequests) {
        for (let destIdent in rejectedRequests[destBase]) {
          for (let destUri in rejectedRequests[destBase][destIdent]) {
            // case 1: indicateBlacklisted == true
            //         ==> indicate the object has been blocked
            //
            // case 2: indicateBlacklisted == false
            // case 2a: all requests have been blocked because of a blacklist
            //          ==> do *not* indicate
            //
            // case 2b: at least one of the blocked (identical) requests has been
            //          blocked by a rule *other than* the blacklist
            //          ==> *do* indicate
            const requests = rejectedRequests[destBase][destIdent][destUri];
            if (indicateBlacklisted ||
                containsNonBlacklistedRequests(requests)) {
              blockedURIs[destUri] = blockedURIs[destUri] ||
                  {identifier: DomainUtil.getIdentifier(destUri)};
            }
          }
        }
      }
    }

    // send the list of blocked URIs back to the frame script
    aSendResponse({blockedURIs});
  };

  function onMessage(aMessage, aSender, aSendResponse) {
    if (typeof aMessage.type === "undefined") {
      return;
    }
    if (typeof messageListeners[aMessage.type] === "undefined") {
      return;
    }
    return messageListeners[aMessage.type].
        call(null, aMessage, aSender, aSendResponse);
  }

  initFunctions.push(() => {
    browser.runtime.onMessage.addListener(onMessage);
  });
}());
