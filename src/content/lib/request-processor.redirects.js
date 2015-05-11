/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/logger",
  "lib/prefs",
  "lib/policy-manager",
  "lib/utils/domains",
  "lib/utils",
  "lib/request",
  "lib/request-result",
  "lib/http-response",
  "lib/environment"
], this);



let RequestProcessor = (function(self) {
  let internal = Utils.moduleInternal(self);


  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cr = Components.results;
  const Cu = Components.utils;


  /**
   * These are redirects that the user allowed when presented with a redirect
   * notification.
   */
  internal.userAllowedRedirects = {};

  internal.allowedRedirectsReverse = {};



  ProcessEnvironment.obMan.observe(
      ["http-on-examine-response"],
      function(subject) {
        examineHttpResponse(subject);
      });
  ProcessEnvironment.obMan.observe(
      [HTTPS_EVERYWHERE_REWRITE_TOPIC],
      function(subject, topic, data) {
        handleHttpsEverywhereUriRewrite(subject, data);
      });



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

    let compatibilityRules = self.getCompatibilityRules();
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
    var request = new Request(originURI, destURI);
    return (true === checkRedirect(request).isAllowed);
  };



  function processUrlRedirection(request) {
    let httpResponse = request.httpResponse;
    let httpChannel = httpResponse.httpChannel;
    var originURI = request.originURI;
    var destURI = request.destURI;
    var headerType = httpResponse.redirHeaderType;

    // Ignore redirects to javascript. The browser will ignore them, as well.
    if (httpResponse.destURI.schemeIs("javascript")) {
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
        httpResponse.removeResponseHeader();

        let browser = request.browser;

        if (browser !== null) {
          // `browser` is null if it could not be found. One known
          // example is a favicon request that is redirected.

          // TODO: do not put data into the <browser> object. Maybe use
          //       Map instead?

          // save all blocked redirects directly in the browser element. the
          // blocked elements will be checked later when the DOM content
          // finished loading.
          browser.requestpolicy = browser.requestpolicy || {blockedRedirects: {}};
          browser.requestpolicy.blockedRedirects[originURI] = destURI;
        }

        // Cancel the request. As of Fx 37, this causes the location bar to
        // show the URL of the previously displayed page.
        httpChannel.cancel(Cr.NS_BINDING_ABORTED);

        eventuallyShowRedirectNotification(request);

        // We try to trace the blocked redirect back to a link click or form
        // submission if we can. It may indicate, for example, a link that
        // was to download a file but a redirect got blocked at some point.
        // Example:
        //   "link click" -> "first redirect" -> "second redirect"
        {
          let initialOrigin = getOriginOfInitialRedirect(request);

          if (internal.clickedLinksReverse.hasOwnProperty(initialOrigin)) {
            let linkClickDest = initialOrigin;
            let linkClickOrigin;

            // fixme: bad smell! the same link (linkClickDest) could have
            //        been clicked from different origins!
            for (let i in internal.clickedLinksReverse[linkClickDest]) {
              // We hope there's only one possibility of a source page (that is,
              // ideally there will be one iteration of this loop).
              linkClickOrigin = i;
            }

            // TODO: #633 - Review the following line (recordAllowedRequest).

            // Maybe we just record the clicked link and each step in between as
            // an allowed request, and the final blocked one as a blocked request.
            // That is, make it show up in the requestpolicy menu like anything
            // else.
            // We set the "isInsert" parameter so we don't clobber the existing
            // info about allowed and deleted requests.
            internal.recordAllowedRequest(linkClickOrigin, linkClickDest, true,
                                          request.requestResult);
          }

          // TODO: implement for form submissions whose redirects are blocked
          //if (internal.submittedFormsReverse[initialOrigin]) {
          //}
        }

        internal.recordRejectedRequest(request);
      }
      Logger.warning(Logger.TYPE_HEADER_REDIRECT,
          "** BLOCKED ** '" + headerType + "' header to <" + destURI + ">" +
          " found in response from <" + originURI + ">");
    } catch (e) {
      Logger.severe(
          Logger.TYPE_HEADER_REDIRECT, "Failed removing " +
          "'" + headerType + "' header to <" + destURI + ">" +
          "  in response from <" + originURI + ">. " + e, e);
    }
  }

  function showRedirectNotification(request) {
    let browser = request.browser;
    if (browser === null) {
      return false;
    }

    var window = browser.ownerGlobal;

    Utils.tryMultipleTimes(function() {
      var showNotification = Utils.getObjectPath(window, 'requestpolicy',
          'overlay', '_showRedirectNotification');
      if (!showNotification) {
        return false;
      }
      return showNotification(browser, request.destURI, 0, request.originURI);
    });
    return true;
  }

  /**
   * @param {RedirectRequest} aRequest
   */
  function eventuallyShowRedirectNotification(aRequest) {
    var httpResponse = aRequest.httpResponse;

    // Check whether the request is associated with a `document` element.
    {
      let docShell = httpResponse.docShell;

      if (docShell === null) {
        return;
      }

      let busyFlags = docShell.busyFlags;
      const expectedFlags = Ci.nsIDocShell.BUSY_FLAGS_BUSY
          | Ci.nsIDocShell.BUSY_FLAGS_BEFORE_PAGE_LOAD;

      // The document is loading AND nothing has been received yet.
      let isDocumentRequest = (busyFlags & expectedFlags) === expectedFlags;

      if (isDocumentRequest === false) {
        // This is probably a redirect of an "inline" element, e.g. <img>.
        return;
      }
    }

    // Check whether it's the top-level document that is being loaded.
    {
      let loadContext = httpResponse.loadContext;

      if (loadContext === null) {
        return;
      }

      if (loadContext.associatedWindow !== loadContext.topWindow) {
        // this request belongs to a sub-document, e.g. an iframe.
        return;
      }
    }

    showRedirectNotification(aRequest) || Logger.warning(
        Logger.TYPE_HEADER_REDIRECT,
        "A redirection of a top-level document has been observed, " +
        "but it was not possible to notify the user! The redirection " +
        "was from page <" + request.originURI + "> " +
        "to <" + request.destURI + ">.");
  }

  /**
   * @param {RedirectRequest} aRequest
   */
  function getOriginOfInitialRedirect(aRequest) {
    var initialOrigin = aRequest.originURI;
    var initialDest = aRequest.destURI;

    // Prevent infinite loops, that is, bound the number of iterations.
    // Note: An apparent redirect loop doesn't mean a problem with a
    //       website as the site may be using other information,
    //       such as cookies that get set in the redirection process,
    //       to stop the redirection.
    const ASSUME_REDIRECT_LOOP = 100; // Chosen arbitrarily.

    for (let i = 0; i < ASSUME_REDIRECT_LOOP; ++i) {
      if (false === (initialOrigin in internal.allowedRedirectsReverse)) {
        // break the loop
        break;
      }

      initialDest = initialOrigin;
      initialOrigin = internal.allowedRedirectsReverse[initialOrigin];
    }

    return initialOrigin;
  }




  /**
   * Called after a response has been received from the web server. Headers are
   * available on the channel. The response can be accessed and modified via
   * nsITraceableChannel.
   */
  function examineHttpResponse(aSubject) {
    // Currently, if a user clicks a link to download a file and that link
    // redirects and is subsequently blocked, the user will see the blocked
    // destination in the menu. However, after they have allowed it from
    // the menu and attempted the download again, they won't see the allowed
    // request in the menu. Fixing that might be a pain and also runs the
    // risk of making the menu cluttered and confusing with destinations of
    // followed links from the current page.

    // TODO: Make user aware of blocked headers so they can allow them if
    // desired.

    let httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);
    let httpResponse = new HttpResponse(httpChannel);

    // the "raw" dest string might be a relative or absolute URI
    let rawDestString = httpResponse.rawDestString;

    if (httpResponse.containsRedirection === false || rawDestString === null) {
      return;
    }

    let originString = httpResponse.originURI.specIgnoringRef;

    // Allow redirects of requests from privileged code.
    if (!isContentRequest(httpResponse)) {
      // However, favicon requests that are redirected appear as non-content
      // requests. So, check if the original request was for a favicon.
      var originPath = httpResponse.originURI.path;
      // We always have to check "/favicon.ico" because Firefox will use this
      // as a default path and that request won't pass through shouldLoad().
      if (originPath == "/favicon.ico" || internal.faviconRequests[originString]) {
        // If the redirected request is allowed, we need to know that was a
        // favicon request in case it is further redirected.
        internal.faviconRequests[rawDestString] = true;
        Logger.info(Logger.TYPE_HEADER_REDIRECT, "'" + httpResponse.redirHeaderType
                + "' header to <" + rawDestString + "> " + "from <" + originString
                + "> appears to be a redirected favicon request. "
                + "This will be treated as a content request.");
      } else {
        Logger.warning(Logger.TYPE_HEADER_REDIRECT,
            "** ALLOWED ** '" + httpResponse.redirHeaderType +
            "' header to <" + rawDestString + "> " +
            "from <" + originString +
            ">. Original request is from privileged code.");
        return;
      }
    }

    var request = new RedirectRequest(httpResponse);
    processUrlRedirection(request);
  };



  /**
   * Checks whether a request is initiated by a content window. If it's from a
   * content window, then it's from unprivileged code.
   */
  function isContentRequest(httpResponse) {
    let loadContext = httpResponse.loadContext;

    if (loadContext === null) {
      return false;
    }

    return !!loadContext.isContent;
  }


  return self;
}(RequestProcessor || {}));
