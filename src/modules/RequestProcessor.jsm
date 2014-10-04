/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

var EXPORTED_SYMBOLS = ["RequestProcessor"];

const CI = Components.interfaces;
const CC = Components.classes;

const CP_OK = CI.nsIContentPolicy.ACCEPT;
const CP_REJECT = CI.nsIContentPolicy.REJECT_SERVER;

// A value intended to not conflict with aExtra passed to shouldLoad() by any
// other callers. Was chosen randomly.
const CP_MAPPEDDESTINATION = 0x178c40bf;


if (!rp) {
  var rp = {mod : {}};
}
Components.utils.import("resource://requestpolicy/DomainUtil.jsm", rp.mod);
Components.utils.import("resource://requestpolicy/Logger.jsm", rp.mod);
Components.utils.import("resource://requestpolicy/RequestResult.jsm", rp.mod);
Components.utils.import("resource://requestpolicy/RequestUtil.jsm", rp.mod);
Components.utils.import("resource://requestpolicy/Request.jsm", rp.mod);





function RequestProcessor(rpService) {
  this._rpService = rpService;

  /**
   * Number of elapsed milliseconds from the time of the last shouldLoad() call
   * at which the cached results of the last shouldLoad() call are discarded.
   *
   * @type {number}
   */
  this._lastShouldLoadCheckTimeout = 200;

  // Calls to shouldLoad appear to be repeated, so successive repeated calls and
  // their result (accept or reject) are tracked to avoid duplicate processing
  // and duplicate logging.
  /**
   * Object that caches the last shouldLoad
   * @type {Object}
   */
  this._lastShouldLoadCheck = {
    "origin" : null,
    "destination" : null,
    "time" : 0,
    "result" : null
  };

  this._rejectedRequests = new rp.mod.RequestSet();
  this._allowedRequests = new rp.mod.RequestSet();


  /**
   * These are redirects that the user allowed when presented with a redirect
   * notification.
   */
  this._userAllowedRedirects = {};

  this._blockedRedirects = {};
  this._allowedRedirectsReverse = {};

  this._historyRequests = {};

  this._submittedForms = {};
  this._submittedFormsReverse = {};

  this._clickedLinks = {};
  this._clickedLinksReverse = {};

  this._faviconRequests = {};

  this._mappedDestinations = {};

  this._requestObservers = [];
}

/**
 * Process a NormalRequest.
 *
 * @param {NormalRequest} request
 */
RequestProcessor.prototype.process = function(request) {
  //rp.mod.Logger.vardump(request.aRequestOrigin);
  //rp.mod.Logger.vardump(request.aContentLocation);
  try {

    if (request.isInternal()) {
      return CP_OK;
    }

    var originURI = request.originURI;
    var destURI = request.destURI;

    // Fx 16 changed the following: 1) we should be able to count on the
    // referrer (aRequestOrigin) being set to something besides
    // moz-nullprincipal when there is a referrer, and 2) the new argument
    // aRequestPrincipal is provided. This means our hackery to set the
    // referrer based on aContext when aRequestOrigin is moz-nullprincipal
    // is now causing requests that don't have a referrer (namely, URLs
    // entered in the address bar) to be blocked and trigger a top-level
    // document redirect notification.
    if (request.aRequestOrigin.scheme == "moz-nullprincipal" &&
        request.aRequestPrincipal) {
      rp.mod.Logger.warning(
          rp.mod.Logger.TYPE_CONTENT,
          "Allowing request that appears to be a URL entered in the "
              + "location bar or some other good explanation: " + destURI);
      return CP_OK;
    }

    // Note: Assuming the Fx 16 moz-nullprincipal+aRequestPrincipal check
    // above is correct, this should be able to be removed when Fx < 16 is
    // no longer supported.
    if (request.aRequestOrigin.scheme == "moz-nullprincipal" &&
        request.aContext) {
      var newOriginURI = rp.mod.DomainUtil
            .stripFragment(request.aContext.contentDocument.documentURI);
      rp.mod.Logger.info(rp.mod.Logger.TYPE_CONTENT,
          "Considering moz-nullprincipal origin <"
              + originURI + "> to be origin <" + newOriginURI + ">");
      originURI = newOriginURI;
      request.setOriginURI(originURI);
    }

    if (request.aRequestOrigin.scheme == "view-source") {
      var newOriginURI = originURI.split(":").slice(1).join(":");
      rp.mod.Logger.info(rp.mod.Logger.TYPE_CONTENT,
        "Considering view-source origin <"
          + originURI + "> to be origin <" + newOriginURI + ">");
      originURI = newOriginURI;
      request.setOriginURI(originURI);
    }

    if (request.aContentLocation.scheme == "view-source") {
      var newDestURI = destURI.split(":").slice(1).join(":");
      if (newDestURI.indexOf("data:text/html") == 0) {
        // "View Selection Source" has been clicked
        rp.mod.Logger.info(rp.mod.Logger.TYPE_CONTENT,
            "Allowing \"data:text/html\" view-source destination"
                + " (Selection Source)");
        return CP_OK;
      } else {
        rp.mod.Logger.info(rp.mod.Logger.TYPE_CONTENT,
            "Considering view-source destination <"
                + destURI + "> to be destination <" + newDestURI + ">");
        destURI = newDestURI;
        request.setDestURI(destURI);
      }
    }

    if (originURI == "about:blank" && request.aContext) {
      var newOriginURI;
      if (request.aContext.documentURI &&
          request.aContext.documentURI != "about:blank") {
        newOriginURI = request.aContext.documentURI;
      } else if (request.aContext.ownerDocument &&
          request.aContext.ownerDocument.documentURI &&
          request.aContext.ownerDocument.documentURI != "about:blank") {
        newOriginURI = request.aContext.ownerDocument.documentURI;
      }
      if (newOriginURI) {
        newOriginURI = rp.mod.DomainUtil.stripFragment(newOriginURI);
        rp.mod.Logger.info(rp.mod.Logger.TYPE_CONTENT, "Considering origin <" +
            originURI + "> to be origin <" + newOriginURI + ">");
        originURI = newOriginURI;
        request.setOriginURI(originURI);
      }
    }


    if (this._isDuplicateRequest(request)) {
      return this._lastShouldLoadCheck.result;
    }

    // Sometimes, clicking a link to a fragment will result in a request
    // where the origin is the same as the destination, but none of the
    // additional content of the page is again requested. The result is that
    // nothing ends up showing for blocked or allowed destinations because
    // all of that data was cleared due to the new request.
    // Example to test with: Click on "expand all" at
    // http://code.google.com/p/SOME_PROJECT/source/detail?r=SOME_REVISION
    if (originURI == destURI) {
      rp.mod.Logger.warning(rp.mod.Logger.TYPE_CONTENT,
          "Allowing (but not recording) request "
              + "where origin is the same as the destination: " + originURI);
      return CP_OK;
    }



    if (request.aContext && request.aContext.nodeName == "LINK" &&
        (request.aContext.rel == "icon" ||
            request.aContext.rel == "shortcut icon")) {
      this._faviconRequests[destURI] = true;
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
    if (this._clickedLinks[originURI] &&
        this._clickedLinks[originURI][destURI]) {
      // Don't delete the _clickedLinks item. We need it for if the user
      // goes back/forward through their history.
      // delete this._clickedLinks[originURI][destURI];

      // We used to have this not be recorded so that it wouldn't cause us
      // to forget blocked/allowed requests. However, when a policy change
      // causes a page refresh after a link click, it looks like a link
      // click again and so if we don't forget the previous blocked/allowed
      // requests, the menu becomes inaccurate. Now the question is: what
      // are we breaking by clearing the blocked/allowed requests here?
      request.requestResult = new rp.mod.RequestResult(true,
          rp.mod.REQUEST_REASON_LINK_CLICK);
      return this.accept("User-initiated request by link click", request);

    } else if (this._submittedForms[originURI] &&
        this._submittedForms[originURI][destURI.split("?")[0]]) {
      // Note: we dropped the query string from the destURI because form GET
      // requests will have that added on here but the original action of
      // the form may not have had it.
      // Don't delete the _clickedLinks item. We need it for if the user
      // goes back/forward through their history.
      // delete this._submittedForms[originURI][destURI.split("?")[0]];

      // See the note above for link clicks and forgetting blocked/allowed
      // requests on refresh. I haven't tested if it's the same for forms
      // but it should be so we're making the same change here.
      request.requestResult = new rp.mod.RequestResult(true,
          rp.mod.REQUEST_REASON_FORM_SUBMISSION);
      return this.accept("User-initiated request by form submission", request);

    } else if (this._historyRequests[destURI]) {
      // When the user goes back and forward in their history, a request for
      // the url comes through but is not followed by requests for any of
      // the page's content. Therefore, we make sure that our cache of
      // blocked requests isn't removed in this case.
      delete this._historyRequests[destURI];
      request.requestResult = new rp.mod.RequestResult(true,
          rp.mod.REQUEST_REASON_HISTORY_REQUEST);
      return this.accept("History request", request, true);
    } else if (this._userAllowedRedirects[originURI]
        && this._userAllowedRedirects[originURI][destURI]) {
      // shouldLoad is called by location.href in overlay.js as of Fx
      // 3.7a5pre and SeaMonkey 2.1a.
      request.requestResult = new rp.mod.RequestResult(true,
          rp.mod.REQUEST_REASON_USER_ALLOWED_REDIRECT);
      return this.accept("User-allowed redirect", request, true);
    }

    if (request.aRequestOrigin.scheme == "chrome") {
      if (request.aRequestOrigin.asciiHost == "browser") {
        // "browser" origin shows up for favicon.ico and an address entered
        // in address bar.
        request.requestResult = new rp.mod.RequestResult(true,
            rp.mod.REQUEST_REASON_USER_ACTION);
        return this.accept(
            "User action (e.g. address entered in address bar) or other good "
                + "explanation (e.g. new window/tab opened)", request);
      } else {
        // TODO: It seems sketchy to allow all requests from chrome. If I
        // had to put my money on a possible bug (in terms of not blocking
        // requests that should be), I'd put it here. Doing this, however,
        // saves a lot of blocking of legitimate requests from extensions
        // that originate from their xul files. If you're reading this and
        // you know of a way to use this to evade RequestPolicy, please let
        // me know, I will be very grateful.
        request.requestResult = new rp.mod.RequestResult(true,
            rp.mod.REQUEST_REASON_USER_ACTION);
        return this.accept(
            "User action (e.g. address entered in address bar) or other good "
                + "explanation (e.g. new window/tab opened)", request);
      }
    }

    // This is mostly here for the case of popup windows where the user has
    // allowed popups for the domain. In that case, the window.open() call
    // that made the popup isn't calling the wrapped version of
    // window.open() and we can't find a better way to register the source
    // and destination before the request is made. This should be able to be
    // removed if we can find a better solution for the allowed popup case.
    if (request.aContext && request.aContext.nodeName == "xul:browser" &&
        request.aContext.currentURI &&
        request.aContext.currentURI.spec == "about:blank") {
      request.requestResult = new rp.mod.RequestResult(true,
          rp.mod.REQUEST_REASON_NEW_WINDOW);
      return this.accept("New window (should probably only be an allowed " +
          "popup's initial request)", request, true);
    }

    // XMLHttpRequests made within chrome's context have these origins.
    // Greasemonkey uses such a method to provide their cross-site xhr.
    if (originURI == "resource://gre/res/hiddenWindow.html" ||
        originURI == "resource://gre-resources/hiddenWindow.html") {
    }

    // Now that we have blacklists, a user could prevent themselves from
    // being able to reload a page by blocking requests from * to the
    // destination page. As a simple hack around this, for now we'll always
    // allow request to the same origin. It would be nice to have a a better
    // solution but I'm not sure what that solution is.
    var originIdent = rp.mod.DomainUtil.getIdentifier(originURI);
    var destIdent = rp.mod.DomainUtil.getIdentifier(destURI);
    if (originIdent == destIdent) {
      request.requestResult = new rp.mod.RequestResult(true,
          rp.mod.REQUEST_REASON_IDENTICAL_IDENTIFIER);
      return this.accept(
          "Allowing request where origin protocol, host, and port are the" +
          " same as the destination: " + originIdent, request);
    }

    request.requestResult = this._rpService._policyMgr.
        checkRequestAgainstUserPolicies(request.aRequestOrigin,
            request.aContentLocation);
    for (var i = 0; i < request.requestResult.matchedDenyRules.length; i++) {
      rp.mod.Logger.dump('Matched deny rules');
      rp.mod.Logger.vardump(request.requestResult.matchedDenyRules[i]);
    }
    for (var i = 0; i < request.requestResult.matchedAllowRules.length; i++) {
      rp.mod.Logger.dump('Matched allow rules');
      rp.mod.Logger.vardump(request.requestResult.matchedAllowRules[i]);
    }
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
      request.requestResult.resultReason = rp.mod.
          REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES;
      if (this._rpService._defaultAllow) {
        request.requestResult.isAllowed = true;
        return this.accept("User policy indicates both allow and block. " +
            "Using default allow policy", request);
      } else {
        request.requestResult.isAllowed = false;
        return this.reject("User policy indicates both allow and block. " +
            "Using default block policy", request);
      }
    }
    if (request.requestResult.allowRulesExist()) {
      request.requestResult.resultReason = rp.mod.REQUEST_REASON_USER_POLICY;
      request.requestResult.isAllowed = true;
      return this.accept("Allowed by user policy", request);
    }
    if (request.requestResult.denyRulesExist()) {
      request.requestResult.resultReason = rp.mod.REQUEST_REASON_USER_POLICY;
      request.requestResult.isAllowed = false;
      return this.reject("Blocked by user policy", request);
    }

    request.requestResult = this._rpService._policyMgr.
        checkRequestAgainstSubscriptionPolicies(request.aRequestOrigin,
            request.aContentLocation);
    for (var i = 0; i < request.requestResult.matchedDenyRules.length; i++) {
      rp.mod.Logger.dump('Matched deny rules');
      rp.mod.Logger.vardump(
          request.requestResult.matchedDenyRules[i]);
    }
    for (var i = 0; i < request.requestResult.matchedAllowRules.length; i++) {
      rp.mod.Logger.dump('Matched allow rules');
      rp.mod.Logger.vardump(
          request.requestResult.matchedAllowRules[i]);
    }
    if (request.requestResult.allowRulesExist() &&
        request.requestResult.denyRulesExist()) {
      request.requestResult.resultReason = rp.mod.
          REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES;
      if (this._rpService._defaultAllow) {
        request.requestResult.isAllowed = true;
        return this.accept(
            "Subscription policies indicate both allow and block. " +
            "Using default allow policy", request);
      } else {
        request.requestResult.isAllowed = false;
        return this.reject(
            "Subscription policies indicate both allow and block. " +
            "Using default block policy", request);
      }
    }
    if (request.requestResult.denyRulesExist()) {
      request.requestResult.resultReason = rp.mod.
          REQUEST_REASON_SUBSCRIPTION_POLICY;
      request.requestResult.isAllowed = false;
      return this.reject("Blocked by subscription policy", request);
    }
    if (request.requestResult.allowRulesExist()) {
      request.requestResult.resultReason = rp.mod.
          REQUEST_REASON_SUBSCRIPTION_POLICY;
      request.requestResult.isAllowed = true;
      return this.accept("Allowed by subscription policy", request);
    }

    for (var i = 0; i < this._rpService._compatibilityRules.length; i++) {
      var rule = this._rpService._compatibilityRules[i];
      var allowOrigin = rule[0] ? originURI.indexOf(rule[0]) == 0 : true;
      var allowDest = rule[1] ? destURI.indexOf(rule[1]) == 0 : true;
      if (allowOrigin && allowDest) {
        request.requestResult = new rp.mod.RequestResult(true,
            rp.mod.REQUEST_REASON_COMPATIBILITY);
        return this.accept(
            "Extension/application compatibility rule matched [" + rule[2] +
            "]", request, true);
      }
    }

    // If the destination has a mapping (i.e. it was originally a different
    // destination but was changed into the current one), accept this
    // request if the original destination would have been accepted.
    // Check aExtra against CP_MAPPEDDESTINATION to stop further recursion.
    if (request.aExtra != CP_MAPPEDDESTINATION &&
        this._mappedDestinations[destURI]) {
      for (var mappedDest in this._mappedDestinations[destURI]) {
        var mappedDestUriObj = this._mappedDestinations[destURI][mappedDest];
        rp.mod.Logger.warning(rp.mod.Logger.TYPE_CONTENT,
            "Checking mapped destination: " + mappedDest);
        var mappedResult = this._rpService.shouldLoad(request.aContentType,
            mappedDestUriObj, request.aRequestOrigin, request.aContext,
            request.aMimeTypeGuess, CP_MAPPEDDESTINATION);
        if (mappedResult == CP_OK) {
          return CP_OK;
        }
      }
    }

    request.requestResult = this._checkByDefaultPolicy(originURI, destURI);
    if (request.requestResult.isAllowed) {
      return this.accept("Allowed by default policy", request);
    } else {
      // We didn't match any of the conditions in which to allow the request,
      // so reject it.
      return request.aExtra == CP_MAPPEDDESTINATION ? CP_REJECT :
            this.reject("Denied by default policy", request);
    }


  } catch (e) {
    rp.mod.Logger.severe(rp.mod.Logger.TYPE_ERROR,
        "Fatal Error, " + e + ", stack was: " + e.stack);
    rp.mod.Logger.severe(rp.mod.Logger.TYPE_CONTENT,
        "Rejecting request due to internal error.");
    return this._rpService._blockingDisabled ? CP_OK : CP_REJECT;
  }
};
// RequestProcessor.prototype.finishProcessing = function(request, result) {
//   request.shouldLoadResult = result;
// };

RequestProcessor.prototype.mapDestinations = function(origDestUri, newDestUri) {
  origDestUri = rp.mod.DomainUtil.stripFragment(origDestUri);
  newDestUri = rp.mod.DomainUtil.stripFragment(newDestUri);
  rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
      "Mapping destination <" + origDestUri + "> to <" + newDestUri + ">.");
  if (!this._mappedDestinations[newDestUri]) {
    this._mappedDestinations[newDestUri] = {};
  }
  this._mappedDestinations[newDestUri][origDestUri] =
      rp.mod.DomainUtil.getUriObject(origDestUri);
};




/**
 * Checks whether a request is initiated by a content window. If it's from a
 * content window, then it's from unprivileged code.
 */
RequestProcessor.prototype._isContentRequest = function(channel) {
  var callbacks = [];
  if (channel.notificationCallbacks) {
    callbacks.push(channel.notificationCallbacks);
  }
  if (channel.loadGroup && channel.loadGroup.notificationCallbacks) {
    callbacks.push(channel.loadGroup.notificationCallbacks);
  }

  for (var i = 0; i < callbacks.length; i++) {
    var callback = callbacks[i];
    try {
      // For Gecko 1.9.1
      return callback.getInterface(CI.nsILoadContext).isContent;
    } catch (e) {
    }
    try {
      // For Gecko 1.9.0
      var itemType = callback.getInterface(CI.nsIWebNavigation)
          .QueryInterface(CI.nsIDocShellTreeItem).itemType;
      return itemType == CI.nsIDocShellTreeItem.typeContent;
    } catch (e) {
    }
  }

  return false;
};

/**
 * Called after a response has been received from the web server. Headers are
 * available on the channel. The response can be accessed and modified via
 * nsITraceableChannel.
 */
RequestProcessor.prototype._examineHttpResponse = function(observedSubject) {
  // Currently, if a user clicks a link to download a file and that link
  // redirects and is subsequently blocked, the user will see the blocked
  // destination in the menu. However, after they have allowed it from
  // the menu and attempted the download again, they won't see the allowed
  // request in the menu. Fixing that might be a pain and also runs the
  // risk of making the menu cluttered and confusing with destinations of
  // followed links from the current page.

  // TODO: Make user aware of blocked headers so they can allow them if
  // desired.

  var httpChannel = observedSubject.QueryInterface(CI.nsIHttpChannel);

  var headerType;
  var dest;

  try {
    // If there is no such header, getResponseHeader() will throw
    // NS_ERROR_NOT_AVAILABLE. If there is more than header, the last one is
    // the one that will be used.
    headerType = "Location";
    dest = httpChannel.getResponseHeader(headerType);
  } catch (e) {
    // No location header. Look for a Refresh header.
    try {
      headerType = "Refresh";
      var refreshString = httpChannel.getResponseHeader(headerType);
    } catch (e) {
      // No Location header or Refresh header.
      return;
    }
    try {
      var parts = rp.mod.DomainUtil.parseRefresh(refreshString);
    } catch (e) {
      rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT,
          "Invalid refresh header: <" + refreshString + ">");
      if (!this._rpService._blockingDisabled) {
        httpChannel.setResponseHeader(headerType, "", false);
      }
      return;
    }
    // We can ignore the delay (parts[0]) because we aren't manually doing
    // the refreshes. Allowed refreshes we still leave to the browser.
    // The dest may be empty if the origin is what should be refreshed. This
    // will be handled by DomainUtil.determineRedirectUri().
    dest = parts[1];
  }

  // For origins that are IDNs, this will always be in ACE format. We want
  // it in UTF8 format if it's a TLD that Mozilla allows to be in UTF8.
  var originURI = rp.mod.DomainUtil.formatIDNUri(httpChannel.name);

  // Allow redirects of requests from privileged code.
  if (!this._isContentRequest(httpChannel)) {
    // However, favicon requests that are redirected appear as non-content
    // requests. So, check if the original request was for a favicon.
    var originPath = rp.mod.DomainUtil.getPath(httpChannel.name);
    // We always have to check "/favicon.ico" because Firefox will use this
    // as a default path and that request won't pass through shouldLoad().
    if (originPath == "/favicon.ico" || this._faviconRequests[originURI]) {
      // If the redirected request is allowed, we need to know that was a
      // favicon request in case it is further redirected.
      this._faviconRequests[dest] = true;
      rp.mod.Logger.info(rp.mod.Logger.TYPE_HEADER_REDIRECT, "'" + headerType
              + "' header to <" + dest + "> " + "from <" + originURI
              + "> appears to be a redirected favicon request. "
              + "This will be treated as a content request.");
    } else {
      rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT,
          "** ALLOWED ** '" + headerType + "' header to <" + dest + "> " +
          "from <" + originURI +
          ">. Original request is from privileged code.");
      return;
    }
  }

  // If it's not a valid uri, the redirect is relative to the origin host.
  // The way we have things written currently, without this check the full
  // dest string will get treated as the destination and displayed in the
  // menu because DomainUtil.getIdentifier() doesn't raise exceptions.
  // We add this to fix issue #39:
  // https://github.com/RequestPolicyContinued/requestpolicy/issues/39
  if (!rp.mod.DomainUtil.isValidUri(dest)) {
    var destAsUri = rp.mod.DomainUtil.determineRedirectUri(originURI, dest);
    rp.mod.Logger.warning(
        rp.mod.Logger.TYPE_HEADER_REDIRECT,
        "Redirect destination is not a valid uri, assuming dest <" + dest
            + "> from origin <" + originURI + "> is actually dest <" + destAsUri
            + ">.");
    dest = destAsUri;
  }

  var request = new rp.mod.RedirectRequest(originURI, dest, headerType);
  this.processRedirect(request, httpChannel);
};

RequestProcessor.prototype.processRedirect = function(request, httpChannel) {
  var originURI = request.originURI;
  var destURI = request.destURI;
  var headerType = request.headerType;

  // Ignore redirects to javascript. The browser will ignore them, as well.
  if (rp.mod.DomainUtil.getUriObject(destURI).schemeIs("javascript")) {
    rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT,
        "Ignoring redirect to javascript URI <" + destURI + ">");
    return;
  }

  request.requestResult = this.checkRedirect(request);
  if (true === request.requestResult.isAllowed) {
    rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT, "** ALLOWED ** '"
        + headerType + "' header to <" + destURI + "> " + "from <" + originURI
        + ">. Same hosts or allowed origin/destination.");
    this._recordAllowedRequest(originURI, destURI, false,
        request.requestResult);
    this._allowedRedirectsReverse[destURI] = originURI;

    // If this was a link click or a form submission, we register an
    // additional click/submit with the original source but with a new
    // destination of the target of the redirect. This is because future
    // requests (such as using back/forward) might show up as directly from
    // the initial origin to the ultimate redirected destination.
    if (httpChannel.referrer) {
      var realOrigin = httpChannel.referrer.spec;

      if (this._clickedLinks[realOrigin]
          && this._clickedLinks[realOrigin][originURI]) {
        rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT,
            "This redirect was from a link click." +
            " Registering an additional click to <" + destURI + "> " +
            "from <" + realOrigin + ">");
        this.registerLinkClicked(realOrigin, destURI);

      } else if (this._submittedForms[realOrigin]
          && this._submittedForms[realOrigin][originURI.split("?")[0]]) {
        rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT,
            "This redirect was from a form submission." +
            " Registering an additional form submission to <" + destURI +
            "> " + "from <" + realOrigin + ">");
        this.registerFormSubmitted(realOrigin, destURI);
      }
    }

    return;
  }

  // The header isn't allowed, so remove it.
  try {
    if (!this._rpService._blockingDisabled) {
      httpChannel.setResponseHeader(headerType, "", false);
      this._blockedRedirects[originURI] = destURI;

      try {
        contentDisp = httpChannel.getResponseHeader("Content-Disposition");
        if (contentDisp.indexOf("attachment") != -1) {
          try {
            httpChannel.setResponseHeader("Content-Disposition", "", false);
            rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT,
                "Removed 'Content-Disposition: attachment' header to " +
                "prevent display of about:neterror.");
          } catch (e) {
            rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT,
                "Unable to remove 'Content-Disposition: attachment' header " +
                "to prevent display of about:neterror. " + e);
          }
        }
      } catch (e) {
        // No Content-Disposition header.
      }

      // We try to trace the blocked redirect back to a link click or form
      // submission if we can. It may indicate, for example, a link that
      // was to download a file but a redirect got blocked at some point.
      var initialOrigin = originURI;
      var initialDest = destURI;
      // To prevent infinite loops, bound the number of iterations.
      // Note that an apparent redirect loop doesn't mean a problem with a
      // website as the site may be using other information, such as cookies
      // that get set in the redirection process, to stop the redirection.
      var iterations = 0;
      const ASSUME_REDIRECT_LOOP = 100; // Chosen arbitrarily.
      while (this._allowedRedirectsReverse[initialOrigin]) {
        if (iterations++ >= ASSUME_REDIRECT_LOOP) {
          break;
        }
        initialDest = initialOrigin;
        initialOrigin = this._allowedRedirectsReverse[initialOrigin];
      }

      if (this._clickedLinksReverse[initialOrigin]) {
        for (var i in this._clickedLinksReverse[initialOrigin]) {
          // We hope there's only one possibility of a source page (that is,
          // ideally there will be one iteration of this loop).
          var sourcePage = i;
        }

        this._notifyRequestObserversOfBlockedLinkClickRedirect(sourcePage,
            originURI, destURI);

        // Maybe we just record the clicked link and each step in between as
        // an allowed request, and the final blocked one as a blocked request.
        // That is, make it show up in the requestpolicy menu like anything
        // else.
        // We set the "isInsert" parameter so we don't clobber the existing
        // info about allowed and deleted requests.
        this._recordAllowedRequest(sourcePage, initialOrigin, true, result);
      }

      // if (this._submittedFormsReverse[initialOrigin]) {
      // // TODO: implement for form submissions whose redirects are blocked
      // }

      this._recordRejectedRequest(originURI, destURI, result);
    }
    rp.mod.Logger.warning(rp.mod.Logger.TYPE_HEADER_REDIRECT,
        "** BLOCKED ** '" + headerType + "' header to <" + destURI + ">" +
        " found in response from <" + originURI + ">");
  } catch (e) {
    rp.mod.Logger.severe(
        rp.mod.Logger.TYPE_HEADER_REDIRECT, "Failed removing " +
        "'" + headerType + "' header to <" + destURI + ">" +
        "  in response from <" + originURI + ">." + e);
  }
};

/**
 * Called as a http request is made. The channel is available to allow you to
 * modify headers and such.
 *
 * Currently this just looks for prefetch requests that are getting through
 * which we currently can't stop.
 */
RequestProcessor.prototype._examineHttpRequest = function(observedSubject) {
  var httpChannel = observedSubject.QueryInterface(CI.nsIHttpChannel);
  try {
    // Determine if prefetch requests are slipping through.
    if (httpChannel.getRequestHeader("X-moz") == "prefetch") {
      // Seems to be too late to block it at this point. Calling the
      // cancel(status) method didn't stop it.
      rp.mod.Logger.warning(rp.mod.Logger.TYPE_CONTENT,
          "Discovered prefetch request being sent to: " + httpChannel.name);
    }
  } catch (e) {
    // No X-moz header.
  }
};

RequestProcessor.prototype._printAllowedRequests = function() {
  this._allowedRequests.print();
};

RequestProcessor.prototype._printRejectedRequests = function() {
  this._rejectedRequests.print();
};

RequestProcessor.prototype._notifyRequestObserversOfBlockedRequest = function(
    request) {
  for (var i = 0; i < this._requestObservers.length; i++) {
    if (!this._requestObservers[i]) {
      continue;
    }
    this._requestObservers[i].observeBlockedRequest(request.originURI,
        request.destURI, request.requestResult);
  }
};

RequestProcessor.prototype._notifyRequestObserversOfAllowedRequest = function(
    originUri, destUri, requestResult) {
  for (var i = 0; i < this._requestObservers.length; i++) {
    if (!this._requestObservers[i]) {
      continue;
    }
    this._requestObservers[i].observeAllowedRequest(originUri, destUri,
        requestResult);
  }
};

RequestProcessor.prototype._notifyRequestObserversOfBlockedLinkClickRedirect =
    function(sourcePageUri, linkDestUri, blockedRedirectUri) {
  for (var i = 0; i < this._requestObservers.length; i++) {
    if (!this._requestObservers[i]) {
      continue;
    }
    this._requestObservers[i].observeBlockedLinkClickRedirect(sourcePageUri,
        linkDestUri, blockedRedirectUri);
  }
};

RequestProcessor.prototype._notifyBlockedTopLevelDocRequest = function(
    originUri, destUri) {
  // TODO: this probably could be done async.
  for (var i = 0; i < this._requestObservers.length; i++) {
    if (!this._requestObservers[i]) {
      continue;
    }
    this._requestObservers[i].observeBlockedTopLevelDocRequest(originUri,
        destUri);
  }
};





RequestProcessor.prototype.registerHistoryRequest = function(destinationUrl) {
  var destinationUrl = rp.mod.DomainUtil.ensureUriHasPath(
      rp.mod.DomainUtil.stripFragment(destinationUrl));
  this._historyRequests[destinationUrl] = true;
  rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
      "History item requested: <" + destinationUrl + ">.");
};

RequestProcessor.prototype.registerFormSubmitted = function(originUrl,
    destinationUrl) {
  var originUrl = rp.mod.DomainUtil
      .ensureUriHasPath(rp.mod.DomainUtil.stripFragment(originUrl));
  var destinationUrl = rp.mod.DomainUtil.ensureUriHasPath(
      rp.mod.DomainUtil.stripFragment(destinationUrl));

  rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
      "Form submitted from <" + originUrl + "> to <" + destinationUrl + ">.");

  // Drop the query string from the destination url because form GET requests
  // will end up with a query string on them when shouldLoad is called, so
  // we'll need to be dropping the query string there.
  destinationUrl = destinationUrl.split("?")[0];

  if (this._submittedForms[originUrl] == undefined) {
    this._submittedForms[originUrl] = {};
  }
  if (this._submittedForms[originUrl][destinationUrl] == undefined) {
    // TODO: See timestamp note for registerLinkClicked.
    this._submittedForms[originUrl][destinationUrl] = true;
  }

  // Keep track of a destination-indexed map, as well.
  if (this._submittedFormsReverse[destinationUrl] == undefined) {
    this._submittedFormsReverse[destinationUrl] = {};
  }
  if (this._submittedFormsReverse[destinationUrl][originUrl] == undefined) {
    // TODO: See timestamp note for registerLinkClicked.
    this._submittedFormsReverse[destinationUrl][originUrl] = true;
  }
};

RequestProcessor.prototype.registerLinkClicked = function(originUrl,
    destinationUrl) {
  var originUrl = rp.mod.DomainUtil.ensureUriHasPath(
      rp.mod.DomainUtil.stripFragment(originUrl));
  var destinationUrl = rp.mod.DomainUtil.ensureUriHasPath(
      rp.mod.DomainUtil.stripFragment(destinationUrl));

  rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
      "Link clicked from <" + originUrl + "> to <" + destinationUrl + ">.");

  if (this._clickedLinks[originUrl] == undefined) {
    this._clickedLinks[originUrl] = {};
  }
  if (this._clickedLinks[originUrl][destinationUrl] == undefined) {
    // TODO: Possibly set the value to a timestamp that can be used elsewhere
    // to determine if this is a recent click. This is probably necessary as
    // multiple calls to shouldLoad get made and we need a way to allow
    // multiple in a short window of time. Alternately, as it seems to always
    // be in order (repeats are always the same as the last), the last one
    // could be tracked and always allowed (or allowed within a small period
    // of time). This would have the advantage that we could delete items from
    // the _clickedLinks object. One of these approaches would also reduce log
    // clutter, which would be good.
    this._clickedLinks[originUrl][destinationUrl] = true;
  }

  // Keep track of a destination-indexed map, as well.
  if (this._clickedLinksReverse[destinationUrl] == undefined) {
    this._clickedLinksReverse[destinationUrl] = {};
  }
  if (this._clickedLinksReverse[destinationUrl][originUrl] == undefined) {
    // TODO: Possibly set the value to a timestamp, as described above.
    this._clickedLinksReverse[destinationUrl][originUrl] = true;
  }
};

RequestProcessor.prototype.registerAllowedRedirect = function(originUrl,
    destinationUrl) {
  var originUrl = rp.mod.DomainUtil.ensureUriHasPath(
      rp.mod.DomainUtil.stripFragment(originUrl));
  var destinationUrl = rp.mod.DomainUtil.ensureUriHasPath(
      rp.mod.DomainUtil.stripFragment(destinationUrl));

  rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
      "User-allowed redirect from <" + originUrl + "> to <" + destinationUrl
          + ">.");

  if (this._userAllowedRedirects[originUrl] == undefined) {
    this._userAllowedRedirects[originUrl] = {};
  }
  if (this._userAllowedRedirects[originUrl][destinationUrl] == undefined) {
    this._userAllowedRedirects[originUrl][destinationUrl] = true;
  }
};

RequestProcessor.prototype.isAllowedRedirect = function(originURI, destURI) {
  var request = new rp.mod.RedirectRequest(originURI, destURI);
  return (true === this.checkRedirect(request).isAllowed);
};

RequestProcessor.prototype.checkRedirect = function(request) {
  // TODO: Find a way to get rid of repitition of code between this and
  // shouldLoad().

  // Note: If changing the logic here, also make necessary changes to
  // shouldLoad().

  // This is not including link clicks, form submissions, and user-allowed
  // redirects.

  var originURI = request.originURI;
  var destURI = request.destURI;

  var originURIObj = rp.mod.DomainUtil.getUriObject(originURI);
  var destURIObj = rp.mod.DomainUtil.getUriObject(destURI);

  var result = this._rpService._policyMgr.checkRequestAgainstUserPolicies(
      originURIObj, destURIObj);
  // For now, we always give priority to deny rules.
  if (result.denyRulesExist()) {
    result.isAllowed = false;
    return result;
  }
  if (result.allowRulesExist()) {
    result.isAllowed = true;
    return result;
  }

  var result = this._rpService._policyMgr.
      checkRequestAgainstSubscriptionPolicies(originURIObj, destURIObj);
  // For now, we always give priority to deny rules.
  if (result.denyRulesExist()) {
    result.isAllowed = false;
    return result;
  }
  if (result.allowRulesExist()) {
    result.isAllowed = true;
    return result;
  }

  if (destURI[0] && destURI[0] == '/'
      || destURI.indexOf(":") == -1) {
    // Redirect is to a relative url.
    // ==> allow.
    return new rp.mod.RequestResult(true, rp.mod.REQUEST_REASON_RELATIVE_URL);
  }

  for (var i = 0; i < this._rpService._compatibilityRules.length; i++) {
    var rule = this._rpService._compatibilityRules[i];
    var allowOrigin = rule[0] ? originURI.indexOf(rule[0]) == 0 : true;
    var allowDest = rule[1] ? destURI.indexOf(rule[1]) == 0 : true;
    if (allowOrigin && allowDest) {
      return new rp.mod.RequestResult(true,
          rp.mod.REQUEST_REASON_COMPATIBILITY);
    }
  }

  var result = this._checkByDefaultPolicy(originURI, destURI);
  return result;
};

/**
 * Add an observer to be notified of all blocked and allowed requests. TODO:
 * This should be made to accept instances of a defined interface.
 *
 * @param {Object} observer
 */
RequestProcessor.prototype.addRequestObserver = function(observer) {
  if (!("observeBlockedRequest" in observer)) {
    throw "Observer passed to addRequestObserver does "
        + "not have an observeBlockedRequest() method.";
  }
  rp.mod.Logger.debug(rp.mod.Logger.TYPE_INTERNAL,
      "Adding request observer: " + observer.toString());
  this._requestObservers.push(observer);
};

/**
 * Remove an observer added through addRequestObserver().
 *
 * @param {Object} observer
 */
RequestProcessor.prototype.removeRequestObserver = function(observer) {
  for (var i = 0; i < this._requestObservers.length; i++) {
    if (this._requestObservers[i] == observer) {
      rp.mod.Logger.debug(rp.mod.Logger.TYPE_INTERNAL,
          "Removing request observer: " + observer.toString());
      delete this._requestObservers[i];
      return;
    }
  }
  rp.mod.Logger.warning(rp.mod.Logger.TYPE_INTERNAL,
      "Could not find observer to remove " + "in removeRequestObserver()");
};




// We always call this from shouldLoad to reject a request.
RequestProcessor.prototype.reject = function(reason, request) {
  rp.mod.Logger.warning(rp.mod.Logger.TYPE_CONTENT,
      "** BLOCKED ** reason: " + reason + ". " + request.detailsToString());

  if (this._rpService._blockingDisabled) {
    return CP_OK;
  }

  request.aContext.requestpolicyBlocked = true;

  this._cacheShouldLoadResult(CP_REJECT, request.originURI, request.destURI);
  this._recordRejectedRequest(request);

  if (CI.nsIContentPolicy.TYPE_DOCUMENT == request.aContentType) {
    // This was a blocked top-level document request. This may be due to
    // a blocked attempt by javascript to set the document location.
    // TODO: pass requestResult?
    this._notifyBlockedTopLevelDocRequest(request.originURI, request.destURI);
  }

  return CP_REJECT;
};

RequestProcessor.prototype._recordRejectedRequest = function(request) {
  this._rejectedRequests.addRequest(request.originURI, request.destURI,
      request.requestResult);
  this._allowedRequests.removeRequest(request.originURI, request.destURI);
  this._notifyRequestObserversOfBlockedRequest(request);
};

// We only call this from shouldLoad when the request was a remote request
// initiated by the content of a page. this is partly for efficiency. in other
// cases we just return CP_OK rather than return this function which
// ultimately returns CP_OK. Fourth param, "unforbidable", is set to true if
// this request shouldn't be recorded as an allowed request.
/**
 * @param {string} reason
 * @param {Request} request
 * @param {boolean} unforbidable
 */
RequestProcessor.prototype.accept = function(reason, request, unforbidable) {
  rp.mod.Logger.warning(rp.mod.Logger.TYPE_CONTENT,
      "** ALLOWED ** reason: " + reason + ". " + request.detailsToString());

  this._cacheShouldLoadResult(CP_OK, request.originURI, request.destURI);
  // We aren't recording the request so it doesn't show up in the menu, but we
  // want it to still show up in the request log.
  if (unforbidable) {
    this._notifyRequestObserversOfAllowedRequest(request.originURI,
        request.destURI, request.requestResult);
  } else {
    this._recordAllowedRequest(request.originURI, request.destURI, false,
        request.requestResult);
  }

  return CP_OK;
};

RequestProcessor.prototype._recordAllowedRequest = function(originUri, destUri,
    isInsert, requestResult) {
  // Reset the accepted and rejected requests originating from this
  // destination. That is, if this accepts a request to a uri that may itself
  // originate further requests, reset the information about what that page is
  // accepting and rejecting.
  // If "isInsert" is set, then we don't want to clear the destUri info.
  if (true !== isInsert) {
    this._allowedRequests.removeOriginUri(destUri);
    this._rejectedRequests.removeOriginUri(destUri);
  }
  this._rejectedRequests.removeRequest(originUri, destUri);
  this._allowedRequests.addRequest(originUri, destUri, requestResult);
  this._notifyRequestObserversOfAllowedRequest(originUri, destUri,
      requestResult);
};

RequestProcessor.prototype._cacheShouldLoadResult = function(result, originUri,
    destUri) {
  var date = new Date();
  this._lastShouldLoadCheck.time = date.getTime();
  this._lastShouldLoadCheck.destination = destUri;
  this._lastShouldLoadCheck.origin = originUri;
  this._lastShouldLoadCheck.result = result;
};

RequestProcessor.prototype._checkByDefaultPolicy = function(originUri,
    destUri) {
  if (this._rpService._defaultAllow) {
    var result = new rp.mod.RequestResult(true,
        rp.mod.REQUEST_REASON_DEFAULT_POLICY);
    return result;
  }
  if (this._rpService._defaultAllowSameDomain) {
    var originDomain = rp.mod.DomainUtil.getDomain(
        originUri);
    var destDomain = rp.mod.DomainUtil.getDomain(destUri);
    return new rp.mod.RequestResult(originDomain == destDomain,
        rp.mod.REQUEST_REASON_DEFAULT_SAME_DOMAIN);
  }
  // We probably want to allow requests from http:80 to https:443 of the same
  // domain. However, maybe this is so uncommon it's not worth any extra
  // complexity.
  var originIdent = rp.mod.DomainUtil.getIdentifier(
      originUri, rp.mod.DomainUtil.LEVEL_SOP);
  var destIdent = rp.mod.DomainUtil.getIdentifier(destUri,
      rp.mod.DomainUtil.LEVEL_SOP);
  return new rp.mod.RequestResult(originIdent == destIdent,
      rp.mod.REQUEST_REASON_DEFAULT_SAME_DOMAIN);
};

/**
 * Determines if a request is a duplicate of the last call to shouldLoad(). If
 * it is, the cached result in _lastShouldLoadCheck.result can be used. Not
 * sure why, it seems that there are duplicates so using this simple cache of
 * the last call to shouldLoad() keeps duplicates out of log data.
 *
 * @param {Request} request
 * @return {boolean} True if the request is a duplicate of the previous one.
 */
RequestProcessor.prototype._isDuplicateRequest = function(request) {

  if (this._lastShouldLoadCheck.origin == request.originURI &&
      this._lastShouldLoadCheck.destination == request.destURI) {
    var date = new Date();
    if (date.getTime() - this._lastShouldLoadCheck.time <
        this._lastShouldLoadCheckTimeout) {
      rp.mod.Logger.debug(rp.mod.Logger.TYPE_CONTENT,
          "Using cached shouldLoad() result of " +
          this._lastShouldLoadCheck.result + " for request to <" +
          request.destURI + "> from <" + request.originURI + ">.");
      return true;
    } else {
      rp.mod.Logger.debug(rp.mod.Logger.TYPE_CONTENT,
          "shouldLoad() cache expired for result of " +
          this._lastShouldLoadCheck.result + " for request to <" +
          request.destURI + "> from <" + request.originURI + ">.");
    }
  }
  return false;
};
