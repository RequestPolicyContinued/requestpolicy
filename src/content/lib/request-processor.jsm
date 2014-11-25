/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["RequestProcessor"];

let globalScope = this;

const CP_OK = Ci.nsIContentPolicy.ACCEPT;
const CP_REJECT = Ci.nsIContentPolicy.REJECT_SERVER;

// A value intended to not conflict with aExtra passed to shouldLoad() by any
// other callers. Was chosen randomly.
const CP_MAPPEDDESTINATION = 0x178c40bf;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "logger",
  "prefs",
  "policy-manager",
  "domain-util",
  "request",
  "request-result",
  "request-set"
], this);
ScriptLoader.defineLazyModuleGetters({
  "content-policy": ["PolicyImplementation"],
  "requestpolicy-service": ["rpService"]
}, globalScope);



let RequestProcessor = (function() {
  // private variables and functions


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
  let lastShouldLoadCheck = {
    "origin" : null,
    "destination" : null,
    "time" : 0,
    "result" : null
  };

  /**
   * These are redirects that the user allowed when presented with a redirect
   * notification.
   */
  let userAllowedRedirects = {};

  let allowedRedirectsReverse = {};

  let historyRequests = {};

  let submittedForms = {};
  let submittedFormsReverse = {};

  let clickedLinks = {};
  let clickedLinksReverse = {};

  let faviconRequests = {};

  let mappedDestinations = {};

  let requestObservers = [];




  function mapDestinations(origDestUri, newDestUri) {
    origDestUri = DomainUtil.stripFragment(origDestUri);
    newDestUri = DomainUtil.stripFragment(newDestUri);
    Logger.info(Logger.TYPE_INTERNAL,
        "Mapping destination <" + origDestUri + "> to <" + newDestUri + ">.");
    if (!mappedDestinations[newDestUri]) {
      mappedDestinations[newDestUri] = {};
    }
    mappedDestinations[newDestUri][origDestUri] =
        DomainUtil.getUriObject(origDestUri);
  }




  /**
   * Checks whether a request is initiated by a content window. If it's from a
   * content window, then it's from unprivileged code.
   */
  function isContentRequest(channel) {
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
        return callback.getInterface(Ci.nsILoadContext).isContent;
      } catch (e) {
      }
      try {
        // For Gecko 1.9.0
        var itemType = callback.getInterface(Ci.nsIWebNavigation)
            .QueryInterface(Ci.nsIDocShellTreeItem).itemType;
        return itemType == Ci.nsIDocShellTreeItem.typeContent;
      } catch (e) {
      }
    }

    return false;
  }
  function processRedirect(request, httpChannel) {
    var originURI = request.originURI;
    var destURI = request.destURI;
    var headerType = request.httpHeader;

    // Ignore redirects to javascript. The browser will ignore them, as well.
    if (DomainUtil.getUriObject(destURI).schemeIs("javascript")) {
      Logger.warning(Logger.TYPE_HEADER_REDIRECT,
          "Ignoring redirect to javascript URI <" + destURI + ">");
      return;
    }

    request.requestResult = checkRedirect(request);
    if (true === request.requestResult.isAllowed) {
      Logger.warning(Logger.TYPE_HEADER_REDIRECT, "** ALLOWED ** '"
          + headerType + "' header to <" + destURI + "> " + "from <" + originURI
          + ">. Same hosts or allowed origin/destination.");
      recordAllowedRequest(originURI, destURI, false, request.requestResult);
      allowedRedirectsReverse[destURI] = originURI;

      // If this was a link click or a form submission, we register an
      // additional click/submit with the original source but with a new
      // destination of the target of the redirect. This is because future
      // requests (such as using back/forward) might show up as directly from
      // the initial origin to the ultimate redirected destination.
      if (httpChannel.referrer) {
        var realOrigin = httpChannel.referrer.spec;

        if (clickedLinks[realOrigin] && clickedLinks[realOrigin][originURI]) {
          Logger.warning(Logger.TYPE_HEADER_REDIRECT,
              "This redirect was from a link click." +
              " Registering an additional click to <" + destURI + "> " +
              "from <" + realOrigin + ">");
          self.registerLinkClicked(realOrigin, destURI);

        } else if (submittedForms[realOrigin]
            && submittedForms[realOrigin][originURI.split("?")[0]]) {
          Logger.warning(Logger.TYPE_HEADER_REDIRECT,
              "This redirect was from a form submission." +
              " Registering an additional form submission to <" + destURI +
              "> " + "from <" + realOrigin + ">");
          self.registerFormSubmitted(realOrigin, destURI);
        }
      }

      return;
    }

    // The header isn't allowed, so remove it.
    try {
      if (!Prefs.isBlockingDisabled()) {
        httpChannel.setResponseHeader(headerType, "", false);
        self._blockedRedirects[originURI] = destURI;

        try {
          contentDisp = httpChannel.getResponseHeader("Content-Disposition");
          if (contentDisp.indexOf("attachment") != -1) {
            try {
              httpChannel.setResponseHeader("Content-Disposition", "", false);
              Logger.warning(Logger.TYPE_HEADER_REDIRECT,
                  "Removed 'Content-Disposition: attachment' header to " +
                  "prevent display of about:neterror.");
            } catch (e) {
              Logger.warning(Logger.TYPE_HEADER_REDIRECT,
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
        while (allowedRedirectsReverse[initialOrigin]) {
          if (iterations++ >= ASSUME_REDIRECT_LOOP) {
            break;
          }
          initialDest = initialOrigin;
          initialOrigin = allowedRedirectsReverse[initialOrigin];
        }

        if (clickedLinksReverse[initialOrigin]) {
          for (var i in clickedLinksReverse[initialOrigin]) {
            // We hope there's only one possibility of a source page (that is,
            // ideally there will be one iteration of this loop).
            var sourcePage = i;
          }

          notifyRequestObserversOfBlockedLinkClickRedirect(sourcePage,
              originURI, destURI);

          // Maybe we just record the clicked link and each step in between as
          // an allowed request, and the final blocked one as a blocked request.
          // That is, make it show up in the requestpolicy menu like anything
          // else.
          // We set the "isInsert" parameter so we don't clobber the existing
          // info about allowed and deleted requests.
          recordAllowedRequest(sourcePage, initialOrigin, true,
                               request.requestResult);
        }

        // if (submittedFormsReverse[initialOrigin]) {
        // // TODO: implement for form submissions whose redirects are blocked
        // }

        recordRejectedRequest(request);
      }
      Logger.warning(Logger.TYPE_HEADER_REDIRECT,
          "** BLOCKED ** '" + headerType + "' header to <" + destURI + ">" +
          " found in response from <" + originURI + ">");
    } catch (e) {
      Logger.severe(
          Logger.TYPE_HEADER_REDIRECT, "Failed removing " +
          "'" + headerType + "' header to <" + destURI + ">" +
          "  in response from <" + originURI + ">." + e);
    }
  }





  function notifyRequestObserversOfBlockedRequest(request) {
    for (var i = 0; i < requestObservers.length; i++) {
      if (!requestObservers[i]) {
        continue;
      }
      requestObservers[i].observeBlockedRequest(request.originURI,
          request.destURI, request.requestResult);
    }
  }

  function notifyRequestObserversOfAllowedRequest(originUri,
      destUri, requestResult) {
    for (var i = 0; i < requestObservers.length; i++) {
      if (!requestObservers[i]) {
        continue;
      }
      requestObservers[i].observeAllowedRequest(originUri, destUri,
          requestResult);
    }
  }

  function notifyRequestObserversOfBlockedLinkClickRedirect(sourcePageUri,
      linkDestUri, blockedRedirectUri) {
    for (var i = 0; i < requestObservers.length; i++) {
      if (!requestObservers[i]) {
        continue;
      }
      requestObservers[i].observeBlockedLinkClickRedirect(sourcePageUri,
          linkDestUri, blockedRedirectUri);
    }
  }

  function notifyBlockedTopLevelDocRequest(originUri, destUri) {
    // TODO: this probably could be done async.
    for (var i = 0; i < requestObservers.length; i++) {
      if (!requestObservers[i]) {
        continue;
      }
      requestObservers[i].observeBlockedTopLevelDocRequest(originUri,
          destUri);
    }
  }





  function checkRedirect(request) {
    // TODO: Find a way to get rid of repitition of code between this and
    // shouldLoad().

    // Note: If changing the logic here, also make necessary changes to
    // shouldLoad().

    // This is not including link clicks, form submissions, and user-allowed
    // redirects.

    var originURI = request.originURI;
    var destURI = request.destURI;

    var originURIObj = DomainUtil.getUriObject(originURI);
    var destURIObj = DomainUtil.getUriObject(destURI);

    var result = PolicyManager.checkRequestAgainstUserRules(originURIObj,
        destURIObj);
    // For now, we always give priority to deny rules.
    if (result.denyRulesExist()) {
      result.isAllowed = false;
      return result;
    }
    if (result.allowRulesExist()) {
      result.isAllowed = true;
      return result;
    }

    var result = PolicyManager.checkRequestAgainstSubscriptionRules(
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

    if (destURI[0] && destURI[0] == '/'
        || destURI.indexOf(":") == -1) {
      // Redirect is to a relative url.
      // ==> allow.
      return new RequestResult(true, REQUEST_REASON_RELATIVE_URL);
    }

    let compatibilityRules = rpService.getCompatibilityRules();
    for (var i = 0; i < compatibilityRules.length; i++) {
      var rule = compatibilityRules[i];
      var allowOrigin = rule[0] ? originURI.indexOf(rule[0]) == 0 : true;
      var allowDest = rule[1] ? destURI.indexOf(rule[1]) == 0 : true;
      if (allowOrigin && allowDest) {
        return new RequestResult(true,
            REQUEST_REASON_COMPATIBILITY);
      }
    }

    var result = checkByDefaultPolicy(originURI, destURI);
    return result;
  }



  // We always call this from shouldLoad to reject a request.
  function reject(reason, request) {
    Logger.warning(Logger.TYPE_CONTENT, "** BLOCKED ** reason: " + reason +
        ". " + request.detailsToString());

    if (Prefs.isBlockingDisabled()) {
      return CP_OK;
    }

    if (request.aContext) {
      request.aContext.requestpolicyBlocked = true;
    }

    cacheShouldLoadResult(CP_REJECT, request.originURI, request.destURI);
    recordRejectedRequest(request);

    if (Ci.nsIContentPolicy.TYPE_DOCUMENT == request.aContentType) {
      // This was a blocked top-level document request. This may be due to
      // a blocked attempt by javascript to set the document location.
      // TODO: pass requestResult?
      notifyBlockedTopLevelDocRequest(request.originURI, request.destURI);
    }

    return CP_REJECT;
  }

  function recordRejectedRequest(request) {
    self._rejectedRequests.addRequest(request.originURI, request.destURI,
        request.requestResult);
    self._allowedRequests.removeRequest(request.originURI, request.destURI);
    notifyRequestObserversOfBlockedRequest(request);
  }

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
  function accept(reason, request, unforbidable) {
    Logger.warning(Logger.TYPE_CONTENT, "** ALLOWED ** reason: " +
        reason + ". " + request.detailsToString());

    cacheShouldLoadResult(CP_OK, request.originURI, request.destURI);
    // We aren't recording the request so it doesn't show up in the menu, but we
    // want it to still show up in the request log.
    if (unforbidable) {
      notifyRequestObserversOfAllowedRequest(request.originURI, request.destURI,
          request.requestResult);
    } else {
      recordAllowedRequest(request.originURI, request.destURI, false,
          request.requestResult);
    }

    return CP_OK;
  }

  function recordAllowedRequest(originUri, destUri, isInsert, requestResult) {
    // Reset the accepted and rejected requests originating from this
    // destination. That is, if this accepts a request to a uri that may itself
    // originate further requests, reset the information about what that page is
    // accepting and rejecting.
    // If "isInsert" is set, then we don't want to clear the destUri info.
    if (true !== isInsert) {
      self._allowedRequests.removeOriginUri(destUri);
      self._rejectedRequests.removeOriginUri(destUri);
    }
    self._rejectedRequests.removeRequest(originUri, destUri);
    self._allowedRequests.addRequest(originUri, destUri, requestResult);
    notifyRequestObserversOfAllowedRequest(originUri, destUri, requestResult);
  }

  function cacheShouldLoadResult(result, originUri, destUri) {
    var date = new Date();
    lastShouldLoadCheck.time = date.getTime();
    lastShouldLoadCheck.destination = destUri;
    lastShouldLoadCheck.origin = originUri;
    lastShouldLoadCheck.result = result;
  }

  function checkByDefaultPolicy(originUri, destUri) {
    if (Prefs.isDefaultAllow()) {
      var result = new RequestResult(true,
          REQUEST_REASON_DEFAULT_POLICY);
      return result;
    }
    if (Prefs.isDefaultAllowSameDomain()) {
      var originDomain = DomainUtil.getBaseDomain(
          originUri);
      var destDomain = DomainUtil.getBaseDomain(destUri);
      return new RequestResult(originDomain == destDomain,
          REQUEST_REASON_DEFAULT_SAME_DOMAIN);
    }
    // We probably want to allow requests from http:80 to https:443 of the same
    // domain. However, maybe this is so uncommon it's not worth any extra
    // complexity.
    var originIdent = DomainUtil.getIdentifier(
        originUri, DomainUtil.LEVEL_SOP);
    var destIdent = DomainUtil.getIdentifier(destUri,
        DomainUtil.LEVEL_SOP);
    return new RequestResult(originIdent == destIdent,
        REQUEST_REASON_DEFAULT_SAME_DOMAIN);
  }

  /**
   * Determines if a request is a duplicate of the last call to shouldLoad(). If
   * it is, the cached result in lastShouldLoadCheck.result can be used. Not
   * sure why, it seems that there are duplicates so using this simple cache of
   * the last call to shouldLoad() keeps duplicates out of log data.
   *
   * @param {Request} request
   * @return {boolean} True if the request is a duplicate of the previous one.
   */
  function isDuplicateRequest(request) {
    if (lastShouldLoadCheck.origin == request.originURI &&
        lastShouldLoadCheck.destination == request.destURI) {
      var date = new Date();
      if (date.getTime() - lastShouldLoadCheck.time <
          lastShouldLoadCheckTimeout) {
        Logger.debug(Logger.TYPE_CONTENT,
            "Using cached shouldLoad() result of " +
            lastShouldLoadCheck.result + " for request to <" +
            request.destURI + "> from <" + request.originURI + ">.");
        return true;
      } else {
        Logger.debug(Logger.TYPE_CONTENT,
            "shouldLoad() cache expired for result of " +
            lastShouldLoadCheck.result + " for request to <" +
            request.destURI + "> from <" + request.originURI + ">.");
      }
    }
    return false;
  }



  function _getRequestsHelper(currentlySelectedOrigin, allRequestsOnDocument,
      isAllowed) {
    var result = new RequestSet();
    var requests = allRequestsOnDocument.getAll();

    // We're assuming ident is fullIdent (LEVEL_SOP). We plan to remove base
    // domain and hostname levels.
    for (var originUri in requests) {
      if (DomainUtil.getBaseDomain(originUri) != currentlySelectedOrigin) {
        // only return requests from the given base domain
        continue;
      }
      Logger.dump("test destBase: " + destBase);
      for (var destBase in requests[originUri]) {
        Logger.dump("test destBase: " + destBase);
        for (var destIdent in requests[originUri][destBase]) {
          Logger.dump("test destIdent: " + destIdent);
          for (var destUri in requests[originUri][destBase][destIdent]) {
            Logger.dump("test destUri: " + destUri);
            var dest = requests[originUri][destBase][destIdent][destUri];
            for (var i in dest) {
              // TODO: This variable could have been created easily already in
              //       getAllRequestsOnDocument(). ==> rewrite RequestSet to
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

//  function _getOtherOriginsHelperFromDOM(document, reqSet) {
//    var documentUri = DomainUtil
//        .stripFragment(document.documentURI);
//    Logger.dump("Looking for other origins within DOM of "
//        + documentUri);
//    // TODO: Check other elements besides iframes and frames?
//    var frameTagTypes = {
//      "iframe" : null,
//      "frame" : null
//    };
//    for (var tagType in frameTagTypes) {
//      var iframes = document.getElementsByTagName(tagType);
//      for (var i = 0; i < iframes.length; i++) {
//        var child = iframes[i];
//        var childDocument = child.contentDocument;
//        // Flock's special home page is about:myworld. It has (i)frames in it
//        // that have no contentDocument. It's probably related to the fact that
//        // that is an xul page, but I have no reason to fully understand the
//        // problem in order to fix it.
//        if (!childDocument) {
//          continue;
//        }
//        var childUri = DomainUtil
//            .stripFragment(childDocument.documentURI);
//        if (childUri == "about:blank") {
//          // iframe empty or not loaded yet, or maybe blocked.
//          // childUri = child.src;
//          // If it's not loaded or blocked, it's not the origin for anything
//          // yet.
//          continue;
//        }
//        Logger.dump("Found DOM child " + tagType
//            + " with src <" + childUri + "> in document <" + documentUri + ">");
//        //var childUriIdent = DomainUtil.getIdentifier(childUri,
//        //    DomainUtil.LEVEL_SOP);
//        // if (!origins[childUriIdent]) {
//        //   origins[childUriIdent] = {};
//        // }
//        // origins[childUriIdent][childUri] = true;
//        reqSet.addRequest(documentUri, childUri);
//        _getOtherOriginsHelperFromDOM(childDocument, reqSet);
//      }
//    }
//  },

  function _addRecursivelyAllRequestsFromURI(originURI, reqSet,
      checkedOrigins) {
    Logger.dump("Looking for other origins within allowed requests from "
            + originURI);
    if (!checkedOrigins[originURI]) {
      // this "if" is needed for the first call of this function.
      checkedOrigins[originURI] = true;
    }
    _addAllDeniedRequestsFromURI(originURI, reqSet);
    var allowedRequests = RequestProcessor._allowedRequests
        .getOriginUri(originURI);
    if (allowedRequests) {
      for (var destBase in allowedRequests) {
        for (var destIdent in allowedRequests[destBase]) {
          for (var destURI in allowedRequests[destBase][destIdent]) {
            Logger.dump("Found allowed request to <"
                + destURI + "> from <" + originURI + ">");
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

  function _addAllDeniedRequestsFromURI(originURI, reqSet) {
    Logger.dump("Looking for other origins within denied requests from " +
        originURI);
    var requests = RequestProcessor._rejectedRequests.getOriginUri(originURI);
    if (requests) {
      for (var destBase in requests) {
        for (var destIdent in requests[destBase]) {
          for (var destUri in requests[destBase][destIdent]) {
            Logger.dump("Found denied request to <" + destUri + "> from <" +
                originURI + ">");
            reqSet.addRequest(originURI, destUri,
                requests[destBase][destIdent][destUri]);
          }
        }
      }
    }
  }












  let self = {
    // TODO: make them private
    _rejectedRequests: new RequestSet(),
    _allowedRequests: new RequestSet(),

    // TODO: make it private
    _blockedRedirects: {},


    /**
     * Process a NormalRequest.
     *
     * @param {NormalRequest} request
     */
    process: function(request) {
      //Logger.vardump(request.aRequestOrigin);
      //Logger.vardump(request.aContentLocation);
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
          Logger.warning(
              Logger.TYPE_CONTENT,
              "Allowing request that appears to be a URL entered in the "
                  + "location bar or some other good explanation: " + destURI);
          return CP_OK;
        }

        // Note: Assuming the Fx 16 moz-nullprincipal+aRequestPrincipal check
        // above is correct, this should be able to be removed when Fx < 16 is
        // no longer supported.
        if (request.aRequestOrigin.scheme == "moz-nullprincipal" &&
            request.aContext) {
          var newOriginURI = DomainUtil
                .stripFragment(request.aContext.contentDocument.documentURI);
          Logger.info(Logger.TYPE_CONTENT,
              "Considering moz-nullprincipal origin <"
                  + originURI + "> to be origin <" + newOriginURI + ">");
          originURI = newOriginURI;
          request.setOriginURI(originURI);
        }

        if (request.aRequestOrigin.scheme == "view-source") {
          var newOriginURI = originURI.split(":").slice(1).join(":");
          Logger.info(Logger.TYPE_CONTENT,
            "Considering view-source origin <"
              + originURI + "> to be origin <" + newOriginURI + ">");
          originURI = newOriginURI;
          request.setOriginURI(originURI);
        }

        if (request.aContentLocation.scheme == "view-source") {
          var newDestURI = destURI.split(":").slice(1).join(":");
          if (newDestURI.indexOf("data:text/html") == 0) {
            // "View Selection Source" has been clicked
            Logger.info(Logger.TYPE_CONTENT,
                "Allowing \"data:text/html\" view-source destination"
                    + " (Selection Source)");
            return CP_OK;
          } else {
            Logger.info(Logger.TYPE_CONTENT,
                "Considering view-source destination <"
                    + destURI + "> to be destination <" + newDestURI + ">");
            destURI = newDestURI;
            request.setDestURI(destURI);
          }
        }

        if (originURI == "about:blank" && request.aContext) {
          let domNode;
          try {
            domNode = request.aContext.QueryInterface(Ci.nsIDOMNode);
          } catch (e if e.result == Components.results.NS_ERROR_NO_INTERFACE) {}
          if (domNode && domNode.nodeType == Ci.nsIDOMNode.DOCUMENT_NODE) {
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
              newOriginURI = DomainUtil.stripFragment(newOriginURI);
              Logger.info(Logger.TYPE_CONTENT, "Considering origin <" +
                          originURI + "> to be origin <" + newOriginURI + ">");
              originURI = newOriginURI;
              request.setOriginURI(originURI);
            }
          }
        }


        if (isDuplicateRequest(request)) {
          return lastShouldLoadCheck.result;
        }

        // Sometimes, clicking a link to a fragment will result in a request
        // where the origin is the same as the destination, but none of the
        // additional content of the page is again requested. The result is that
        // nothing ends up showing for blocked or allowed destinations because
        // all of that data was cleared due to the new request.
        // Example to test with: Click on "expand all" at
        // http://code.google.com/p/SOME_PROJECT/source/detail?r=SOME_REVISION
        if (originURI == destURI) {
          Logger.warning(Logger.TYPE_CONTENT,
              "Allowing (but not recording) request "
                  + "where origin is the same as the destination: " + originURI);
          return CP_OK;
        }



        if (request.aContext) {
          let domNode;
          try {
            domNode = request.aContext.QueryInterface(Ci.nsIDOMNode);
          } catch (e if e.result == Components.results.NS_ERROR_NO_INTERFACE) {}

          if (domNode && domNode.nodeName == "LINK" &&
              (domNode.rel == "icon" || domNode.rel == "shortcut icon")) {
            faviconRequests[destURI] = true;
          }
        }


        if (request.checkURISchemes().shouldLoad === true) {
          return CP_OK;
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
        if (clickedLinks[originURI] &&
            clickedLinks[originURI][destURI]) {
          // Don't delete the clickedLinks item. We need it for if the user
          // goes back/forward through their history.
          // delete clickedLinks[originURI][destURI];

          // We used to have this not be recorded so that it wouldn't cause us
          // to forget blocked/allowed requests. However, when a policy change
          // causes a page refresh after a link click, it looks like a link
          // click again and so if we don't forget the previous blocked/allowed
          // requests, the menu becomes inaccurate. Now the question is: what
          // are we breaking by clearing the blocked/allowed requests here?
          request.requestResult = new RequestResult(true,
              REQUEST_REASON_LINK_CLICK);
          return accept("User-initiated request by link click", request);

        } else if (submittedForms[originURI] &&
            submittedForms[originURI][destURI.split("?")[0]]) {
          // Note: we dropped the query string from the destURI because form GET
          // requests will have that added on here but the original action of
          // the form may not have had it.
          // Don't delete the clickedLinks item. We need it for if the user
          // goes back/forward through their history.
          // delete submittedForms[originURI][destURI.split("?")[0]];

          // See the note above for link clicks and forgetting blocked/allowed
          // requests on refresh. I haven't tested if it's the same for forms
          // but it should be so we're making the same change here.
          request.requestResult = new RequestResult(true,
              REQUEST_REASON_FORM_SUBMISSION);
          return accept("User-initiated request by form submission", request);

        } else if (historyRequests[destURI]) {
          // When the user goes back and forward in their history, a request for
          // the url comes through but is not followed by requests for any of
          // the page's content. Therefore, we make sure that our cache of
          // blocked requests isn't removed in this case.
          delete historyRequests[destURI];
          request.requestResult = new RequestResult(true,
              REQUEST_REASON_HISTORY_REQUEST);
          return accept("History request", request, true);
        } else if (userAllowedRedirects[originURI]
            && userAllowedRedirects[originURI][destURI]) {
          // shouldLoad is called by location.href in overlay.js as of Fx
          // 3.7a5pre and SeaMonkey 2.1a.
          request.requestResult = new RequestResult(true,
              REQUEST_REASON_USER_ALLOWED_REDIRECT);
          return accept("User-allowed redirect", request, true);
        }

        if (request.aRequestOrigin.scheme == "chrome") {
          if (request.aRequestOrigin.asciiHost == "browser") {
            // "browser" origin shows up for favicon.ico and an address entered
            // in address bar.
            request.requestResult = new RequestResult(true,
                REQUEST_REASON_USER_ACTION);
            return accept(
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
            request.requestResult = new RequestResult(true,
                REQUEST_REASON_USER_ACTION);
            return accept(
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
        if (request.aContext) {
          let domNode;
          try {
            domNode = request.aContext.QueryInterface(Ci.nsIDOMNode);
          } catch (e if e.result == Components.results.NS_ERROR_NO_INTERFACE) {}

          if (domNode && domNode.nodeName == "xul:browser" &&
              domNode.currentURI && domNode.currentURI.spec == "about:blank") {
            request.requestResult = new RequestResult(true,
                REQUEST_REASON_NEW_WINDOW);
            return accept("New window (should probably only be an allowed " +
                "popup's initial request)", request, true);
          }
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
        var originIdent = DomainUtil.getIdentifier(originURI);
        var destIdent = DomainUtil.getIdentifier(destURI);
        if (originIdent == destIdent) {
          request.requestResult = new RequestResult(true,
              REQUEST_REASON_IDENTICAL_IDENTIFIER);
          return accept(
              "Allowing request where origin protocol, host, and port are the" +
              " same as the destination: " + originIdent, request);
        }

        request.requestResult = PolicyManager.checkRequestAgainstUserRules(
            request.aRequestOrigin, request.aContentLocation);
        for (var i = 0; i < request.requestResult.matchedDenyRules.length; i++) {
          Logger.dump('Matched deny rules');
          Logger.vardump(request.requestResult.matchedDenyRules[i]);
        }
        for (var i = 0; i < request.requestResult.matchedAllowRules.length; i++) {
          Logger.dump('Matched allow rules');
          Logger.vardump(request.requestResult.matchedAllowRules[i]);
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
          request.requestResult.resultReason =
              REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES;
          if (Prefs.isDefaultAllow()) {
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
          request.requestResult.resultReason = REQUEST_REASON_USER_POLICY;
          request.requestResult.isAllowed = true;
          return accept("Allowed by user policy", request);
        }
        if (request.requestResult.denyRulesExist()) {
          request.requestResult.resultReason = REQUEST_REASON_USER_POLICY;
          request.requestResult.isAllowed = false;
          return reject("Blocked by user policy", request);
        }

        request.requestResult = PolicyManager
            .checkRequestAgainstSubscriptionRules(request.aRequestOrigin,
                request.aContentLocation);
        for (var i = 0; i < request.requestResult.matchedDenyRules.length; i++) {
          Logger.dump('Matched deny rules');
          Logger.vardump(
              request.requestResult.matchedDenyRules[i]);
        }
        for (var i = 0; i < request.requestResult.matchedAllowRules.length; i++) {
          Logger.dump('Matched allow rules');
          Logger.vardump(
              request.requestResult.matchedAllowRules[i]);
        }
        if (request.requestResult.allowRulesExist() &&
            request.requestResult.denyRulesExist()) {
          request.requestResult.resultReason =
              REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES;
          if (Prefs.isDefaultAllow()) {
            request.requestResult.isAllowed = true;
            return accept(
                "Subscription rules indicate both allow and block. " +
                "Using default allow policy", request);
          } else {
            request.requestResult.isAllowed = false;
            return reject("Subscription rules indicate both allow and block. " +
                "Using default block policy", request);
          }
        }
        if (request.requestResult.denyRulesExist()) {
          request.requestResult.resultReason =
              REQUEST_REASON_SUBSCRIPTION_POLICY;
          request.requestResult.isAllowed = false;
          return reject("Blocked by subscription policy", request);
        }
        if (request.requestResult.allowRulesExist()) {
          request.requestResult.resultReason =
              REQUEST_REASON_SUBSCRIPTION_POLICY;
          request.requestResult.isAllowed = true;
          return accept("Allowed by subscription policy", request);
        }

        let compatibilityRules = rpService.getCompatibilityRules();
        for (var i = 0; i < compatibilityRules.length; i++) {
          var rule = compatibilityRules[i];
          var allowOrigin = rule[0] ? originURI.indexOf(rule[0]) == 0 : true;
          var allowDest = rule[1] ? destURI.indexOf(rule[1]) == 0 : true;
          if (allowOrigin && allowDest) {
            request.requestResult = new RequestResult(true,
                REQUEST_REASON_COMPATIBILITY);
            return accept(
                "Extension/application compatibility rule matched [" + rule[2] +
                "]", request, true);
          }
        }

        // If the destination has a mapping (i.e. it was originally a different
        // destination but was changed into the current one), accept this
        // request if the original destination would have been accepted.
        // Check aExtra against CP_MAPPEDDESTINATION to stop further recursion.
        if (request.aExtra != CP_MAPPEDDESTINATION &&
            mappedDestinations[destURI]) {
          for (var mappedDest in mappedDestinations[destURI]) {
            var mappedDestUriObj = mappedDestinations[destURI][mappedDest];
            Logger.warning(Logger.TYPE_CONTENT,
                "Checking mapped destination: " + mappedDest);
            var mappedResult = PolicyImplementation.shouldLoad(
                request.aContentType, mappedDestUriObj, request.aRequestOrigin,
                request.aContext, request.aMimeTypeGuess, CP_MAPPEDDESTINATION);
            if (mappedResult == CP_OK) {
              return CP_OK;
            }
          }
        }

        request.requestResult = checkByDefaultPolicy(originURI, destURI);
        if (request.requestResult.isAllowed) {
          return accept("Allowed by default policy", request);
        } else {
          // We didn't match any of the conditions in which to allow the request,
          // so reject it.
          return request.aExtra == CP_MAPPEDDESTINATION ? CP_REJECT :
              reject("Denied by default policy", request);
        }


      } catch (e) {
        Logger.severe(Logger.TYPE_ERROR,
            "Fatal Error, " + e + ", stack was: " + e.stack);
        Logger.severe(Logger.TYPE_CONTENT,
            "Rejecting request due to internal error.");
        return Prefs.isBlockingDisabled() ? CP_OK : CP_REJECT;
      }
    },

    // RequestProcessor.finishProcessing = function(request, result) {
    //   request.shouldLoadResult = result;
    // };





    /**
     * Called after a response has been received from the web server. Headers are
     * available on the channel. The response can be accessed and modified via
     * nsITraceableChannel.
     */
    _examineHttpResponse: function(observedSubject) {
      // Currently, if a user clicks a link to download a file and that link
      // redirects and is subsequently blocked, the user will see the blocked
      // destination in the menu. However, after they have allowed it from
      // the menu and attempted the download again, they won't see the allowed
      // request in the menu. Fixing that might be a pain and also runs the
      // risk of making the menu cluttered and confusing with destinations of
      // followed links from the current page.

      // TODO: Make user aware of blocked headers so they can allow them if
      // desired.

      var httpChannel = observedSubject.QueryInterface(Ci.nsIHttpChannel);

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
          var parts = DomainUtil.parseRefresh(refreshString);
        } catch (e) {
          Logger.warning(Logger.TYPE_HEADER_REDIRECT,
              "Invalid refresh header: <" + refreshString + ">");
          if (!Prefs.isBlockingDisabled()) {
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
      var originURI = DomainUtil.formatIDNUri(httpChannel.name);

      // Allow redirects of requests from privileged code.
      if (!isContentRequest(httpChannel)) {
        // However, favicon requests that are redirected appear as non-content
        // requests. So, check if the original request was for a favicon.
        var originPath = DomainUtil.getPath(httpChannel.name);
        // We always have to check "/favicon.ico" because Firefox will use this
        // as a default path and that request won't pass through shouldLoad().
        if (originPath == "/favicon.ico" || faviconRequests[originURI]) {
          // If the redirected request is allowed, we need to know that was a
          // favicon request in case it is further redirected.
          faviconRequests[dest] = true;
          Logger.info(Logger.TYPE_HEADER_REDIRECT, "'" + headerType
                  + "' header to <" + dest + "> " + "from <" + originURI
                  + "> appears to be a redirected favicon request. "
                  + "This will be treated as a content request.");
        } else {
          Logger.warning(Logger.TYPE_HEADER_REDIRECT,
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
      if (!DomainUtil.isValidUri(dest)) {
        var destAsUri = DomainUtil.determineRedirectUri(originURI, dest);
        Logger.warning(
            Logger.TYPE_HEADER_REDIRECT,
            "Redirect destination is not a valid uri, assuming dest <" + dest
                + "> from origin <" + originURI + "> is actually dest <" + destAsUri
                + ">.");
        dest = destAsUri;
      }

      var request = new RedirectRequest(originURI, dest, headerType);
      processRedirect(request, httpChannel);
    },

    /**
     * Called as a http request is made. The channel is available to allow you to
     * modify headers and such.
     *
     * Currently this just looks for prefetch requests that are getting through
     * which we currently can't stop.
     */
    _examineHttpRequest: function(observedSubject) {
      var httpChannel = observedSubject.QueryInterface(Ci.nsIHttpChannel);
      try {
        // Determine if prefetch requests are slipping through.
        if (httpChannel.getRequestHeader("X-moz") == "prefetch") {
          // Seems to be too late to block it at this point. Calling the
          // cancel(status) method didn't stop it.
          Logger.warning(Logger.TYPE_CONTENT,
              "Discovered prefetch request being sent to: " + httpChannel.name);
        }
      } catch (e) {
        // No X-moz header.
      }
    },

    _printAllowedRequests: function() {
      self._allowedRequests.print();
    },

    _printRejectedRequests: function() {
      self._rejectedRequests.print();
    },






    registerHistoryRequest: function(destinationUrl) {
      destinationUrl = DomainUtil.ensureUriHasPath(
          DomainUtil.stripFragment(destinationUrl));
      historyRequests[destinationUrl] = true;
      Logger.info(Logger.TYPE_INTERNAL,
          "History item requested: <" + destinationUrl + ">.");
    },

    registerFormSubmitted: function(originUrl, destinationUrl) {
      originUrl = DomainUtil.ensureUriHasPath(DomainUtil.stripFragment(originUrl));
      destinationUrl = DomainUtil.ensureUriHasPath(
          DomainUtil.stripFragment(destinationUrl));

      Logger.info(Logger.TYPE_INTERNAL,
          "Form submitted from <" + originUrl + "> to <" + destinationUrl + ">.");

      // Drop the query string from the destination url because form GET requests
      // will end up with a query string on them when shouldLoad is called, so
      // we'll need to be dropping the query string there.
      destinationUrl = destinationUrl.split("?")[0];

      if (submittedForms[originUrl] == undefined) {
        submittedForms[originUrl] = {};
      }
      if (submittedForms[originUrl][destinationUrl] == undefined) {
        // TODO: See timestamp note for registerLinkClicked.
        submittedForms[originUrl][destinationUrl] = true;
      }

      // Keep track of a destination-indexed map, as well.
      if (submittedFormsReverse[destinationUrl] == undefined) {
        submittedFormsReverse[destinationUrl] = {};
      }
      if (submittedFormsReverse[destinationUrl][originUrl] == undefined) {
        // TODO: See timestamp note for registerLinkClicked.
        submittedFormsReverse[destinationUrl][originUrl] = true;
      }
    },

    registerLinkClicked: function(originUrl, destinationUrl) {
      originUrl = DomainUtil.ensureUriHasPath(DomainUtil.stripFragment(originUrl));
      destinationUrl = DomainUtil.ensureUriHasPath(
          DomainUtil.stripFragment(destinationUrl));

      Logger.info(Logger.TYPE_INTERNAL,
          "Link clicked from <" + originUrl + "> to <" + destinationUrl + ">.");

      if (clickedLinks[originUrl] == undefined) {
        clickedLinks[originUrl] = {};
      }
      if (clickedLinks[originUrl][destinationUrl] == undefined) {
        // TODO: Possibly set the value to a timestamp that can be used elsewhere
        // to determine if this is a recent click. This is probably necessary as
        // multiple calls to shouldLoad get made and we need a way to allow
        // multiple in a short window of time. Alternately, as it seems to always
        // be in order (repeats are always the same as the last), the last one
        // could be tracked and always allowed (or allowed within a small period
        // of time). This would have the advantage that we could delete items from
        // the clickedLinks object. One of these approaches would also reduce log
        // clutter, which would be good.
        clickedLinks[originUrl][destinationUrl] = true;
      }

      // Keep track of a destination-indexed map, as well.
      if (clickedLinksReverse[destinationUrl] == undefined) {
        clickedLinksReverse[destinationUrl] = {};
      }
      if (clickedLinksReverse[destinationUrl][originUrl] == undefined) {
        // TODO: Possibly set the value to a timestamp, as described above.
        clickedLinksReverse[destinationUrl][originUrl] = true;
      }
    },

    registerAllowedRedirect: function(originUrl, destinationUrl) {
      originUrl = DomainUtil.ensureUriHasPath(DomainUtil.stripFragment(originUrl));
      destinationUrl = DomainUtil.ensureUriHasPath(
          DomainUtil.stripFragment(destinationUrl));

      Logger.info(Logger.TYPE_INTERNAL, "User-allowed redirect from <" +
          originUrl + "> to <" + destinationUrl + ">.");

      if (userAllowedRedirects[originUrl] == undefined) {
        userAllowedRedirects[originUrl] = {};
      }
      if (userAllowedRedirects[originUrl][destinationUrl] == undefined) {
        userAllowedRedirects[originUrl][destinationUrl] = true;
      }
    },

    isAllowedRedirect: function(originURI, destURI) {
      var request = new RedirectRequest(originURI, destURI);
      return (true === checkRedirect(request).isAllowed);
    },

    /**
     * Add an observer to be notified of all blocked and allowed requests. TODO:
     * This should be made to accept instances of a defined interface.
     *
     * @param {Object} observer
     */
    addRequestObserver: function(observer) {
      if (!("observeBlockedRequest" in observer)) {
        throw "Observer passed to addRequestObserver does "
            + "not have an observeBlockedRequest() method.";
      }
      Logger.debug(Logger.TYPE_INTERNAL,
          "Adding request observer: " + observer.toString());
      requestObservers.push(observer);
    },

    /**
     * Remove an observer added through addRequestObserver().
     *
     * @param {Object} observer
     */
    removeRequestObserver: function(observer) {
      for (var i = 0; i < requestObservers.length; i++) {
        if (requestObservers[i] == observer) {
          Logger.debug(Logger.TYPE_INTERNAL,
              "Removing request observer: " + observer.toString());
          delete requestObservers[i];
          return;
        }
      }
      Logger.warning(Logger.TYPE_INTERNAL,
          "Could not find observer to remove " + "in removeRequestObserver()");
    },



    getDeniedRequests: function(currentlySelectedOrigin, allRequestsOnDocument) {
      Logger.dump("## getDeniedRequests");
      return _getRequestsHelper(currentlySelectedOrigin, allRequestsOnDocument,
          false);
    },

    getAllowedRequests: function(currentlySelectedOrigin, allRequestsOnDocument) {
      Logger.dump("## getAllowedRequests");
      return _getRequestsHelper(currentlySelectedOrigin, allRequestsOnDocument,
          true);
    },

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
     * @param {}
     *          document
     * @return {}
     *          RequestSet
     */
    getAllRequestsOnDocument: function(document) {
      //var origins = {};
      var reqSet = new RequestSet();

      // If we get these from the DOM, then we won't know the relevant
      // rules that were involved with allowing/denying the request.
      // Maybe just look up the allowed/blocked requests in the
      // main allowed/denied request sets before adding them.
      //_getOtherOriginsHelperFromDOM(document, reqSet);

      var documentURI = DomainUtil.stripFragment(document.documentURI);
      _addRecursivelyAllRequestsFromURI(documentURI, reqSet, {});
      return reqSet;
    }
  };

  return self;
}());
