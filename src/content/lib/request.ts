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

import {rp} from "app/app.background";
import { log } from "app/log";
import {HttpChannelWrapper} from "lib/http-channel-wrapper";
import {
  RequestReason,
  RequestResult,
} from "lib/request-result";
import {queryInterface } from "lib/utils/try-catch-utils";
import * as WindowUtils from "lib/utils/window-utils";
import { JSMs, XPCOM, XUL } from "bootstrap/api/interfaces";

const logRequests = log.extend({
  enabledCondition: {type: "C", C: "LOG_REQUESTS"},
  level: "all",
  name: "Requests",
});

const uriService = rp.services.uri;

declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Services: JSMs.Services;

// =============================================================================
// constants
// =============================================================================

const INTERNAL_SCHEMES = new Set([
  "resource",
  "about",
  "chrome",
  "moz-extension",
  "moz-icon",
  "moz-filedata",
]);

const WHITELISTED_DESTINATION_SCHEMES = new Set([
  "data",
  "blob",
  "wyciwyg",
  "javascript",
]);

const DEFAULT_ALLOWED_SCHEMES = new Set([
  "moz-extension",
]);

const DEFAULT_ALLOWED_DESTINATION_RESOURCE_URIS = new Set([
  // Viewing resources (text files, images, etc.) directly in a tab

  // images (png, jpg, etc.)
  "resource://gre/res/ImageDocument.css",
  "resource://gre/res/TopLevelImageDocument.css",
  // plain text
  "resource://gre-resources/plaintext.css",
  // videos
  "resource://gre/res/TopLevelVideoDocument.css",
]);

const profileUri = (() => {
  const fileHandler = Services.io.getProtocolHandler("file").
      QueryInterface<XPCOM.nsIFileProtocolHandler>(Ci.nsIFileProtocolHandler);
  const profileDir = Services.dirsvc.get<XPCOM.nsIFile>("ProfD", Ci.nsIFile);
  return fileHandler.getURLSpecFromDir(profileDir);
})();

const WHITELISTED_DESTINATION_JAR_PATH_STARTS = [
  profileUri + "extensions/", // issue #860
];

// =============================================================================
// Request
// =============================================================================

export class Request {
  // TODO: save a nsIURI objects here instead of strings
  public originURI?: string;
  public destURI: string;

  // TODO: Merge "RequestResult" into this class.
  public requestResult: RequestResult;

  constructor(
      originURI: string | undefined,
      destURI: string,
  ) {
    this.originURI = originURI;
    this.destURI = destURI;
  }

  get originUriObj() {
    if (!this.originURI) return null;
    return Services.io.newURI(this.originURI, null, null);
  }

  get destUriObj() {
    return Services.io.newURI(this.destURI, null, null);
  }

  public setOriginURI(originURI: string) {
    this.originURI = originURI;
  }

  public setDestURI(destURI: string) {
    this.destURI = destURI;
  }

  public detailsToString() {
    // Note: try not to cause side effects of toString() during load, so "<HTML
    // Element>" is hard-coded.
    return "destination: " + this.destURI + ", origin: " + this.originURI;
  }

  public isTopLevel() {
    // FIXME
    // @ts-ignore
    return this.getContentPolicyType() === Ci.nsIContentPolicy.TYPE_DOCUMENT;
  }

  /**
   * Determines if a request is only related to internal resources.
   *
   * @return {Boolean} true if the request is only related to internal
   *         resources.
   */
  public isInternal() {
    // TODO: investigate "moz-nullprincipal". The following comment has been
    //       created by @jsamuel in 2008, commit 46a04bb. More information about
    //       principals at
    //   https://developer.mozilla.org/en-US/docs/Mozilla/Gecko/Script_security
    //
    // Note: Don't OK the origin scheme "moz-nullprincipal" without further
    // understanding. It appears to be the source when the `js_1.html` test is
    // used. That is, javascript redirect to a "javascript:" url that creates
    // the entire page's content which includes a form that it submits. Maybe
    // "moz-nullprincipal" always shows up when using "document.location"?

    const origin = this.originUriObj;
    const dest = this.destUriObj;

    if (origin === undefined || origin === null) {
      logRequests.log("Allowing request without an origin.");
      return true;
    }

    if (origin.spec === "") {
      // The spec can be empty if odd things are going on, like the Refcontrol
      // extension causing back/forward button-initiated requests to have
      // aRequestOrigin be a virtually empty nsIURL object.
      logRequests.log("Allowing request with empty origin spec!");
      return true;
    }

    // Fully internal requests.
    if (INTERNAL_SCHEMES.has(dest.scheme) &&
        (
          INTERNAL_SCHEMES.has(origin.scheme) ||
          // e.g.
          // data:application/vnd.mozilla.xul+xml;charset=utf-8,<window/>
          // resource://b9db16a4-6edc-47ec-a1f4-b86292ed211d/data/mainPanel.html
          origin.spec.startsWith("data:application/vnd.mozilla.xul+xml")
        )) {
      logRequests.log("Allowing internal request.");
      return true;
    }

    if (WHITELISTED_DESTINATION_SCHEMES.has(dest.scheme)) {
      logRequests.log("Allowing request with a semi-internal destination.");
      return true;
    }

    const destHost = uriService.getHostByUriObj(dest);

    // "global" dest are [some sort of interal requests]
    // "browser" dest are [???]
    if (destHost === "global" || destHost === "browser") {
      return true;
    }

    // See RP issue #788
    if (origin.scheme === "view-source" &&
        dest.spec === "resource://gre-resources/viewsource.css") {
      return true;
    }

    if (dest.scheme === "jar") {
      const {path} = dest;
      // tslint:disable-next-line prefer-const
      for (let pathStart of WHITELISTED_DESTINATION_JAR_PATH_STARTS) {
        if (path.startsWith(pathStart)) return true;
      }
    }

    // Empty iframes will have the "about:blank" URI. Sometimes websites
    // create an empty iframe and then manipulate it.
    // References:
    // - NoScript FAQ: https://noscript.net/faq#qa1_9
    // - RP issue #784
    if (dest.spec === "about:blank") {
      return true;
    }

    // see issue #180
    if (origin.scheme === "about" &&
        origin.spec.indexOf("about:neterror?") === 0) {
      return true;
    }

    return false;
  }

  public isAllowedByDefault() {
    const origin = this.originUriObj;
    const dest = this.destUriObj;

    if (
        origin && DEFAULT_ALLOWED_SCHEMES.has(origin.scheme) ||
        DEFAULT_ALLOWED_SCHEMES.has(dest.scheme)
    ) return true;

    if (dest.scheme === "chrome") {
      // Necessary for some Add-ons, e.g. "rikaichan" or "Grab and Drag"
      // References:
      // - RP issue #784
      if (dest.path.startsWith("/skin/")) return true;
      // See RP issue #797
      if (dest.spec === "chrome://pluginproblem/content/pluginProblem.xml") {
        return true;
      }
    }

    const destHost = uriService.getHostByUriObj(dest);

    if (
        dest.scheme === "resource" && (
            destHost && destHost.startsWith("noscript_") || // RP issue #788
            DEFAULT_ALLOWED_DESTINATION_RESOURCE_URIS.has(dest.spec)
        )
    ) return true;

    return false;
  }

  public checkByDefaultPolicy() {
    const cachedSettings = rp.storage.cachedSettings!;
    if (
        this.isAllowedByDefault() ||
        cachedSettings.alias.isDefaultAllow() /* FIXME */ /* ||
        cachedSettings.alias.isDefaultAllowTopLevel() && this.isTopLevel() */
    ) return new RequestResult(true, RequestReason.DefaultPolicy);

    const originUri = this.originURI;
    const destUri = this.destURI;

    if (cachedSettings.alias.isDefaultAllowSameDomain()) {
      const originDomain = originUri ?
          uriService.getBaseDomain(originUri) : null;
      const destDomain = uriService.getBaseDomain(destUri);

      if (originDomain !== null && destDomain !== null) {
        // apply this rule only if both origin and dest URIs
        // do have a host.
        return new RequestResult(originDomain === destDomain,
            RequestReason.DefaultSameDomain);
      }
    }

    const originObj: XPCOM.nsIURI | null = this.originUriObj;
    const destObj: XPCOM.nsIURI = this.destUriObj;

    // Allow requests from http:80 to https:443 of the same host.
    if (originObj !== null &&
        originObj.scheme === "http" && destObj.scheme === "https" &&
        originObj.port === -1 && destObj.port === -1 &&
        originObj.host === destObj.host) {
      return new RequestResult(true, RequestReason.DefaultSameDomain);
    }

    const LEVEL_SOP = uriService.hostLevels.SOP;
    const originIdent = originUri ?
        uriService.getIdentifier(originUri, LEVEL_SOP) : null;
    const destIdent = uriService.getIdentifier(destUri, LEVEL_SOP);
    // FIXME: case "null === null" is always true
    return new RequestResult(originIdent === destIdent,
        RequestReason.DefaultSameDomain);
  }

  public getContentPolicyType() {
    throw new Error("Request.getContentPolicyType() not implemented");
  }
}

// =============================================================================
// NormalRequest
// =============================================================================

// tslint:disable-next-line max-classes-per-file
export class NormalRequest extends Request {
  public shouldLoadResult: number;

  constructor(
      public aContentType: XPCOM.nsContentPolicyType,
      public aContentLocation: XPCOM.nsIURI,
      public aRequestOrigin?: XPCOM.nsIURI | null,
      public aContext?:
          XPCOM.nsIDOMNode | XPCOM.nsIDOMWindow | XPCOM.nsISupports | null,
      public aMimeTypeGuess?: string,
      public aExtra?: any,
      public aRequestPrincipal?: XPCOM.nsIPrincipal,
  ) {
    super(
        // About originURI and destURI:
        // We don't need to worry about ACE formatted IDNs because it seems
        // that they'll automatically be converted to UTF8 format before we
        // even get here, as long as they're valid and Mozilla allows the TLD
        // to have UTF8 formatted IDNs.
        aRequestOrigin ? aRequestOrigin.specIgnoringRef : undefined,
            // originURI
        aContentLocation.specIgnoringRef, // destURI
    );
  }

  get originUriObj() {
    return this.aRequestOrigin || null;
  }

  get destUriObj() {
    return this.aContentLocation;
  }

  public setOriginURI(originURI: string) {
    this.originURI = originURI;
    this.aRequestOrigin = uriService.getUriObject(originURI);
  }

  public setDestURI(destURI: string) {
    this.destURI = destURI;
    this.aContentLocation = uriService.getUriObject(destURI);
  }

  get destURIWithRef() {
    return this.aContentLocation.spec;
  }

  public getContentPolicyType() {
    return this.aContentType;
  }

  public detailsToString() {
    // Note: try not to cause side effects of toString() during load, so "<HTML
    // Element>" is hard-coded.
    const context = this.aContext instanceof Ci.nsIDOMHTMLElement ?
        "<HTML Element>" : this.aContext;
    return "type: " + this.aContentType +
        ", destination: " + this.destURI +
        ", origin: " + this.originURI +
        ", context: " + context +
        ", mime: " + this.aMimeTypeGuess +
        ", " + this.aExtra;
  }

  public isAllowedByDefault() {
    if (
        this.aExtra &&
        this.aExtra instanceof Ci.nsISupportsString &&
        (this.aExtra as XPCOM.nsISupportsString).data ===
            "conPolCheckFromDocShell"
    ) return true;

    if (
        this.aRequestPrincipal &&
        Services.scriptSecurityManager.isSystemPrincipal(
            this.aRequestPrincipal)
    ) return true;

    return super.isAllowedByDefault();
  }

  /**
   * Determines if a request is only related to internal resources.
   *
   * @return {Boolean} true if the request is only related to internal
   *         resources.
   */
  public isInternal() {
    const rv = super.isInternal();
    if (rv === true) {
      return true;
    }

    // If there are entities in the document, they may trigger a local file
    // request. We'll only allow requests to .dtd files, though, so we don't
    // open up all file:// destinations.
    if (this.aContentLocation.scheme === "file" &&
        this.aContentType === Ci.nsIContentPolicy.TYPE_DTD) {
      return true;
    }

    return false;
  }

  /**
   * Get the content window (nsIDOMWindow) related to this request.
   */
  public getContentWindow(): XUL.contentWindow | null {
    const context = this.aContext;
    if (!context) {
      return null;
    }

    if (context instanceof Ci.nsIDOMXULElement &&
        (context as XPCOM.nsIDOMXULElement).localName === "browser") {
        return ((context as any) as XUL.browser).contentWindow;
    }

    {
      const result = queryInterface<XPCOM.nsIDOMWindow>(
          context, Ci.nsIDOMWindow,
      );
      if (!result.error) return result.value as any;
    }
    let doc: XUL.contentDocument | undefined = undefined;
    {
      const result = queryInterface(context, Ci.nsIDOMDocument);
      if (!result.error) doc = result.value as any;
    }
    if (!doc) {
      const result = queryInterface(context, Ci.nsIDOMNode);
      if (!result.error) {
        const node: XUL.contentNode = result.value as any;
        doc = node.ownerDocument;
      }
    }
    if (!doc) return null;
    return doc.defaultView;
  }

  /**
   * Get the chrome window related to this request.
   */
  public getChromeWindow(): XUL.chromeWindow | null {
    const contentWindow = this.getContentWindow();
    if (contentWindow) {
      return WindowUtils.getChromeWindow(contentWindow);
    } else {
      return null;
    }
  }

  /**
   * Get the <browser> related to this request.
   */
  public getBrowser() {
    const context = this.aContext;
    if (context instanceof Ci.nsIDOMXULElement &&
        (context as XPCOM.nsIDOMXULElement).localName === "browser") {
      return context;
    } else {
      return WindowUtils.getBrowserForWindow(this.getContentWindow()!);
    }
  }
}

// =============================================================================
// RedirectRequest
// =============================================================================

// tslint:disable-next-line max-classes-per-file
export class RedirectRequest extends Request {
  public readonly oldChannel: HttpChannelWrapper;
  public readonly newChannel: HttpChannelWrapper;

  constructor(aOldChannel: any, aNewChannel: any, aFlags: any) {
    const oldChannel = new HttpChannelWrapper(Services.io, aOldChannel);
    const newChannel = new HttpChannelWrapper(Services.io, aNewChannel);
    super(
        oldChannel.uri.specIgnoringRef,
        newChannel.uri.specIgnoringRef,
    );
    this.oldChannel = oldChannel;
    this.newChannel = newChannel;
  }

  get browser(): XUL.browser | null {
    return this.oldChannel.browser;
  }

  get loadFlags() {
    return this.oldChannel._httpChannel.loadFlags;
  }

  get originUriObj() {
    return this.oldChannel.uri;
  }

  get destUriObj() {
    return this.newChannel.uri;
  }

  get destURIWithRef() {
    return this.newChannel.uri.spec;
  }

  public getContentPolicyType() {
    const {loadInfo} = this.oldChannel._httpChannel;
    if (!loadInfo) return Ci.nsIContentPolicy.TYPE_OTHER;
    return loadInfo.externalContentPolicyType;
  }
}
