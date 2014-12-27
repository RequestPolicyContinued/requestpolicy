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

const HTTPS_EVERYWHERE_REWRITE_TOPIC = "https-everywhere-uri-rewrite";

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "logger",
  "prefs",
  "policy-manager",
  "domain-util",
  "utils",
  "request",
  "request-result"
], this);
ScriptLoader.defineLazyModuleGetters({
  "requestpolicy-service": ["rpService"]
}, this);



let RequestProcessor = (function(self) {
  let internal = Utils.moduleInternal(self);


  /**
   * These are redirects that the user allowed when presented with a redirect
   * notification.
   */
  internal.userAllowedRedirects = {};

  internal.allowedRedirectsReverse = {};



  Utils.observeNotifications(
    // the observer
    {
      observe: function(subject, topic, data) {
        switch (topic) {
          case "http-on-examine-response":
            examineHttpResponse(subject);
            break;

          case HTTPS_EVERYWHERE_REWRITE_TOPIC:
            handleHttpsEverywhereUriRewrite(subject, data);
            break;
        }
      }
    },
    // observer topics
    [
      "http-on-examine-response",
      HTTPS_EVERYWHERE_REWRITE_TOPIC
    ]
  );






  function mapDestinations(origDestUri, newDestUri) {
    origDestUri = DomainUtil.stripFragment(origDestUri);
    newDestUri = DomainUtil.stripFragment(newDestUri);
    Logger.info(Logger.TYPE_INTERNAL,
        "Mapping destination <" + origDestUri + "> to <" + newDestUri + ">.");
    if (!internal.mappedDestinations[newDestUri]) {
      internal.mappedDestinations[newDestUri] = {};
    }
    internal.mappedDestinations[newDestUri][origDestUri] =
        DomainUtil.getUriObject(origDestUri);
  }

  /**
   * Handles observer notifications sent by the HTTPS Everywhere extension
   * that inform us of URIs that extension has rewritten.
   *
   * @param nsIURI oldURI
   * @param string newSpec
   */
  function handleHttpsEverywhereUriRewrite(oldURI, newSpec) {
    oldURI = oldURI.QueryInterface(Ci.nsIURI);
    mapDestinations(oldURI.spec, newSpec);
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
        return new RequestResult(true, REQUEST_REASON_COMPATIBILITY);
      }
    }

    var result = internal.checkByDefaultPolicy(originURI, destURI);
    return result;
  }


  self.isAllowedRedirect = function(originURI, destURI) {
    var request = new RedirectRequest(originURI, destURI);
    return (true === checkRedirect(request).isAllowed);
  };

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
      internal.recordAllowedRequest(originURI, destURI, false,
                                    request.requestResult);
      internal.allowedRedirectsReverse[destURI] = originURI;

      // If this was a link click or a form submission, we register an
      // additional click/submit with the original source but with a new
      // destination of the target of the redirect. This is because future
      // requests (such as using back/forward) might show up as directly from
      // the initial origin to the ultimate redirected destination.
      if (httpChannel.referrer) {
        var realOrigin = httpChannel.referrer.spec;

        if (internal.clickedLinks[realOrigin] &&
            internal.clickedLinks[realOrigin][originURI]) {
          Logger.warning(Logger.TYPE_HEADER_REDIRECT,
              "This redirect was from a link click." +
              " Registering an additional click to <" + destURI + "> " +
              "from <" + realOrigin + ">");
          self.registerLinkClicked(realOrigin, destURI);

        } else if (internal.submittedForms[realOrigin]
            && internal.submittedForms[realOrigin][originURI.split("?")[0]]) {
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

        /* start - do not edit here */
        let interfaceRequestor = httpChannel.notificationCallbacks
            .QueryInterface(Ci.nsIInterfaceRequestor);
        let loadContext = null;
        try {
          loadContext = interfaceRequestor.getInterface(Ci.nsILoadContext);
        } catch (ex) {
          try {
            loadContext = aSubject.loadGroup.notificationCallbacks
                .getInterface(Ci.nsILoadContext);
          } catch (ex2) {}
        }
        /*end do not edit here*/


        let browser;
        try {
          if (loadContext.topFrameElement) {
            // the top frame element should be already the browser element
            browser = loadContext.topFrameElement;
          } else {
            // we hope the associated window is available. in multiprocessor
            // firefox it's not available.
            browser = Utils.getBrowserForWindow(loadContext.topWindow);
          }
          // save all blocked redirects directly in the browser element. the
          // blocked elements will be checked later when the DOM content
          // finished loading.
          browser.requestpolicy = browser.requestpolicy || {blockedRedirects: {}};
          browser.requestpolicy.blockedRedirects[originURI] = destURI;
        } catch (e) {
          Logger.warning(Logger.TYPE_HEADER_REDIRECT, "The redirection's " +
                         "Load Context couldn't be found! " + e);
        }


        try {
          let contentDisp = httpChannel.getResponseHeader("Content-Disposition");
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
        while (initialOrigin in internal.allowedRedirectsReverse &&
               iterations++ < ASSUME_REDIRECT_LOOP) {
          initialDest = initialOrigin;
          initialOrigin = internal.allowedRedirectsReverse[initialOrigin];
        }

        if (initialOrigin in internal.clickedLinksReverse) {
          for (var i in internal.clickedLinksReverse[initialOrigin]) {
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
          internal.recordAllowedRequest(sourcePage, initialOrigin, true,
                                        request.requestResult);
        }

        // if (internal.submittedFormsReverse[initialOrigin]) {
        // // TODO: implement for form submissions whose redirects are blocked
        // }

        internal.recordRejectedRequest(request);
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

  function notifyRequestObserversOfBlockedLinkClickRedirect(sourcePageUri,
      linkDestUri, blockedRedirectUri) {
    for (var i = 0; i < internal.requestObservers.length; i++) {
      if (!internal.requestObservers[i]) {
        continue;
      }
      internal.requestObservers[i].observeBlockedLinkClickRedirect(
          sourcePageUri, linkDestUri, blockedRedirectUri);
    }
  }



  /**
   * Called after a response has been received from the web server. Headers are
   * available on the channel. The response can be accessed and modified via
   * nsITraceableChannel.
   */
  let examineHttpResponse = function(aSubject) {
    // Currently, if a user clicks a link to download a file and that link
    // redirects and is subsequently blocked, the user will see the blocked
    // destination in the menu. However, after they have allowed it from
    // the menu and attempted the download again, they won't see the allowed
    // request in the menu. Fixing that might be a pain and also runs the
    // risk of making the menu cluttered and confusing with destinations of
    // followed links from the current page.

    // TODO: Make user aware of blocked headers so they can allow them if
    // desired.

    var httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);

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
        // We can ignore the delay because we aren't manually doing
        // the refreshes. Allowed refreshes we still leave to the browser.
        // The dest may be empty if the origin is what should be refreshed.
        // This will be handled by DomainUtil.determineRedirectUri().
        var dest = DomainUtil.parseRefresh(refreshString).destURI;
      } catch (e) {
        Logger.warning(Logger.TYPE_HEADER_REDIRECT,
            "Invalid refresh header: <" + refreshString + ">");
        if (!Prefs.isBlockingDisabled()) {
          httpChannel.setResponseHeader(headerType, "", false);
        }
        return;
      }
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
      if (originPath == "/favicon.ico" || internal.faviconRequests[originURI]) {
        // If the redirected request is allowed, we need to know that was a
        // favicon request in case it is further redirected.
        internal.faviconRequests[dest] = true;
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
  };



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
        return callback.getInterface(Ci.nsILoadContext).isContent;
      } catch (e) {
      }
    }

    return false;
  }


  return self;
}(RequestProcessor || {}));
