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

// tslint:disable:member-ordering

import { App } from "app/interfaces";
import { XPCOM, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";
import {NormalRequest, RedirectRequest, Request} from "lib/classes/request";
import {
  RequestReason,
  RequestResult,
} from "lib/classes/request-result";
import { XPCOMObserverModule } from "lib/classes/xpcom-observer-module";
import * as Utils from "lib/utils/misc-utils";
import {
  getRequestHeaderFromHttpChannel,
  queryInterface,
} from "lib/utils/try-catch-utils";
import {CompatibilityRules} from "models/compatibility-rules";

// =============================================================================
// constants
// =============================================================================

// A value intended to not conflict with aExtra passed to shouldLoad() by any
// other callers. Was chosen randomly.
const CP_MAPPEDDESTINATION = 0x178c40bf;

// =============================================================================
// RequestProcessor
// =============================================================================

export class RequestProcessor extends Module {
  private readonly CP_OK = this.ci.nsIContentPolicy.ACCEPT;
  private readonly CP_REJECT = this.ci.nsIContentPolicy.REJECT_SERVER;

  /**
   * Number of elapsed milliseconds from the time of the last shouldLoad() call
   * at which the cached results of the last shouldLoad() call are discarded.
   *
   * @type {number}
   */
  private readonly lastShouldLoadCheckTimeout = 200;

  // Calls to shouldLoad appear to be repeated, so successive repeated calls and
  // their result (accept or reject) are tracked to avoid duplicate processing
  // and duplicate logging.
  /**
   * Object that caches the last shouldLoad
   * @type {Object}
   */
  private readonly lastShouldLoadCheck: {
    "origin": string | undefined | null,
    "destination": string | null,
    "time": number,
    "result": number | null,
  } = {
    destination: null,
    origin: null,
    result: null,
    time: 0,
  };

  private readonly historyRequests: any = {};

  private readonly observer = new XPCOMObserverModule(
      `${this.moduleName}.observer`,
      this.parentLog,
      {
        "http-on-modify-request": this.examineHttpRequest.bind(this),
        "https-everywhere-uri-rewrite": (
            subject: XPCOM.nsISupports,
            _: string,
            data: string,
        ) => {
          this.handleHttpsEverywhereUriRewrite(subject as XPCOM.nsIURI, data);
        },
      },
      this.observerService!,
  );

  protected get subModules() {
    return {
      observer: this.observer,
    };
  }

  protected get startupPreconditions() {
    return [
      this.rpPolicy.whenReady,
      this.httpChannelService.whenReady,
      this.requestService.whenReady,
      this.uriService.whenReady,
      this.cachedSettings.whenReady,
      this.requestMemory.whenReady,
      this.mm.whenReady,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      private readonly ci: XPCOM.nsXPCComponents_Interfaces,
      private readonly cr: XPCOM.nsXPCComponents_Results,
      private readonly observerService: XPCOM.nsIObserverService | null,
      private readonly rpPolicy: App.IPolicy,
      private readonly httpChannelService: App.services.IHttpChannelService,
      private readonly requestService: App.services.IRequestService,
      private readonly uriService: App.services.IUriService,
      private readonly cachedSettings: App.storage.ICachedSettings,
      private readonly requestMemory: App.webRequest.IRequestMemory,
      private readonly mm: App.webRequest.IMetadataMemory,
  ) {
    super("webRequest.requestProcessor", parentLog);
  }

  // ---------------------------------------------------------------------------
  // private functions
  // ---------------------------------------------------------------------------

  // We always call this from shouldLoad to reject a request.
  private reject(reason: string, request: NormalRequest) {
    this.log.log(`** BLOCKED ** reason: ${reason}. ` +
        `${request.detailsToString()}`);

    if (this.cachedSettings.alias.isBlockingDisabled()) {
      return this.CP_OK;
    }

    if (request.aContext) {
      // FIXME: `rpcontinuedBlocked` is probably not needed anymore.
      //        There's now `rpcontinuedIdentified`.
      // @ts-ignore
      request.aContext.rpcontinuedBlocked = true;
    }

    this.cacheShouldLoadResult(
        this.CP_REJECT,
        request.originURI,
        request.destURI,
    );
    this.requestMemory.notifyNewRequest({
      destUri: request.destURI,
      isAllowed: false,
      isInsert: false,
      originUri: request.originURI!,
      requestResult: request.requestResult,
    });

    if (this.ci.nsIContentPolicy.TYPE_DOCUMENT === request.aContentType) {
      // This was a blocked top-level document request. This may be due to
      // a blocked attempt by javascript to set the document location.

      const browser = this.requestService.getBrowser(request);
      const window = this.requestService.getChromeWindow(request);

      if (!browser || !window || typeof window.rpcontinued === "undefined") {
        this.log.warn("The user could not be notified " +
            "about the blocked top-level document request!");
      } else {
        window.rpcontinued.overlay.observeBlockedTopLevelDocRequest(
            browser, request.originURI, request.destURIWithRef,
        );
      }
    }

    return this.CP_REJECT;
  }

  // We only call this from shouldLoad when the request was a remote request
  // initiated by the content of a page. this is partly for efficiency. in other
  // cases we just return CP_OK rather than return this function which
  // ultimately returns CP_OK. Fourth param, "unforbidable", is set to true if
  // this request shouldn't be recorded as an allowed request.
  private accept(
      reason: string,
      request: NormalRequest,
      unforbidable?: boolean,
  ): number {
    this.log.log(
        `** ALLOWED ** reason: ${reason}. ${request.detailsToString()}`,
    );

    this.cacheShouldLoadResult(this.CP_OK, request.originURI, request.destURI);
    this.requestMemory.notifyNewRequest({
      destUri: request.destURI,
      isAllowed: true,
      isInsert: false,
      originUri: request.originURI!,
      requestResult: request.requestResult,
      unforbidable,
    });

    return this.CP_OK;
  }

  private cacheShouldLoadResult(
      result: number,
      originUri: string | undefined,
      destUri: string,
  ) {
    const date = new Date();
    this.lastShouldLoadCheck.time = date.getTime();
    this.lastShouldLoadCheck.destination = destUri;
    this.lastShouldLoadCheck.origin = originUri;
    this.lastShouldLoadCheck.result = result;
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
  private isDuplicateRequest(request: Request): boolean {
    if (this.lastShouldLoadCheck.origin === request.originURI &&
        this.lastShouldLoadCheck.destination === request.destURI) {
      const date = new Date();
      if (date.getTime() - this.lastShouldLoadCheck.time <
          this.lastShouldLoadCheckTimeout) {
        this.log.log(
            `Using cached shouldLoad() result of ` +
            `${this.lastShouldLoadCheck.result} for request to ` +
            `<${request.destURI}> from <${request.originURI}>.`,
        );
        return true;
      } else {
        this.log.log(
            `shouldLoad() cache expired for result of ` +
            `${this.lastShouldLoadCheck.result} for request to ` +
            `<${request.destURI}> from <${request.originURI}>.`,
        );
      }
    }
    return false;
  }

  private getDomNodeFromRequestContext(
      context: XPCOM.nsIDOMNode | XPCOM.nsIDOMWindow | XPCOM.nsISupports,
  ): XPCOM.nsIDOMNode | undefined {
    const result = queryInterface(context, this.ci.nsIDOMNode);
    if (!result.error) {
      return result.value as XPCOM.nsIDOMNode;
    }
    const e = result.error;
    if (e.result !== this.cr.NS_ERROR_NO_INTERFACE) {
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // public functions
  // ---------------------------------------------------------------------------

  public process(request: NormalRequest): number {
    // uncomment for debugging:
    // log.log("request: " +
    //              (request.aRequestOrigin ? request.aRequestOrigin.spec :
    //               "<unknown>") +
    //              " -->  "+request.aContentLocation.spec);
    // log.dir(request.aRequestOrigin);
    // log.dir(request.aContentLocation);
    try {
      if (this.requestService.isInternalRequest(request)) {
        this.log.log(`Allowing a request that seems to be internal. ` +
            `Origin: ${request.originURI}, Dest: ${request.destURI}`);
        return this.CP_OK;
      }

      let originURI: string = request.originURI!;
      let destURI = request.destURI;

      if (request.aRequestOrigin!.scheme === "moz-nullprincipal") {
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
                // tslint:disable-next-line:max-line-length
        //   -> https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrincipal
        //
        // * discussion about RequestPolicy with regard to detecting that
        //   something has been entered in the url-bar -- it's the Mozilla Bug
        //   about adding `aRequestPrincipal` to `shouldLoad()` and it's
        //   milestone was Firefox 16.
        //   -> https://bugzilla.mozilla.org/show_bug.cgi?id=767134#c15
        if (request.aRequestPrincipal) {
          this.log.log(
              `Allowing request that appears to be a URL entered in the ` +
              `location bar or some other good explanation: ${destURI}`,
          );
          this.requestMemory.removeSavedRequestsByOriginURI(destURI);
          return this.CP_OK;
        }
      }

      if (request.aRequestOrigin!.scheme === "view-source") {
        const newOriginURI = originURI.split(":").slice(1).join(":");
        this.log.log(
            `Considering view-source origin <${originURI}> ` +
            `to be origin <${newOriginURI}>`,
        );
        originURI = newOriginURI;
        request.setOriginURI(originURI, this.uriService);
      }

      if (request.aContentLocation.scheme === "view-source") {
        const newDestURI = destURI.split(":").slice(1).join(":");
        if (newDestURI.indexOf("data:text/html") === 0) {
          // "View Selection Source" has been clicked
          this.log.log(
              "Allowing \"data:text/html\" view-source destination" +
              " (Selection Source)",
          );
          return this.CP_OK;
        } else {
          this.log.log(
              `Considering view-source destination <${destURI}> ` +
              `to be destination <${newDestURI}>`,
          );
          destURI = newDestURI;
          request.setDestURI(destURI, this.uriService);
        }
      }

      if (originURI === "about:blank" && request.aContext) {
        const domNode = this.getDomNodeFromRequestContext(request.aContext);
        if (domNode && domNode.nodeType === this.ci.nsIDOMNode.DOCUMENT_NODE) {
          let newOriginURI;
          const docNode = request.aContext as any;
          if (docNode.documentURI &&
              docNode.documentURI !== "about:blank") {
            newOriginURI = docNode.documentURI;
          } else if (docNode.ownerDocument &&
              docNode.ownerDocument.documentURI &&
              docNode.ownerDocument.documentURI !== "about:blank") {
            newOriginURI = docNode.ownerDocument.documentURI;
          }
          if (newOriginURI) {
            newOriginURI = this.uriService.stripFragment(newOriginURI);
            this.log.log(`Considering origin <${originURI}> ` +
                `to be origin <${newOriginURI}>`);
            originURI = newOriginURI;
            request.setOriginURI(originURI, this.uriService);
          }
        }
      }

      if (this.isDuplicateRequest(request)) {
        return this.lastShouldLoadCheck.result!;
      }

      // Sometimes, clicking a link to a fragment will result in a request
      // where the origin is the same as the destination, but none of the
      // additional content of the page is again requested. The result is that
      // nothing ends up showing for blocked or allowed destinations because
      // all of that data was cleared due to the new request.
      // Example to test with: Click on "expand all" at
      // http://code.google.com/p/SOME_PROJECT/source/detail?r=SOME_REVISION
      if (originURI === destURI) {
        this.log.log(
            `Allowing (but not recording) request ` +
            `where origin is the same as the destination: ${originURI}`,
        );
        return this.CP_OK;
      }

      if (request.aContext) {
        const domNode = this.getDomNodeFromRequestContext(request.aContext);
        if (domNode && domNode.nodeName === "LINK" &&
            (((domNode as any) as HTMLLinkElement).rel === "icon" ||
            ((domNode as any) as HTMLLinkElement).rel === "shortcut icon")) {
          this.mm.FaviconRequests[destURI] = true;
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
      if (this.mm.ClickedLinks[originURI] &&
          this.mm.ClickedLinks[originURI][destURI]) {
        // Don't delete the clickedLinks item. We need it for if the user
        // goes back/forward through their history.
        // delete this.mm.ClickedLinks[originURI][destURI];

        // We used to have this not be recorded so that it wouldn't cause us
        // to forget blocked/allowed requests. However, when a policy change
        // causes a page refresh after a link click, it looks like a link
        // click again and so if we don't forget the previous blocked/allowed
        // requests, the menu becomes inaccurate. Now the question is: what
        // are we breaking by clearing the blocked/allowed requests here?
        request.requestResult = new RequestResult(true,
            RequestReason.LinkClick);
        return this.accept("User-initiated request by link click", request);
      } else if (this.mm.SubmittedForms[originURI] &&
          this.mm.SubmittedForms[originURI][destURI.split("?")[0]]) {
        // Note: we dropped the query string from the destURI because form GET
        // requests will have that added on here but the original action of
        // the form may not have had it.
        // Don't delete the clickedLinks item. We need it for if the user
        // goes back/forward through their history.
        // delete this.mm.SubmittedForms[originURI][destURI.split("?")[0]];

        // See the note above for link clicks and forgetting blocked/allowed
        // requests on refresh. I haven't tested if it's the same for forms
        // but it should be so we're making the same change here.
        request.requestResult = new RequestResult(true,
            RequestReason.FormSubmission);
        return this.accept(
            "User-initiated request by form submission", request,
        );
      } else if (this.historyRequests[destURI]) {
        // When the user goes back and forward in their history, a request for
        // the url comes through but is not followed by requests for any of
        // the page's content. Therefore, we make sure that our cache of
        // blocked requests isn't removed in this case.
        delete this.historyRequests[destURI];
        request.requestResult = new RequestResult(true,
            RequestReason.HistoryRequest);
        return this.accept("History request", request, true);
      } else if (this.mm.UserAllowedRedirects[originURI] &&
          this.mm.UserAllowedRedirects[originURI][destURI]) {
        // shouldLoad is called by location.href in overlay.js as of Fx
        // 3.7a5pre and SeaMonkey 2.1a.
        request.requestResult = new RequestResult(true,
            RequestReason.UserAllowedRedirect);
        return this.accept("User-allowed redirect", request, true);
      }

      const originHost = this.uriService.
          getHostByUriObj(request.aRequestOrigin!);

      if (request.aRequestOrigin!.scheme === "chrome") {
        if (originHost === "browser") {
          // "browser" origin shows up for favicon.ico and an address entered
          // in address bar.
          request.requestResult = new RequestResult(true,
              RequestReason.UserAction);
          return this.accept(
              "User action (e.g. address entered in address bar) " +
              "or other good explanation (e.g. new window/tab opened)",
              request,
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
          return this.accept(
              "User action (e.g. address entered in address bar) " +
              "or other good explanation (e.g. new window/tab opened)",
              request,
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
        const domNode = this.getDomNodeFromRequestContext(request.aContext);
        if (domNode && domNode.nodeName === "xul:browser" &&
            (domNode as XUL.browser).currentURI &&
            (domNode as XUL.browser).currentURI.spec === "about:blank") {
          request.requestResult = new RequestResult(true,
              RequestReason.NewWindow);
          return this.accept("New window (should probably only be an allowed " +
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
      const originIdent = this.uriService.getIdentifier(originURI);
      const destIdent = this.uriService.getIdentifier(destURI);
      if (originIdent === destIdent &&
          originIdent !== null && destIdent !== null) {
        request.requestResult = new RequestResult(true,
            RequestReason.IdenticalIdentifier);
        return this.accept(
            `Allowing request where origin protocol, host, and port are the` +
            ` same as the destination: ${originIdent}`, request,
        );
      }

      request.requestResult = this.rpPolicy.checkRequestAgainstUserRules(
          request.aRequestOrigin!, request.aContentLocation,
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
        const {conflictCanBeResolved, shouldAllow,
        } = request.requestResult.resolveConflict();
        if (conflictCanBeResolved) {
          request.requestResult.resultReason = RequestReason.UserPolicy;
          request.requestResult.isAllowed = shouldAllow;
          if (shouldAllow) {
            return this.accept("Allowed by user policy", request);
          } else {
            return this.reject("Blocked by user policy", request);
          }
        }
        request.requestResult.resultReason =
            RequestReason.DefaultPolicyInconsistentRules;
        if (this.cachedSettings.alias.isDefaultAllow()) {
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
        request.requestResult.resultReason = RequestReason.UserPolicy;
        request.requestResult.isAllowed = true;
        return this.accept("Allowed by user policy", request);
      }
      if (request.requestResult.denyRulesExist()) {
        request.requestResult.resultReason = RequestReason.UserPolicy;
        request.requestResult.isAllowed = false;
        return this.reject("Blocked by user policy", request);
      }

      request.requestResult = this.rpPolicy.
          checkRequestAgainstSubscriptionRules(request.aRequestOrigin!,
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
        const {conflictCanBeResolved, shouldAllow,
        } = request.requestResult.resolveConflict();
        if (conflictCanBeResolved) {
          request.requestResult.resultReason =
              RequestReason.SubscriptionPolicy;
          request.requestResult.isAllowed = shouldAllow;
          if (shouldAllow) {
            return this.accept("Allowed by subscription policy", request);
          } else {
            return this.reject("Blocked by subscription policy", request);
          }
        }
        request.requestResult.resultReason =
            RequestReason.DefaultPolicyInconsistentRules;
        if (this.cachedSettings.alias.isDefaultAllow()) {
          request.requestResult.isAllowed = true;
          return this.accept(
              "Subscription rules indicate both allow and block. " +
              "Using default allow policy", request,
          );
        } else {
          request.requestResult.isAllowed = false;
          return this.reject(
              "Subscription rules indicate both allow and block. " +
              "Using default block policy",
              request,
          );
        }
      }
      if (request.requestResult.denyRulesExist()) {
        request.requestResult.resultReason =
            RequestReason.SubscriptionPolicy;
        request.requestResult.isAllowed = false;
        return this.reject("Blocked by subscription policy", request);
      }
      if (request.requestResult.allowRulesExist()) {
        request.requestResult.resultReason =
            RequestReason.SubscriptionPolicy;
        request.requestResult.isAllowed = true;
        return this.accept("Allowed by subscription policy", request);
      }

      for (const rule of CompatibilityRules) {
        const allowOrigin = rule.origin ? originURI.startsWith(rule.origin) :
          true;
        const allowDest = rule.dest ? destURI.startsWith(rule.dest) : true;
        if (allowOrigin && allowDest) {
          request.requestResult = new RequestResult(true,
              RequestReason.Compatibility);
          return this.accept(
              `Extension/application compatibility rule matched [${rule.info}]`,
              request, true,
          );
        }
      }

      if (request.aContext) {
        const info = CompatibilityRules.checkBaseUriWhitelist(
            ((request.aContext as any) as Node).baseURI!,
        );
        if (info.isWhitelisted) {
          request.requestResult = new RequestResult(true,
              RequestReason.Compatibility);
          return this.accept(
              `Extension/application compatibility rule matched ` +
              `[${info.addonNames}]`, request, true,
          );
        }
      }

      // If the destination has a mapping (i.e. it was originally a different
      // destination but was changed into the current one), accept this
      // request if the original destination would have been accepted.
      // Check aExtra against CP_MAPPEDDESTINATION to stop further recursion.
      if (request.aExtra !== CP_MAPPEDDESTINATION &&
          this.mm.MappedDestinations[destURI]) {
        // tslint:disable-next-line:forin
        for (const mappedDest in this.mm.MappedDestinations[destURI]) {
          const mappedDestUriObj =
              this.mm.MappedDestinations[destURI][mappedDest];
          this.log.log(`Checking mapped destination: ${mappedDest}`);
          const mappedResult = this.process(new NormalRequest(
              request.aContentType, mappedDestUriObj, request.aRequestOrigin,
              request.aContext, request.aMimeTypeGuess, CP_MAPPEDDESTINATION,
              undefined,
          ));
          if (mappedResult === this.CP_OK) {
            return this.CP_OK;
          }
        }
      }

      request.requestResult = this.requestService.checkByDefaultPolicy(request);
      if (request.requestResult.isAllowed) {
        return this.accept("Allowed by default policy", request);
      } else {
        // We didn't match any of the conditions in which to allow the request,
        // so reject it.
        return request.aExtra === CP_MAPPEDDESTINATION ?
          this.CP_REJECT :
          this.reject("Denied by default policy", request);
      }
    } catch (e) {
      this.log.error("Fatal Error:", e);
      if (this.cachedSettings.alias.isBlockingDisabled()) {
        this.log.warn("Allowing request due to internal error.");
        return this.CP_OK;
      }
      this.log.warn("Rejecting request due to internal error.");
      return this.CP_REJECT;
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
  public examineHttpRequest(aSubject: XPCOM.nsISupports) {
    const httpChannel =
        aSubject.QueryInterface<XPCOM.nsIHttpChannel>(this.ci.nsIHttpChannel);
    const result = getRequestHeaderFromHttpChannel(httpChannel, "X-moz");
    // Determine if prefetch requests are slipping through.
    if (result.value === "prefetch") {
      // Seems to be too late to block it at this point. Calling the
      // cancel(status) method didn't stop it.
      this.log.warn(
          `Discovered prefetch request being sent to: ${httpChannel.name}`,
      );
    }
  }

  public registerHistoryRequest(destinationUrl: string) {
    destinationUrl = this.uriService.ensureUriHasPath(
        this.uriService.stripFragment(destinationUrl),
    );
    this.historyRequests[destinationUrl] = true;
    this.log.info(`History item requested: <${destinationUrl}>.`);
  }

  public registerFormSubmitted(
      originUrl: string,
      destinationUrl: string,
  ) {
    originUrl = this.uriService.ensureUriHasPath(
        this.uriService.stripFragment(originUrl),
    );
    destinationUrl = this.uriService.ensureUriHasPath(
        this.uriService.stripFragment(destinationUrl),
    );

    this.log.info(
        `Form submitted from <${originUrl}> to <${destinationUrl}>.`,
    );

    // Drop the query string from the destination url because form GET requests
    // will end up with a query string on them when shouldLoad is called, so
    // we'll need to be dropping the query string there.
    destinationUrl = destinationUrl.split("?")[0];

    if (this.mm.SubmittedForms[originUrl] === undefined) {
      this.mm.SubmittedForms[originUrl] = {};
    }
    if (this.mm.SubmittedForms[originUrl][destinationUrl] === undefined) {
      // TODO: See timestamp note for registerLinkClicked.
      this.mm.SubmittedForms[originUrl][destinationUrl] = true;
    }

    // Keep track of a destination-indexed map, as well.
    if (this.mm.SubmittedFormsReverse[destinationUrl] === undefined) {
      this.mm.SubmittedFormsReverse[destinationUrl] = {};
    }
    if (this.mm.SubmittedFormsReverse[destinationUrl][originUrl]
        === undefined) {
      // TODO: See timestamp note for registerLinkClicked.
      this.mm.SubmittedFormsReverse[destinationUrl][originUrl] = true;
    }
  }

  public registerLinkClicked(
      originUrl: string,
      destinationUrl: string,
  ) {
    originUrl = this.uriService.ensureUriHasPath(
        this.uriService.stripFragment(originUrl),
    );
    destinationUrl = this.uriService.ensureUriHasPath(
        this.uriService.stripFragment(destinationUrl),
    );

    this.log.info(
        `Link clicked from <${originUrl}> to <${destinationUrl}>.`,
    );

    if (this.mm.ClickedLinks[originUrl] === undefined) {
      this.mm.ClickedLinks[originUrl] = {};
    }
    if (this.mm.ClickedLinks[originUrl][destinationUrl] === undefined) {
      // TODO: Possibly set the value to a timestamp that can be used elsewhere
      // to determine if this is a recent click. This is probably necessary as
      // multiple calls to shouldLoad get made and we need a way to allow
      // multiple in a short window of time. Alternately, as it seems to always
      // be in order (repeats are always the same as the last), the last one
      // could be tracked and always allowed (or allowed within a small period
      // of time). This would have the advantage that we could delete items from
      // the clickedLinks object. One of these approaches would also reduce log
      // clutter, which would be good.
      this.mm.ClickedLinks[originUrl][destinationUrl] = true;
    }

    // Keep track of a destination-indexed map, as well.
    if (this.mm.ClickedLinksReverse[destinationUrl] === undefined) {
      this.mm.ClickedLinksReverse[destinationUrl] = {};
    }
    if (this.mm.ClickedLinksReverse[destinationUrl][originUrl] === undefined) {
      // TODO: Possibly set the value to a timestamp, as described above.
      this.mm.ClickedLinksReverse[destinationUrl][originUrl] = true;
    }
  }

  public registerAllowedRedirect(
      originUrl: string,
      destinationUrl: string,
  ) {
    originUrl = this.uriService.ensureUriHasPath(
        this.uriService.stripFragment(originUrl),
    );
    destinationUrl = this.uriService.ensureUriHasPath(
        this.uriService.stripFragment(destinationUrl),
    );

    this.log.info(
        `User-allowed redirect from ` +
        `<${originUrl}> to <${destinationUrl}>.`,
    );

    if (this.mm.UserAllowedRedirects[originUrl] === undefined) {
      this.mm.UserAllowedRedirects[originUrl] = {};
    }
    if (this.mm.UserAllowedRedirects[originUrl][destinationUrl] === undefined) {
      this.mm.UserAllowedRedirects[originUrl][destinationUrl] = true;
    }
  }

  // ===========================================================================
  // RequestProcessor (redirections part)
  // ===========================================================================

  private mapDestinations(
      origDestUri: string,
      newDestUri: string,
  ) {
    origDestUri = this.uriService.stripFragment(origDestUri);
    newDestUri = this.uriService.stripFragment(newDestUri);
    this.log.info(
        `Mapping destination <${origDestUri}> to <${newDestUri}>.`,
    );
    if (!this.mm.MappedDestinations[newDestUri]) {
      this.mm.MappedDestinations[newDestUri] = {};
    }
    this.mm.MappedDestinations[newDestUri][origDestUri] =
        this.uriService.getUriObject(origDestUri);
  }

  /**
   * Handles observer notifications sent by the HTTPS Everywhere extension
   * that inform us of URIs that extension has rewritten.
   */
  private handleHttpsEverywhereUriRewrite(
      aOldURI: XPCOM.nsIURI,
      aNewSpec: string,
  ) {
    const oldURI = aOldURI.QueryInterface<XPCOM.nsIURI>(this.ci.nsIURI);
    this.mapDestinations(oldURI.spec, aNewSpec);
  }

  private checkRedirect(request: Request) {
    // TODO: Find a way to get rid of repitition of code between this and
    // shouldLoad().

    // Note: If changing the logic here, also make necessary changes to
    // shouldLoad().

    // This is not including link clicks, form submissions, and user-allowed
    // redirects.

    const originURI = request.originURI!;
    const destURI = request.destURI;

    const originURIObj = this.uriService.getUriObject(originURI);
    const destURIObj = this.uriService.getUriObject(destURI);

    {
      const result = this.rpPolicy.checkRequestAgainstUserRules(originURIObj,
          destURIObj);
      if (result.denyRulesExist() && result.allowRulesExist()) {
        const {conflictCanBeResolved, shouldAllow} = result.resolveConflict();
        result.isAllowed = conflictCanBeResolved ? shouldAllow :
          this.cachedSettings.alias.isDefaultAllow();
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
      const result = this.rpPolicy.checkRequestAgainstSubscriptionRules(
          originURIObj, destURIObj,
      );
      if (result.denyRulesExist() && result.allowRulesExist()) {
        const {conflictCanBeResolved, shouldAllow} = result.resolveConflict();
        result.isAllowed = conflictCanBeResolved ? shouldAllow :
          this.cachedSettings.alias.isDefaultAllow();
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

    for (const rule of CompatibilityRules) {
      const allowOrigin = rule.origin ?
          originURI.startsWith(rule.origin) : true;
      const allowDest = rule.dest ? destURI.startsWith(rule.dest) : true;
      if (allowOrigin && allowDest) {
        return new RequestResult(true, RequestReason.Compatibility);
      }
    }

    {
      const result = this.requestService.checkByDefaultPolicy(request);
      return result;
    }
  }

  public isAllowedRedirect(originURI: string, destURI: string) {
    const request = new Request(originURI, destURI);
    return true === this.checkRedirect(request).isAllowed;
  }

  public processUrlRedirection(request: RedirectRequest) {
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
    if (this.requestService.isInternalRequest(request)) {
      this.log.log(
          `Allowing a redirection that seems to be internal. ` +
          `Origin: ${request.originURI}, Dest: ${request.destURI}`,
      );
      return this.CP_OK;
    }

    const originURI = request.originURI!;
    const destURI = request.destURI;

    // Allow redirects of requests from privileged code.
    // FIXME: should the check instead be ' === false' in case the
    //        return value is `null`? See also #18.
    if (!this.isContentRequest(request)) {
      // However, favicon requests that are redirected appear as non-content
      // requests. So, check if the original request was for a favicon.
      const originPath = request.originUriObj.path;
      // We always have to check "/favicon.ico" because Firefox will use this
      // as a default path and that request won't pass through shouldLoad().
      if (originPath === "/favicon.ico" ||
          this.mm.FaviconRequests[originURI]) {
        // If the redirected request is allowed, we need to know that was a
        // favicon request in case it is further redirected.
        this.mm.FaviconRequests[destURI] = true;
        this.log.info(
            `Redirection from <${originURI}> to <${destURI}> ` +
            `appears to be a redirected favicon request. ` +
            `This will be treated as a content request.`,
        );
      } else {
        this.log.warn(
            `** ALLOWED ** redirection from <${originURI}> ` +
            `to <${destURI}>. ` +
            `Original request is from privileged code.`,
        );
        return this.CP_OK;
      }
    }

    // Ignore redirects to javascript. The browser will ignore them, as well.
    if (request.destUriObj.schemeIs("javascript")) {
      this.log.warn(
          `Ignoring redirect to javascript URI <${destURI}>`,
      );
      return this.CP_OK;
    }

    request.requestResult = this.checkRedirect(request);
    if (true === request.requestResult.isAllowed) {
      this.log.warn(
          `** ALLOWED ** redirection from <${originURI}> ` +
          `to <${destURI}>. ` +
          `Same hosts or allowed origin/destination.`,
      );
      this.requestMemory.notifyNewRequest({
        destUri: destURI,
        isAllowed: true,
        isInsert: false,
        originUri: originURI,
        requestResult: request.requestResult,
      });
      this.mm.AllowedRedirectsReverse[destURI] = originURI;

      // If this was a link click or a form submission, we register an
      // additional click/submit with the original source but with a new
      // destination of the target of the redirect. This is because future
      // requests (such as using back/forward) might show up as directly from
      // the initial origin to the ultimate redirected destination.
      if (request.oldChannel.httpChannel.referrer) {
        const realOrigin = request.oldChannel.httpChannel.referrer.spec;

        if (this.mm.ClickedLinks[realOrigin] &&
            this.mm.ClickedLinks[realOrigin][originURI]) {
          this.log.log(
              `${"This redirect was from a link click." +
              " Registering an additional click to <"}${destURI}> ` +
              `from <${realOrigin}>`,
          );
          this.registerLinkClicked(realOrigin, destURI);
        } else if (this.mm.SubmittedForms[realOrigin] &&
            this.mm.SubmittedForms[realOrigin][originURI.split("?")[0]]) {
          this.log.log(
              `${"This redirect was from a form submission." +
              " Registering an additional form submission to <"}${destURI
              }> ` + `from <${realOrigin}>`,
          );
          this.registerFormSubmitted(realOrigin, destURI);
        }
      }

      return this.CP_OK;
    }

    // The header isn't allowed, so remove it.
    try {
      if (this.cachedSettings.alias.isBlockingDisabled()) {
        return this.CP_OK;
      }

      this.maybeShowRedirectNotification(request);

      // We try to trace the blocked redirect back to a link click or form
      // submission if we can. It may indicate, for example, a link that
      // was to download a file but a redirect got blocked at some point.
      // Example:
      //   "link click" -> "first redirect" -> "second redirect"
      {
        const initialOrigin = this.getOriginOfInitialRedirect(request);

        if (this.mm.ClickedLinksReverse.hasOwnProperty(initialOrigin)) {
          const linkClickDest = initialOrigin;
          let linkClickOrigin: string;

          // fixme: bad smell! the same link (linkClickDest) could have
          //        been clicked from different origins!
          for (const i in this.mm.ClickedLinksReverse[linkClickDest]) {
            if (this.mm.ClickedLinksReverse[linkClickDest].
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
          this.requestMemory.notifyNewRequest({
            destUri: linkClickDest,
            isAllowed: true,
            isInsert: true,
            originUri: linkClickOrigin!,
            requestResult: request.requestResult,
          });
        }

        // TODO: implement for form submissions whose redirects are blocked
        // if (SubmittedFormsReverse[initialOrigin]) {
        // }
      }

      this.requestMemory.notifyNewRequest({
        destUri: request.destURI,
        isAllowed: false,
        isInsert: false,
        originUri: request.originURI!,
        requestResult: request.requestResult,
      });

      this.log.warn(
          `** BLOCKED ** redirection from <${originURI}> ` +
          `to <${destURI}>.`,
      );
      return this.CP_REJECT;
    } catch (e) {
      this.log.error("Fatal Error:", e);
      if (this.cachedSettings.alias.isBlockingDisabled()) {
        this.log.warn("Allowing request due to internal error.");
        return this.CP_OK;
      }
      this.log.warn("Rejecting request due to internal error.");
      return this.CP_REJECT;
    }
  }

  private showRedirectNotification(request: RedirectRequest) {
    const browser = this.requestService.getBrowser(request);
    if (browser === null) {
      return false;
    }

    const window = browser.ownerGlobal;

    Utils.tryMultipleTimes(() => {
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

  private maybeShowRedirectNotification(aRequest: RedirectRequest) {
    // Check if the request corresponds to a top-level document load.
    {
      const {loadFlags} = aRequest;
      const topLevelDocFlag = this.ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI;

      // tslint:disable-next-line:no-bitwise
      if ((loadFlags & topLevelDocFlag) !== topLevelDocFlag) {
        return;
      }
    }

    const rv = this.showRedirectNotification(aRequest);
    if (true !== rv) {
      this.log.warn(
          `${"A redirection of a top-level document has been observed, " +
          "but it was not possible to notify the user! The redirection " +
          "was from page <"}${aRequest.originURI}> ` +
          `to <${aRequest.destURI}>.`,
      );
    }
  }

  private getOriginOfInitialRedirect(aRequest: RedirectRequest): string {
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
      if (!this.mm.AllowedRedirectsReverse.hasOwnProperty(initialOrigin)) {
        // break the loop
        break;
      }

      initialDest = initialOrigin;
      initialOrigin = this.mm.AllowedRedirectsReverse[initialOrigin];
    }

    return initialOrigin;
  }

  /**
   * Checks whether a request is initiated by a content window. If it's from a
   * content window, then it's from unprivileged code.
   */
  private isContentRequest(request: RedirectRequest): boolean {
    const loadContext = this.httpChannelService.
        getLoadContext(request.oldChannel);

    if (loadContext === null) {
      return false;
    }

    return !!loadContext.isContent;
  }
}
