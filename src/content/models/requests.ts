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

import {RequestSet} from "content/lib/request-set";
import * as DomainUtil from "content/lib/utils/domain-utils";
import {createListenersMap} from "content/lib/utils/listener-factories";
import {Log} from "content/models/log";

const log = Log.instance;

const logGettingSavedRequests = log.extend({
  enabledCondition: {type: "C", C: "LOG_GETTING_SAVED_REQUESTS"},
  level: "all",
  name: "getting saved requests",
});

// =============================================================================

const requestSets = {
  allowedRequests: new RequestSet(),
  rejectedRequests: new RequestSet(),
};

const {
  interfaces: eventTargets,
  listenersMap: eventListenersMap,
} = createListenersMap([
  "onRequest",
]);

// =============================================================================

/**
 * Remove all saved requests from a specific origin URI. Remove both
 * accepted and rejected requests.
 *
 * @param {string} uri The origin URI.
 */
function removeSavedRequestsByOriginURI(uri: string) {
  requestSets.allowedRequests.removeOriginUri(uri);
  requestSets.rejectedRequests.removeOriginUri(uri);
}

function notifyNewRequest({
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
    requestResult: any,
    unforbidable?: boolean,
    isInsert: boolean,
}) {
  if (isAllowed) {
    // We aren't recording the request so it doesn't show up in the menu, but we
    // want it to still show up in the request log.
    if (!unforbidable) {
      if (!isInsert) {
        // The destination URI may itself originate further requests.
        removeSavedRequestsByOriginURI(destUri);
      }
      requestSets.rejectedRequests.removeRequest(originUri, destUri);
      requestSets.allowedRequests.addRequest(originUri, destUri, requestResult);
    }
  } else {
    requestSets.rejectedRequests.addRequest(originUri, destUri, requestResult);
    requestSets.allowedRequests.removeRequest(originUri, destUri);
  }
  eventListenersMap.onRequest.emit({
    destUri,
    isAllowed,
    originUri,
    requestResult,
  });
}

function getRequestsHelper(
    currentlySelectedOrigin: string,
    allRequestsOnDocument: any,
    isAllowed: boolean,
) {
  const result = new RequestSet();
  const requests = allRequestsOnDocument.getAll();

  // We're assuming ident is fullIdent (LEVEL_SOP). We plan to remove base
  // domain and hostname levels.
  // tslint:disable-next-line prefer-const
  for (let originUri in requests) {
    if (DomainUtil.getBaseDomain(originUri) !== currentlySelectedOrigin) {
      // only return requests from the given base domain
      continue;
    }
    logGettingSavedRequests.log("test originUri: " + originUri);

    const originUriRequests = requests[originUri];
    // tslint:disable-next-line prefer-const forin
    for (let destBase in originUriRequests) {
      logGettingSavedRequests.log("test destBase: " + destBase);

      const destBaseRequests = originUriRequests[destBase];
      // tslint:disable-next-line prefer-const forin
      for (let destIdent in destBaseRequests) {
        logGettingSavedRequests.log("test destIdent: " + destIdent);

        const destIdentRequests = destBaseRequests[destIdent];
        // tslint:disable-next-line prefer-const forin
        for (let destUri in destIdentRequests) {
          logGettingSavedRequests.log("test destUri: " + destUri);

          const dest = destIdentRequests[destUri];
          // tslint:disable-next-line prefer-const
          for (let i in dest) {
            // TODO: This variable could have been created easily already in
            //       getAllRequestsInBrowser(). ==> rewrite RequestSet to
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
}

/* eslint-disable */

// function _getOtherOriginsHelperFromDOM(document, reqSet) {
//   var documentUri = DomainUtil
//       .stripFragment(document.documentURI);
//   log.log("Looking for other origins within DOM of "
//       + documentUri);
//   // TODO: Check other elements besides iframes and frames?
//   var frameTagTypes = {
//     "iframe" : null,
//     "frame" : null
//   };
//   for (var tagType in frameTagTypes) {
//     var iframes = document.getElementsByTagName(tagType);
//     for (var i = 0; i < iframes.length; i++) {
//       var child = iframes[i];
//       var childDocument = child.contentDocument;
//       // Flock's special home page is about:myworld. It has (i)frames in it
//       // that have no contentDocument. It's probably related to the fact that
//       // that is an xul page, but I have no reason to fully understand the
//       // problem in order to fix it.
//       if (!childDocument) {
//         continue;
//       }
//       var childUri = DomainUtil
//           .stripFragment(childDocument.documentURI);
//       if (childUri == "about:blank") {
//         // iframe empty or not loaded yet, or maybe blocked.
//         // childUri = child.src;
//         // If it's not loaded or blocked, it's not the origin for anything
//         // yet.
//         continue;
//       }
//       log.log("Found DOM child " + tagType
//           + " with src <" + childUri + "> in document <" +
//           documentUri + ">");
//       //var childUriIdent = DomainUtil.getIdentifier(childUri,
//       //    DomainUtil.LEVEL_SOP);
//       // if (!origins[childUriIdent]) {
//       //   origins[childUriIdent] = {};
//       // }
//       // origins[childUriIdent][childUri] = true;
//       reqSet.addRequest(documentUri, childUri);
//       _getOtherOriginsHelperFromDOM(childDocument, reqSet);
//     }
//   }
// },

/* eslint-enable */

function _addRecursivelyAllRequestsFromURI(
    originURI: string,
    reqSet: any,
    checkedOrigins: {[key: string]: boolean},
) {
  logGettingSavedRequests.log(
      "Looking for other origins within allowed requests from " +
      originURI);

  if (!checkedOrigins[originURI]) {
    // this "if" is needed for the first call of this function.
    checkedOrigins[originURI] = true;
  }
  _addAllDeniedRequestsFromURI(originURI, reqSet);
  const allowedRequests = requestSets.allowedRequests.getOriginUri(originURI);
  if (allowedRequests) {
    // tslint:disable-next-line prefer-const forin
    for (let destBase in allowedRequests) {
      // tslint:disable-next-line prefer-const forin
      for (let destIdent in allowedRequests[destBase]) {
        // tslint:disable-next-line prefer-const forin
        for (let destURI in allowedRequests[destBase][destIdent]) {
          logGettingSavedRequests.log(
              "Found allowed request to <" + destURI + "> " +
              "from <" + originURI + ">");
          reqSet.addRequest(originURI, destURI,
                            allowedRequests[destBase][destIdent][destURI]);

          if (!checkedOrigins[destURI]) {
            // only check the destination URI if it hasn't been checked yet.
            checkedOrigins[destURI] = true;

            _addRecursivelyAllRequestsFromURI(destURI, reqSet,
                checkedOrigins);
          }
        }
      }
    }
  }
}

function _addAllDeniedRequestsFromURI(originUri: string, reqSet: any) {
  logGettingSavedRequests.log(
      "Looking for other origins within denied requests from " + originUri);

  const requests = requestSets.rejectedRequests.getOriginUri(originUri);
  if (requests) {
    // tslint:disable-next-line prefer-const forin
    for (let destBase in requests) {
      // tslint:disable-next-line prefer-const forin
      for (let destIdent in requests[destBase]) {
        // tslint:disable-next-line prefer-const forin
        for (let destUri in requests[destBase][destIdent]) {
          logGettingSavedRequests.log(
              "Found denied request to <" + destUri + "> " +
              `from <${originUri}>`);

          reqSet.addRequest(originUri, destUri,
              requests[destBase][destIdent][destUri]);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// public functions
// ---------------------------------------------------------------------------

function getDeniedRequests(
    currentlySelectedOrigin: string,
    allRequestsOnDocument: any,
) {
  logGettingSavedRequests.log("## getDeniedRequests");
  return getRequestsHelper(currentlySelectedOrigin, allRequestsOnDocument,
      false);
}

function getAllowedRequests(
    currentlySelectedOrigin: string,
    allRequestsOnDocument: any,
) {
  logGettingSavedRequests.log("## getAllowedRequests");
  return getRequestsHelper(currentlySelectedOrigin, allRequestsOnDocument,
      true);
}

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
 * @param {Browser} browser
 * @return {RequestSet}
 */
function getAllRequestsInBrowser(browser: any) {
  // var origins = {};
  const reqSet = new RequestSet();

  // If we get these from the DOM, then we won't know the relevant
  // rules that were involved with allowing/denying the request.
  // Maybe just look up the allowed/blocked requests in the
  // main allowed/denied request sets before adding them.
  // _getOtherOriginsHelperFromDOM(document, reqSet);

  const uri = DomainUtil.stripFragment(browser.currentURI.spec);
  _addRecursivelyAllRequestsFromURI(uri, reqSet, {});
  return reqSet;
}

export const Requests = {
  _removeSavedRequestsByOriginURI: removeSavedRequestsByOriginURI,
  _requestSets: requestSets,
  getAllRequestsInBrowser,
  getAllowedRequests,
  getDeniedRequests,
  notifyNewRequest,
  onRequest: eventTargets.onRequest,
};
