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

import {Request, NormalRequest, RedirectRequest} from "lib/request";
import {
  RequestReason,
  RequestResult,
} from "lib/request-result";
import {MainEnvironment} from "lib/environment";
import * as Utils from "lib/utils/misc-utils";
import {CompatibilityRules} from "models/compatibility-rules";
import {
  AllowedRedirectsReverse,
  ClickedLinks,
  ClickedLinksReverse,
  FaviconRequests,
  MappedDestinations,
  SubmittedForms,
  SubmittedFormsReverse,
  UserAllowedRedirects,
} from "models/metadata";
import {Requests} from "models/requests";

import {log} from "app/log";
import {
  getRequestHeaderFromHttpChannel,
  queryInterface,
} from "lib/utils/try-catch-utils";
import {rp} from "app/app.background";
import { XPCOM } from "bootstrap/api/interfaces";

declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Cr: XPCOM.nsXPCComponents_Results;

const uriService = rp.services.uri;
const cachedSettings = rp.storage.cachedSettings!;

const logRequests = log.extend({
  enabledCondition: {type: "C", C: "LOG_REQUESTS"},
  level: "all",
  name: "Requests",
});

// =============================================================================
// constants
// =============================================================================

const CP_OK = Ci.nsIContentPolicy.ACCEPT;
const CP_REJECT = Ci.nsIContentPolicy.REJECT_SERVER;

// A value intended to not conflict with aExtra passed to shouldLoad() by any
// other callers. Was chosen randomly.
const CP_MAPPEDDESTINATION = 0x178c40bf;

const HTTPS_EVERYWHERE_REWRITE_TOPIC = "https-everywhere-uri-rewrite";

// =============================================================================
// RequestProcessor
// =============================================================================

// ---------------------------------------------------------------------------
// private properties
// ---------------------------------------------------------------------------

/**
 * Number of elapsed milliseconds from the time of the last shouldLoad() call
 * at which the cached results of the last shouldLoad() call are discarded.
 *
 * @type {number}
 */
let lastShouldLoadCheckTimeout = 200;

// Calls to shouldLoad appear to be repeated, so successive repeated calls and
// their result (accept or reject) are tracked to avoid duplicate processing
// and duplicate logging.
/**
 * Object that caches the last shouldLoad
 * @type {Object}
 */
let lastShouldLoadCheck: {
  "origin": string | undefined | null,
  "destination": string | null,
  "time": number,
  "result": number | null,
} = {
  "origin": null,
  "destination": null,
  "time": 0,
  "result": null,
};

let historyRequests: any = {};

// ---------------------------------------------------------------------------
// private functions
// ---------------------------------------------------------------------------

// We always call this from shouldLoad to reject a request.
function reject(reason: string, request: NormalRequest) {
  /* eslint-disable no-param-reassign */
  logRequests.log(`** BLOCKED ** reason: ${reason}. ` +
      `${request.detailsToString()}`);

  if (cachedSettings.alias.isBlockingDisabled()) {
    return CP_OK;
  }

  if (request.aContext) {
    // fixme: `rpcontinuedBlocked` is probably not needed anymore.
    //        There's now `rpcontinuedIdentified`.
    request.aContext.rpcontinuedBlocked = true;
  }

  cacheShouldLoadResult(CP_REJECT, request.originURI, request.destURI);
  Requests.notifyNewRequest({
    isAllowed: false,
    isInsert: false,
    requestResult: request.requestResult,
    originUri: request.originURI!,
    destUri: request.destURI,
  });

  if (Ci.nsIContentPolicy.TYPE_DOCUMENT === request.aContentType) {
    // This was a blocked top-level document request. This may be due to
    // a blocked attempt by javascript to set the document location.

    let browser = request.getBrowser();
    let window = request.getChromeWindow();

    if (!browser || !window || typeof window.rpcontinued === "undefined") {
      log.warn("The user could not be notified " +
          "about the blocked top-level document request!");
    } else {
      window.rpcontinued.overlay.observeBlockedTopLevelDocRequest(
          browser, request.originURI, request.destURIWithRef
      );
    }
  }

  return CP_REJECT;
}

// We only call this from shouldLoad when the request was a remote request
// initiated by the content of a page. this is partly for efficiency. in other
// cases we just return CP_OK rather than return this function which
// ultimately returns CP_OK. Fourth param, "unforbidable", is set to true if
// this request shouldn't be recorded as an allowed request.
function accept(
    reason: string,
    request: NormalRequest,
    unforbidable?: boolean,
): number {
  logRequests.log(`** ALLOWED ** reason: ${reason}. ` +
      `${request.detailsToString()}`);

  cacheShouldLoadResult(CP_OK, request.originURI, request.destURI);
  Requests.notifyNewRequest({
    isAllowed: true,
    isInsert: false,
    requestResult: request.requestResult,
    originUri: request.originURI!,
    destUri: request.destURI,
    unforbidable,
  });

  return CP_OK;
}

function cacheShouldLoadResult(
    result: number,
    originUri: string | undefined,
    destUri: string,
) {
  const date = new Date();
  lastShouldLoadCheck.time = date.getTime();
  lastShouldLoadCheck.destination = destUri;
  lastShouldLoadCheck.origin = originUri;
  lastShouldLoadCheck.result = result;
}

/**
 * Determines if a request is a duplicate of the last call to shouldLoad().
 * If it is, the cached result in lastShouldLoadCheck.result can be used.
 * Using this simple cache of the last call to shouldLoad() keeps duplicates
 * out of log data.
 *
 * Duplicate shouldLoad() calls can be produced for example by creating a
 * page containing many <img> with the same image (same `src`).
 */
function isDuplicateRequest(request: Request): boolean {
  if (lastShouldLoadCheck.origin === request.originURI &&
      lastShouldLoadCheck.destination === request.destURI) {
    const date = new Date();
    if (date.getTime() - lastShouldLoadCheck.time <
        lastShouldLoadCheckTimeout) {
      logRequests.log(
          `Using cached shouldLoad() result of ${lastShouldLoadCheck.result} ` +
          `for request to <${request.destURI}> from <${request.originURI}>.`
      );
      return true;
    } else {
      logRequests.log(
          `shouldLoad() cache expired for result of ` +
          `${lastShouldLoadCheck.result} for request to ` +
          `<${request.destURI}> from <${request.originURI}>.`
      );
    }
  }
  return false;
}

function getDomNodeFromRequestContext(context: any) {
  const result = queryInterface(context, Ci.nsIDOMNode);
  if (!result.error) {
    return result.value;
  }
  const e = result.error;
  if (e.result !== Cr.NS_ERROR_NO_INTERFACE) {
    throw e;
  }
}

// ---------------------------------------------------------------------------
// public functions
// ---------------------------------------------------------------------------

export function process(request: NormalRequest): number {
  // uncomment for debugging:
  // log.log("request: " +
  //              (request.aRequestOrigin ? request.aRequestOrigin.spec :
  //               "<unknown>") +
  //              " -->  "+request.aContentLocation.spec);
  // log.dir(request.aRequestOrigin);
  // log.dir(request.aContentLocation);
  try {
    if (request.isInternal()) {
      logRequests.log(`Allowing a request that seems to be internal. ` +
          `Origin: ${request.originURI}, Dest: ${request.destURI}`);
      return CP_OK;
    }

    let originURI: string = request.originURI!;
    let destURI = request.destURI;

    if (request.aRequestOrigin.scheme === "moz-nullprincipal") {
      // Before RP has been forked, there was a hack: in case of a request
      // with the origin's scheme being 'moz-nullprincipal', RequestPolicy
      // used the documentURI of the request's context as the "real" origin
      // URI.
      //   (Note: RP assuemed that the context is always a document, but this
      //    is in fact not always true.)
      // The reason for using the context's documentURI was, according to
      // @jsamuel's comment, that the request's origin was not always the
      // correct URI; according to @jsamuel this was fixed in Firefox 16.
      // Originally he wrote:
      //   >  "[Since Fx 16] we should be able to count on the referrer
      //   >  (aRequestOrigin) being set to something besides
      //   >  moz-nullprincipal when there is a referrer."
      // TODO: check whether the requests that are allowed by this case are
      //       *definitely* internal request. Is it possible to determine
      //       where this request originally came from?
      //
      // ### Links:
      // * nsIPrincipal:
      //   -> https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrincipal
      //
      // * discussion about RequestPolicy with regard to detecting that
      //   something has been entered in the url-bar -- it's the Mozilla Bug
      //   about adding `aRequestPrincipal` to `shouldLoad()` and it's
      //   milestone was Firefox 16.
      //   -> https://bugzilla.mozilla.org/show_bug.cgi?id=767134#c15
      if (request.aRequestPrincipal) {
        logRequests.log(
            `Allowing request that appears to be a URL entered in the ` +
            `location bar or some other good explanation: ${destURI}`
        );
        Requests._removeSavedRequestsByOriginURI(destURI);
        return CP_OK;
      }
    }

    if (request.aRequestOrigin.scheme === "view-source") {
      let newOriginURI = originURI.split(":").slice(1).join(":");
      logRequests.log(
          `Considering view-source origin <${originURI}> ` +
          `to be origin <${newOriginURI}>`
      );
      originURI = newOriginURI;
      request.setOriginURI(originURI);
    }

    if (request.aContentLocation.scheme === "view-source") {
      const newDestURI = destURI.split(":").slice(1).join(":");
      if (newDestURI.indexOf("data:text/html") === 0) {
        // "View Selection Source" has been clicked
        logRequests.log(
            "Allowing \"data:text/html\" view-source destination" +
            " (Selection Source)"
        );
        return CP_OK;
      } else {
        logRequests.log(
            `Considering view-source destination <${destURI}> ` +
            `to be destination <${newDestURI}>`
        );
        destURI = newDestURI;
        request.setDestURI(destURI);
      }
    }

    if (originURI === "about:blank" && request.aContext) {
      const domNode = getDomNodeFromRequestContext(request.aContext);
      if (domNode && domNode.nodeType === Ci.nsIDOMNode.DOCUMENT_NODE) {
        let newOriginURI;
        if (request.aContext.documentURI &&
            request.aContext.documentURI !== "about:blank") {
          newOriginURI = request.aContext.documentURI;
        } else if (request.aContext.ownerDocument &&
            request.aContext.ownerDocument.documentURI &&
            request.aContext.ownerDocument.documentURI !== "about:blank") {
          newOriginURI = request.aContext.ownerDocument.documentURI;
        }
        if (newOriginURI) {
          newOriginURI = uriService.stripFragment(newOriginURI);
          log.log(`Considering origin <${originURI}> ` +
              `to be origin <${newOriginURI}>`);
          originURI = newOriginURI;
          request.setOriginURI(originURI);
        }
      }
    }

    if (isDuplicateRequest(request)) {
      return lastShouldLoadCheck.result!;
    }

    // Sometimes, clicking a link to a fragment will result in a request
    // where the origin is the same as the destination, but none of the
    // additional content of the page is again requested. The result is that
    // nothing ends up showing for blocked or allowed destinations because
    // all of that data was cleared due to the new request.
    // Example to test with: Click on "expand all" at
    // http://code.google.com/p/SOME_PROJECT/source/detail?r=SOME_REVISION
    if (originURI === destURI) {
      logRequests.log(
          `Allowing (but not recording) request ` +
          `where origin is the same as the destination: ${originURI}`
      );
      return CP_OK;
    }

    if (request.aContext) {
      const domNode = getDomNodeFromRequestContext(request.aContext);
      if (domNode && domNode.nodeName === "LINK" &&
          (domNode.rel === "icon" || domNode.rel === "shortcut icon")) {
        FaviconRequests[destURI] = true;
      }
    }

    // Note: If changing the logic here, also make necessary changes to
    // isAllowedRedirect).

    // Checking for link clicks, form submissions, and history requests
    // should be done before other checks. Specifically, when link clicks
    // were done after allowed-origin and other checks, then links that
    // were allowed due to other checks would end up recorded in the origin
    // url's allowed requests, and woud then show up on one tab if link
    // was opened in a new tab but that link would have been allowed
    // regardless of the link click. The original tab would then show it
    // in its menu.
    if (ClickedLinks[originURI] &&
        ClickedLinks[originURI][destURI]) {
      // Don't delete the clickedLinks item. We need it for if the user
      // goes back/forward through their history.
      // delete ClickedLinks[originURI][destURI];

      // We used to have this not be recorded so that it wouldn't cause us
      // to forget blocked/allowed requests. However, when a policy change
      // causes a page refresh after a link click, it looks like a link
      // click again and so if we don't forget the previous blocked/allowed
      // requests, the menu becomes inaccurate. Now the question is: what
      // are we breaking by clearing the blocked/allowed requests here?
      request.requestResult = new RequestResult(true,
          RequestReason.LinkClick);
      return accept("User-initiated request by link click", request);
    } else if (SubmittedForms[originURI] &&
        SubmittedForms[originURI][destURI.split("?")[0]]) {
      // Note: we dropped the query string from the destURI because form GET
      // requests will have that added on here but the original action of
      // the form may not have had it.
      // Don't delete the clickedLinks item. We need it for if the user
      // goes back/forward through their history.
      // delete SubmittedForms[originURI][destURI.split("?")[0]];

      // See the note above for link clicks and forgetting blocked/allowed
      // requests on refresh. I haven't tested if it's the same for forms
      // but it should be so we're making the same change here.
      request.requestResult = new RequestResult(true,
          RequestReason.FormSubmission);
      return accept("User-initiated request by form submission", request);
    } else if (historyRequests[destURI]) {
      // When the user goes back and forward in their history, a request for
      // the url comes through but is not followed by requests for any of
      // the page's content. Therefore, we make sure that our cache of
      // blocked requests isn't removed in this case.
      delete historyRequests[destURI];
      request.requestResult = new RequestResult(true,
          RequestReason.HistoryRequest);
      return accept("History request", request, true);
    } else if (UserAllowedRedirects[originURI] &&
        UserAllowedRedirects[originURI][destURI]) {
      // shouldLoad is called by location.href in overlay.js as of Fx
      // 3.7a5pre and SeaMonkey 2.1a.
      request.requestResult = new RequestResult(true,
          RequestReason.UserAllowedRedirect);
      return accept("User-allowed redirect", request, true);
    }

    let originHost = uriService.getHostByUriObj(request.aRequestOrigin);

    if (request.aRequestOrigin.scheme === "chrome") {
      if (originHost === "browser") {
        // "browser" origin shows up for favicon.ico and an address entered
        // in address bar.
        request.requestResult = new RequestResult(true,
            RequestReason.UserAction);
        return accept(
            "User action (e.g. address entered in address bar) " +
            "or other good explanation (e.g. new window/tab opened)",
            request
        );
      } else {
        // TODO: It seems sketchy to allow all requests from chrome. If I
        // had to put my money on a possible bug (in terms of not blocking
        // requests that should be), I'd put it here. Doing this, however,
        // saves a lot of blocking of legitimate requests from extensions
        // that originate from their xul files. If you're reading this and
        // you know of a way to use this to evade RequestPolicy, please let
        // me know, I will be very grateful.
        request.requestResult = new RequestResult(true,
            RequestReason.UserAction);
        return accept(
            "User action (e.g. address entered in address bar) " +
            "or other good explanation (e.g. new window/tab opened)",
            request
        );
      }
    }

    // This is mostly here for the case of popup windows where the user has
    // allowed popups for the domain. In that case, the window.open() call
    // that made the popup isn't calling the wrapped version of
    // window.open() and we can't find a better way to register the source
    // and destination before the request is made. This should be able to be
    // removed if we can find a better solution for the allowed popup case.
    if (request.aContext) {
      const domNode = getDomNodeFromRequestContext(request.aContext);
      if (domNode && domNode.nodeName === "xul:browser" &&
          domNode.currentURI && domNode.currentURI.spec === "about:blank") {
        request.requestResult = new RequestResult(true,
            RequestReason.NewWindow);
        return accept("New window (should probably only be an allowed " +
            "popup's initial request)", request, true);
      }
    }

    // // XMLHttpRequests made within chrome's context have these origins.
    // // Greasemonkey uses such a method to provide their cross-site xhr.
    // if (originURI === "resource://gre/res/hiddenWindow.html" ||
    //     originURI === "resource://gre-resources/hiddenWindow.html") {
    // }

    // Now that we have blacklists, a user could prevent themselves from
    // being able to reload a page by blocking requests from * to the
    // destination page. As a simple hack around this, for now we'll always
    // allow request to the same origin. It would be nice to have a a better
    // solution but I'm not sure what that solution is.
    const originIdent = uriService.getIdentifier(originURI);
    const destIdent = uriService.getIdentifier(destURI);
    if (originIdent === destIdent &&
        originIdent !== null && destIdent !== null) {
      request.requestResult = new RequestResult(true,
          RequestReason.IdenticalIdentifier);
      return accept(
          `Allowing request where origin protocol, host, and port are the` +
          ` same as the destination: ${originIdent}`, request
      );
    }

    request.requestResult = rp.policy.checkRequestAgainstUserRules(
        request.aRequestOrigin, request.aContentLocation
    );
    // for (let matchedDenyRule of request.requestResult.matchedDenyRules) {
    //   log.log("Matched deny rules");
    //   log.dir(matchedDenyRule);
    // }
    // for (let matchedAllowRule of request.requestResult.matchedAllowRules) {
    //   log.log("Matched allow rules");
    //   log.dir(matchedAllowRule);
    // }

    // If there are both allow and deny rules, then fall back on the default
    // policy. I believe this is effectively the same as giving precedence
    // to allow rules when in default allow mode and giving precedence to
    // deny rules when in default deny mode. It's just a different way of
    // expressing the same logic. Now, whether that's the right logic we
    // should be using to solve the problem of rule precedence and support
    // for fine-grained rules overriding course-grained ones is a different
    // question.
    if (request.requestResult.allowRulesExist() &&
        request.requestResult.denyRulesExist()) {
      let {conflictCanBeResolved, shouldAllow,
      } = request.requestResult.resolveConflict();
      if (conflictCanBeResolved) {
        request.requestResult.resultReason = RequestReason.UserPolicy;
        request.requestResult.isAllowed = shouldAllow;
        if (shouldAllow) {
          return accept("Allowed by user policy", request);
        } else {
          return reject("Blocked by user policy", request);
        }
      }
      request.requestResult.resultReason =
          RequestReason.DefaultPolicyInconsistentRules;
      if (cachedSettings.alias.isDefaultAllow()) {
        request.requestResult.isAllowed = true;
        return accept("User policy indicates both allow and block. " +
            "Using default allow policy", request);
      } else {
        request.requestResult.isAllowed = false;
        return reject("User policy indicates both allow and block. " +
            "Using default block policy", request);
      }
    }
    if (request.requestResult.allowRulesExist()) {
      request.requestResult.resultReason = RequestReason.UserPolicy;
      request.requestResult.isAllowed = true;
      return accept("Allowed by user policy", request);
    }
    if (request.requestResult.denyRulesExist()) {
      request.requestResult.resultReason = RequestReason.UserPolicy;
      request.requestResult.isAllowed = false;
      return reject("Blocked by user policy", request);
    }

    request.requestResult = rp.policy.
        checkRequestAgainstSubscriptionRules(request.aRequestOrigin,
            request.aContentLocation);
    // for (let matchedDenyRule of request.requestResult.matchedDenyRules) {
    //   log.log("Matched deny rules");
    //   log.dir(matchedDenyRule);
    // }
    // for (let matchedAllowRule of request.requestResult.matchedAllowRules) {
    //   log.log("Matched allow rules");
    //   log.dir(matchedAllowRule);
    // }
    if (request.requestResult.allowRulesExist() &&
        request.requestResult.denyRulesExist()) {
      let {conflictCanBeResolved, shouldAllow,
      } = request.requestResult.resolveConflict();
      if (conflictCanBeResolved) {
        request.requestResult.resultReason =
            RequestReason.SubscriptionPolicy;
        request.requestResult.isAllowed = shouldAllow;
        if (shouldAllow) {
          return accept("Allowed by subscription policy", request);
        } else {
          return reject("Blocked by subscription policy", request);
        }
      }
      request.requestResult.resultReason =
          RequestReason.DefaultPolicyInconsistentRules;
      if (cachedSettings.alias.isDefaultAllow()) {
        request.requestResult.isAllowed = true;
        return accept(
            "Subscription rules indicate both allow and block. " +
            "Using default allow policy", request
        );
      } else {
        request.requestResult.isAllowed = false;
        return reject("Subscription rules indicate both allow and block. " +
            "Using default block policy", request);
      }
    }
    if (request.requestResult.denyRulesExist()) {
      request.requestResult.resultReason =
          RequestReason.SubscriptionPolicy;
      request.requestResult.isAllowed = false;
      return reject("Blocked by subscription policy", request);
    }
    if (request.requestResult.allowRulesExist()) {
      request.requestResult.resultReason =
          RequestReason.SubscriptionPolicy;
      request.requestResult.isAllowed = true;
      return accept("Allowed by subscription policy", request);
    }

    for (let rule of CompatibilityRules) {
      let allowOrigin = rule.origin ? originURI.startsWith(rule.origin) :
        true;
      let allowDest = rule.dest ? destURI.startsWith(rule.dest) : true;
      if (allowOrigin && allowDest) {
        request.requestResult = new RequestResult(true,
            RequestReason.Compatibility);
        return accept(
            `Extension/application compatibility rule matched [${rule.info}]`,
            request, true
        );
      }
    }

    if (request.aContext) {
      let info = CompatibilityRules.checkBaseUriWhitelist(
          request.aContext.baseURI
      );
      if (info.isWhitelisted) {
        request.requestResult = new RequestResult(true,
            RequestReason.Compatibility);
        return accept(
            `Extension/application compatibility rule matched ` +
            `[${info.addonNames}]`, request, true
        );
      }
    }

    // If the destination has a mapping (i.e. it was originally a different
    // destination but was changed into the current one), accept this
    // request if the original destination would have been accepted.
    // Check aExtra against CP_MAPPEDDESTINATION to stop further recursion.
    if (request.aExtra !== CP_MAPPEDDESTINATION &&
        MappedDestinations[destURI]) {
      for (let mappedDest in MappedDestinations[destURI]) {
        const mappedDestUriObj =
            MappedDestinations[destURI][mappedDest];
        logRequests.log(`Checking mapped destination: ${mappedDest}`);
        let mappedResult = process(new NormalRequest(
            request.aContentType, mappedDestUriObj, request.aRequestOrigin,
            request.aContext, request.aMimeTypeGuess, CP_MAPPEDDESTINATION,
            undefined,
        ));
        if (mappedResult === CP_OK) {
          return CP_OK;
        }
      }
    }

    request.requestResult = request.checkByDefaultPolicy();
    if (request.requestResult.isAllowed) {
      return accept("Allowed by default policy", request);
    } else {
      // We didn't match any of the conditions in which to allow the request,
      // so reject it.
      return request.aExtra === CP_MAPPEDDESTINATION ?
        CP_REJECT :
        reject("Denied by default policy", request);
    }
  } catch (e) {
    log.error("Fatal Error:", e);
    if (cachedSettings.alias.isBlockingDisabled()) {
      log.warn("Allowing request due to internal error.");
      return CP_OK;
    }
    log.warn("Rejecting request due to internal error.");
    return CP_REJECT;
  }
}

// RequestProcessor.finishProcessing = function(request, result) {
//   request.shouldLoadResult = result;
// };

/**
 * Called as a http request is made. The channel is available to allow you to
 * modify headers and such.
 *
 * Currently this just looks for prefetch requests that are getting through
 * which we currently can't stop.
 */
let examineHttpRequest = function(aSubject: XPCOM.nsISupports) {
  const httpChannel =
      aSubject.QueryInterface<XPCOM.nsIHttpChannel>(Ci.nsIHttpChannel);
  const result = getRequestHeaderFromHttpChannel(httpChannel, "X-moz");
  // Determine if prefetch requests are slipping through.
  if (result.value === "prefetch") {
    // Seems to be too late to block it at this point. Calling the
    // cancel(status) method didn't stop it.
    log.warn(
        `Discovered prefetch request being sent to: ${httpChannel.name}`
    );
  }
};

MainEnvironment.obMan.observe(["http-on-modify-request"],
    examineHttpRequest);

export function registerHistoryRequest(destinationUrl: string) {
  destinationUrl = uriService.ensureUriHasPath(
      uriService.stripFragment(destinationUrl)
  );
  historyRequests[destinationUrl] = true;
  log.info(`History item requested: <${destinationUrl}>.`);
}

export function registerFormSubmitted(originUrl: string, destinationUrl: string) {
  originUrl = uriService.ensureUriHasPath(
      uriService.stripFragment(originUrl)
  );
  destinationUrl = uriService.ensureUriHasPath(
      uriService.stripFragment(destinationUrl)
  );

  log.info(
      `Form submitted from <${originUrl}> to <${destinationUrl}>.`
  );

  // Drop the query string from the destination url because form GET requests
  // will end up with a query string on them when shouldLoad is called, so
  // we'll need to be dropping the query string there.
  destinationUrl = destinationUrl.split("?")[0];

  if (SubmittedForms[originUrl] === undefined) {
    SubmittedForms[originUrl] = {};
  }
  if (SubmittedForms[originUrl][destinationUrl] === undefined) {
    // TODO: See timestamp note for registerLinkClicked.
    SubmittedForms[originUrl][destinationUrl] = true;
  }

  // Keep track of a destination-indexed map, as well.
  if (SubmittedFormsReverse[destinationUrl] === undefined) {
    SubmittedFormsReverse[destinationUrl] = {};
  }
  if (SubmittedFormsReverse[destinationUrl][originUrl] === undefined) {
    // TODO: See timestamp note for registerLinkClicked.
    SubmittedFormsReverse[destinationUrl][originUrl] = true;
  }
}

export function registerLinkClicked(
    originUrl: string,
    destinationUrl: string,
) {
  originUrl = uriService.ensureUriHasPath(
      uriService.stripFragment(originUrl)
  );
  destinationUrl = uriService.ensureUriHasPath(
      uriService.stripFragment(destinationUrl)
  );

  log.info(
      `Link clicked from <${originUrl}> to <${destinationUrl}>.`
  );

  if (ClickedLinks[originUrl] === undefined) {
    ClickedLinks[originUrl] = {};
  }
  if (ClickedLinks[originUrl][destinationUrl] === undefined) {
    // TODO: Possibly set the value to a timestamp that can be used elsewhere
    // to determine if this is a recent click. This is probably necessary as
    // multiple calls to shouldLoad get made and we need a way to allow
    // multiple in a short window of time. Alternately, as it seems to always
    // be in order (repeats are always the same as the last), the last one
    // could be tracked and always allowed (or allowed within a small period
    // of time). This would have the advantage that we could delete items from
    // the clickedLinks object. One of these approaches would also reduce log
    // clutter, which would be good.
    ClickedLinks[originUrl][destinationUrl] = true;
  }

  // Keep track of a destination-indexed map, as well.
  if (ClickedLinksReverse[destinationUrl] === undefined) {
    ClickedLinksReverse[destinationUrl] = {};
  }
  if (ClickedLinksReverse[destinationUrl][originUrl] === undefined) {
    // TODO: Possibly set the value to a timestamp, as described above.
    ClickedLinksReverse[destinationUrl][originUrl] = true;
  }
}

export function registerAllowedRedirect(
    originUrl: string,
    destinationUrl: string,
) {
  originUrl = uriService.ensureUriHasPath(
      uriService.stripFragment(originUrl)
  );
  destinationUrl = uriService.ensureUriHasPath(
      uriService.stripFragment(destinationUrl)
  );

  log.info(`User-allowed redirect from <${originUrl}> to <${destinationUrl}>.`);

  if (UserAllowedRedirects[originUrl] === undefined) {
    UserAllowedRedirects[originUrl] = {};
  }
  if (UserAllowedRedirects[originUrl][destinationUrl] === undefined) {
    UserAllowedRedirects[originUrl][destinationUrl] = true;
  }
}

// =============================================================================
// RequestProcessor (redirections part)
// =============================================================================

MainEnvironment.obMan.observe(
    [HTTPS_EVERYWHERE_REWRITE_TOPIC],
    function(subject: XPCOM.nsISupports, topic: string, data: string) {
      handleHttpsEverywhereUriRewrite(subject as any, data);
    }
);

function mapDestinations(
    origDestUri: string,
    newDestUri: string,
) {
  origDestUri = uriService.stripFragment(origDestUri);
  newDestUri = uriService.stripFragment(newDestUri);
  log.info(
      `Mapping destination <${origDestUri}> to <${newDestUri}>.`
  );
  if (!MappedDestinations[newDestUri]) {
    MappedDestinations[newDestUri] = {};
  }
  MappedDestinations[newDestUri][origDestUri] =
      uriService.getUriObject(origDestUri);
}

/**
 * Handles observer notifications sent by the HTTPS Everywhere extension
 * that inform us of URIs that extension has rewritten.
 */
function handleHttpsEverywhereUriRewrite(
    oldURI: XPCOM.nsIURI,
    newSpec: string,
) {
  oldURI = oldURI.QueryInterface(Ci.nsIURI);
  mapDestinations(oldURI.spec, newSpec);
}

function checkRedirect(request: Request) {
  // TODO: Find a way to get rid of repitition of code between this and
  // shouldLoad().

  // Note: If changing the logic here, also make necessary changes to
  // shouldLoad().

  // This is not including link clicks, form submissions, and user-allowed
  // redirects.

  const originURI = request.originURI!;
  const destURI = request.destURI;

  const originURIObj = uriService.getUriObject(originURI);
  const destURIObj = uriService.getUriObject(destURI);

  {
    let result = rp.policy.checkRequestAgainstUserRules(originURIObj,
        destURIObj);
    if (result.denyRulesExist() && result.allowRulesExist()) {
      let {conflictCanBeResolved, shouldAllow} = result.resolveConflict();
      result.isAllowed = conflictCanBeResolved ? shouldAllow :
        cachedSettings.alias.isDefaultAllow();
      return result;
    }
    if (result.denyRulesExist()) {
      result.isAllowed = false;
      return result;
    }
    if (result.allowRulesExist()) {
      result.isAllowed = true;
      return result;
    }
  }

  {
    let result = rp.policy.checkRequestAgainstSubscriptionRules(
        originURIObj, destURIObj
    );
    if (result.denyRulesExist() && result.allowRulesExist()) {
      let {conflictCanBeResolved, shouldAllow} = result.resolveConflict();
      result.isAllowed = conflictCanBeResolved ? shouldAllow :
        cachedSettings.alias.isDefaultAllow();
      return result;
    }
    if (result.denyRulesExist()) {
      result.isAllowed = false;
      return result;
    }
    if (result.allowRulesExist()) {
      result.isAllowed = true;
      return result;
    }
  }

  // fixme: "//example.com/path" is also a valid relative URL
  if (destURI[0] && destURI[0] === "/" || destURI.indexOf(":") === -1) {
    // Redirect is to a relative url.
    // ==> allow.
    return new RequestResult(true, RequestReason.RelativeUrl);
  }

  for (let rule of CompatibilityRules) {
    let allowOrigin = rule.origin ? originURI.startsWith(rule.origin) : true;
    let allowDest = rule.dest ? destURI.startsWith(rule.dest) : true;
    if (allowOrigin && allowDest) {
      return new RequestResult(true, RequestReason.Compatibility);
    }
  }

  let result = request.checkByDefaultPolicy();
  return result;
}

export function isAllowedRedirect(originURI: string, destURI: string) {
  const request = new Request(originURI, destURI);
  return true === checkRedirect(request).isAllowed;
}

export function processUrlRedirection(request: RedirectRequest) {
  // Currently, if a user clicks a link to download a file and that link
  // redirects and is subsequently blocked, the user will see the blocked
  // destination in the menu. However, after they have allowed it from
  // the menu and attempted the download again, they won't see the allowed
  // request in the menu. Fixing that might be a pain and also runs the
  // risk of making the menu cluttered and confusing with destinations of
  // followed links from the current page.

  // TODO: Make user aware of blocked headers so they can allow them if
  // desired.

  // Check for internal redirections. For example, the add-on
  // "Decentraleyes" redirects external resources like jQuery
  // to a "data" URI.
  if (request.isInternal()) {
    logRequests.log(
        `Allowing a redirection that seems to be internal. ` +
        `Origin: ${request.originURI}, Dest: ${request.destURI}`
    );
    return CP_OK;
  }

  let originURI = request.originURI!;
  let destURI = request.destURI;

  // Allow redirects of requests from privileged code.
  // FIXME: should the check instead be ' === false' in case the
  //        return value is `null`? See also #18.
  if (!isContentRequest(request)) {
    // However, favicon requests that are redirected appear as non-content
    // requests. So, check if the original request was for a favicon.
    let originPath = request.originUriObj.path;
    // We always have to check "/favicon.ico" because Firefox will use this
    // as a default path and that request won't pass through shouldLoad().
    if (originPath === "/favicon.ico" ||
        FaviconRequests[originURI]) {
      // If the redirected request is allowed, we need to know that was a
      // favicon request in case it is further redirected.
      FaviconRequests[destURI] = true;
      log.info(
          `Redirection from <${originURI}> to <${destURI}> ` +
          `appears to be a redirected favicon request. ` +
          `This will be treated as a content request.`
      );
    } else {
      logRequests.warn(
          `** ALLOWED ** redirection from <${originURI}> ` +
          `to <${destURI}>. ` +
          `Original request is from privileged code.`
      );
      return CP_OK;
    }
  }

  // Ignore redirects to javascript. The browser will ignore them, as well.
  if (request.destUriObj.schemeIs("javascript")) {
    log.warn(
        `Ignoring redirect to javascript URI <${destURI}>`
    );
    return CP_OK;
  }

  request.requestResult = checkRedirect(request);
  if (true === request.requestResult.isAllowed) {
    logRequests.warn(
        `** ALLOWED ** redirection from <${originURI}> ` +
        `to <${destURI}>. ` +
        `Same hosts or allowed origin/destination.`
    );
    Requests.notifyNewRequest({
      isAllowed: true,
      isInsert: false,
      requestResult: request.requestResult,
      originUri: originURI,
      destUri: destURI,
    });
    AllowedRedirectsReverse[destURI] = originURI;

    // If this was a link click or a form submission, we register an
    // additional click/submit with the original source but with a new
    // destination of the target of the redirect. This is because future
    // requests (such as using back/forward) might show up as directly from
    // the initial origin to the ultimate redirected destination.
    if (request.oldChannel._httpChannel.referrer) {
      let realOrigin = request.oldChannel._httpChannel.referrer.spec;

      if (ClickedLinks[realOrigin] &&
          ClickedLinks[realOrigin][originURI]) {
        logRequests.log(
            `${"This redirect was from a link click." +
            " Registering an additional click to <"}${destURI}> ` +
            `from <${realOrigin}>`
        );
        registerLinkClicked(realOrigin, destURI);
      } else if (SubmittedForms[realOrigin] &&
          SubmittedForms[realOrigin][originURI.split("?")[0]]) {
        logRequests.log(
            `${"This redirect was from a form submission." +
            " Registering an additional form submission to <"}${destURI
            }> ` + `from <${realOrigin}>`
        );
        registerFormSubmitted(realOrigin, destURI);
      }
    }

    return CP_OK;
  }

  // The header isn't allowed, so remove it.
  try {
    if (cachedSettings.alias.isBlockingDisabled()) {
      return CP_OK;
    }

    maybeShowRedirectNotification(request);

    // We try to trace the blocked redirect back to a link click or form
    // submission if we can. It may indicate, for example, a link that
    // was to download a file but a redirect got blocked at some point.
    // Example:
    //   "link click" -> "first redirect" -> "second redirect"
    {
      let initialOrigin = getOriginOfInitialRedirect(request);

      if (ClickedLinksReverse.hasOwnProperty(initialOrigin)) {
        let linkClickDest = initialOrigin;
        let linkClickOrigin: string;

        // fixme: bad smell! the same link (linkClickDest) could have
        //        been clicked from different origins!
        for (let i in ClickedLinksReverse[linkClickDest]) {
          if (ClickedLinksReverse[linkClickDest].
              hasOwnProperty(i)) {
            // We hope there's only one possibility of a source page
            // (that is,ideally there will be one iteration of this loop).
            linkClickOrigin = i;
          }
        }

        // TODO: #633 - Review the following line (recordAllowedRequest).

        // Maybe we just record the clicked link and each step in between as
        // an allowed request, and the final blocked one as a blocked request.
        // That is, make it show up in the requestpolicy menu like anything
        // else.
        // We set the "isInsert" parameter so we don't clobber the existing
        // info about allowed and deleted requests.
        Requests.notifyNewRequest({
          isAllowed: true,
          isInsert: true,
          originUri: linkClickOrigin!,
          destUri: linkClickDest,
          requestResult: request.requestResult,
        });
      }

      // TODO: implement for form submissions whose redirects are blocked
      // if (SubmittedFormsReverse[initialOrigin]) {
      // }
    }

    Requests.notifyNewRequest({
      isAllowed: false,
      isInsert: false,
      requestResult: request.requestResult,
      originUri: request.originURI!,
      destUri: request.destURI,
    });

    logRequests.warn(
        `** BLOCKED ** redirection from <${originURI}> ` +
        `to <${destURI}>.`
    );
    return CP_REJECT;
  } catch (e) {
    log.error("Fatal Error:", e);
    if (cachedSettings.alias.isBlockingDisabled()) {
      log.warn("Allowing request due to internal error.");
      return CP_OK;
    }
    log.warn("Rejecting request due to internal error.");
    return CP_REJECT;
  }
}

function showRedirectNotification(request: RedirectRequest) {
  let browser = request.browser;
  if (browser === null) {
    return false;
  }

  const window = browser.ownerGlobal;

  Utils.tryMultipleTimes(function() {
    const showNotification = Utils.getObjectPath(window, "rpcontinued",
        "overlay", "_showRedirectNotification");
    if (!showNotification) {
      return false;
    }
    // Parameter "replaceIfPossible" is set to true, because the "origin" of
    // redirections going through "nsIChannelEventSink" is just an
    // intermediate URI of a redirection chain, not a real site.
    return showNotification(browser, request.destURIWithRef, 0,
        request.originURI, true);
  });
  return true;
}

function maybeShowRedirectNotification(aRequest: RedirectRequest) {
  // Check if the request corresponds to a top-level document load.
  {
    let {loadFlags} = aRequest;
    let topLevelDocFlag = Ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI;

    if ((loadFlags & topLevelDocFlag) !== topLevelDocFlag) {
      return;
    }
  }

  let rv = showRedirectNotification(aRequest);
  if (true !== rv) {
    log.warn(
        `${"A redirection of a top-level document has been observed, " +
        "but it was not possible to notify the user! The redirection " +
        "was from page <"}${aRequest.originURI}> ` +
        `to <${aRequest.destURI}>.`
    );
  }
}

function getOriginOfInitialRedirect(aRequest: RedirectRequest): string {
  let initialOrigin = aRequest.originURI!;
  // @ts-ignore: 'initialDest' is declared but its value is never read.
  let initialDest = aRequest.destURI;

  // Prevent infinite loops, that is, bound the number of iterations.
  // Note: An apparent redirect loop doesn't mean a problem with a
  //       website as the site may be using other information,
  //       such as cookies that get set in the redirection process,
  //       to stop the redirection.
  const ASSUME_REDIRECT_LOOP = 100; // Chosen arbitrarily.

  for (let i = 0; i < ASSUME_REDIRECT_LOOP; ++i) {
    if (!AllowedRedirectsReverse.hasOwnProperty(initialOrigin)) {
      // break the loop
      break;
    }

    initialDest = initialOrigin;
    initialOrigin = AllowedRedirectsReverse[initialOrigin];
  }

  return initialOrigin;
}

/**
 * Checks whether a request is initiated by a content window. If it's from a
 * content window, then it's from unprivileged code.
 */
function isContentRequest(request: RedirectRequest): boolean {
  let loadContext = request.oldChannel.loadContext;

  if (loadContext === null) {
    return false;
  }

  return !!loadContext.isContent;
}

// FIXME
export const whenReady = Promise.resolve();
