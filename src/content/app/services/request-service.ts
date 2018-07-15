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

import { App } from "app/interfaces";
import { JSMs, XPCOM, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";
import { NormalRequest, RedirectRequest, Request } from "lib/classes/request";
import {
  RequestReason,
  RequestResult,
} from "lib/classes/request-result";
import {queryInterface } from "lib/utils/try-catch-utils";
import * as WindowUtils from "lib/utils/window-utils";

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

export class RequestService extends Module {
  constructor(
      log: Common.ILog,
      private httpChannelService: App.services.IHttpChannelService,
      private uriService: App.services.IUriService,
      private cachedSettings: App.storage.ICachedSettings,
  ) {
    super("app.services.request", log);
  }

  public isTopLevelRequest(aRequest: Request) {
    // FIXME
    // @ts-ignore
    return this.getContentPolicyType(aRequest) ===
        Ci.nsIContentPolicy.TYPE_DOCUMENT;
  }

  /**
   * Determines if a request is only related to internal resources.
   */
  public isInternalRequest(aRequest: Request): boolean {
    const rv = this.isInternalGeneric(aRequest);
    if (rv === true) { return true; }

    if (aRequest instanceof NormalRequest) {
      // If there are entities in the document, they may trigger a local file
      // request. We'll only allow requests to .dtd files, though, so we don't
      // open up all file:// destinations.
      if (aRequest.aContentLocation.scheme === "file" &&
          aRequest.aContentType === Ci.nsIContentPolicy.TYPE_DTD) {
        return true;
      }
    }

    return false;
  }

  public isAllowedByDefault(aRequest: Request) {
    if (aRequest instanceof NormalRequest) {
      if (
          aRequest.aExtra &&
          aRequest.aExtra instanceof Ci.nsISupportsString &&
          (aRequest.aExtra as XPCOM.nsISupportsString).data ===
              "conPolCheckFromDocShell"
      ) return true;

      if (
          aRequest.aRequestPrincipal &&
          Services.scriptSecurityManager.isSystemPrincipal(
              aRequest.aRequestPrincipal)
      ) return true;
    }

    const origin = aRequest.originUriObj;
    const dest = aRequest.destUriObj;

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

    const destHost = this.uriService.getHostByUriObj(dest);

    if (
        dest.scheme === "resource" && (
            destHost && destHost.startsWith("noscript_") || // RP issue #788
            DEFAULT_ALLOWED_DESTINATION_RESOURCE_URIS.has(dest.spec)
        )
    ) return true;

    return false;
  }

  public checkByDefaultPolicy(aRequest: Request): RequestResult {
    if (
        this.isAllowedByDefault(aRequest) ||
        this.cachedSettings.alias.isDefaultAllow() /* FIXME */ /* ||
        this.cachedSettings.alias.isDefaultAllowTopLevel() && this.isTopLevel()
        */
    ) return new RequestResult(true, RequestReason.DefaultPolicy);

    const originUri = aRequest.originURI;
    const destUri = aRequest.destURI;

    if (this.cachedSettings.alias.isDefaultAllowSameDomain()) {
      const originDomain = originUri ?
          this.uriService.getBaseDomain(originUri) : null;
      const destDomain = this.uriService.getBaseDomain(destUri);

      if (originDomain !== null && destDomain !== null) {
        // apply this rule only if both origin and dest URIs
        // do have a host.
        return new RequestResult(originDomain === destDomain,
            RequestReason.DefaultSameDomain);
      }
    }

    const originObj: XPCOM.nsIURI | null = aRequest.originUriObj;
    const destObj: XPCOM.nsIURI = aRequest.destUriObj;

    // Allow requests from http:80 to https:443 of the same host.
    if (originObj !== null &&
        originObj.scheme === "http" && destObj.scheme === "https" &&
        originObj.port === -1 && destObj.port === -1 &&
        originObj.host === destObj.host) {
      return new RequestResult(true, RequestReason.DefaultSameDomain);
    }

    const LEVEL_SOP = this.uriService.hostLevels.SOP;
    const originIdent = originUri ?
        this.uriService.getIdentifier(originUri, LEVEL_SOP) : null;
    const destIdent = this.uriService.getIdentifier(destUri, LEVEL_SOP);
    // FIXME: case "null === null" is always true
    return new RequestResult(originIdent === destIdent,
        RequestReason.DefaultSameDomain);
  }

  public getContentPolicyType(aRequest: Request): XPCOM.nsContentPolicyType {
    if (aRequest instanceof NormalRequest) {
      return aRequest.aContentType;
    }

    if (aRequest instanceof RedirectRequest) {
      const {loadInfo} = aRequest;
      if (!loadInfo) return Ci.nsIContentPolicy.TYPE_OTHER;
      return loadInfo.externalContentPolicyType;
    }

    throw new Error("RequestService.getContentPolicyType() not implemented");
  }

  public getContentWindow(aRequest: NormalRequest): XUL.contentWindow | null {
    const context = aRequest.aContext;
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
    let doc: XUL.contentDocument | undefined;
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

  public getChromeWindow(aRequest: NormalRequest): XUL.chromeWindow | null {
    const contentWindow = this.getContentWindow(aRequest);
    if (contentWindow) {
      return WindowUtils.getChromeWindow(contentWindow);
    } else {
      return null;
    }
  }

  public getBrowser(
      aRequest: NormalRequest | RedirectRequest,
  ): XUL.browser | null {
    if (aRequest instanceof RedirectRequest) {
      return this.httpChannelService.getBrowser(aRequest.oldChannel);
    }

    const context = aRequest.aContext;
    if (context instanceof Ci.nsIDOMXULElement &&
        (context as XPCOM.nsIDOMXULElement).localName === "browser") {
      return context as XUL.browser;
    } else {
      return WindowUtils.getBrowserForWindow(this.getContentWindow(aRequest)!);
    }
  }

  /**
   * Determines if a request is only related to internal resources.
   */
  private isInternalGeneric(aRequest: Request): boolean {
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

    const origin = aRequest.originUriObj;
    const dest = aRequest.destUriObj;

    if (origin === undefined || origin === null) {
      this.log.log("Allowing request without an origin.");
      return true;
    }

    if (origin.spec === "") {
      // The spec can be empty if odd things are going on, like the Refcontrol
      // extension causing back/forward button-initiated requests to have
      // aRequestOrigin be a virtually empty nsIURL object.
      this.log.log("Allowing request with empty origin spec!");
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
      this.log.log("Allowing internal request.");
      return true;
    }

    if (WHITELISTED_DESTINATION_SCHEMES.has(dest.scheme)) {
      this.log.log("Allowing request with a semi-internal destination.");
      return true;
    }

    const destHost = this.uriService.getHostByUriObj(dest);

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
}
