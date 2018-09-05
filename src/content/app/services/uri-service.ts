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
import { JSMs, XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

/*
 * It's worth noting that many of the functions in this module will
 * convert ACE formatted IDNs to UTF8 formatted values. This is done
 * automatically when constructing nsIURI instances from ACE
 * formatted URIs when the TLD is one in which Mozilla supports
 * UTF8 IDNs.
 */

enum HostLevel {
  // Use example.com from http://www.a.example.com:81
  DOMAIN = 1,
  // Use www.a.example.com from http://www.a.example.com:81
  HOST = 2,
  // Use http://www.a.example.com:81 from http://www.a.example.com:81
  SOP = 3,
}

export class UriService extends Module implements App.services.IUriService {
  public get hostLevels() { return HostLevel; }

  constructor(
      log: Common.ILog,
      protected readonly outerWindowID: number | null,
      private mozETLDService: JSMs.Services["eTLD"],
      private mozIDNService: XPCOM.nsIIDNService,
      private mozIOService: JSMs.Services["io"],
  ) {
    super(
        (outerWindowID === null ? "app" : `AppContent[${outerWindowID}]`) +
        `.services.uri`,
        log,
    );
  }

  public getIdentifier(
      aUri: string,
      aLevel: HostLevel = HostLevel.SOP,
  ): string {
    let identifier: string | null | false;
    let identifierGettingFn: (uri: typeof aUri) => string | null;

    // We only have one identifier that we're using now:
    //     the pre-path / HostLevel.SOP.
    // TODO: figure out how we want to rename this function and clean up the
    // unused parts.

    switch (aLevel) {
      case HostLevel.DOMAIN:
        identifierGettingFn = () => null;
        break;
      case HostLevel.HOST:
        identifierGettingFn = this.getHost.bind(this);
        break;
      case HostLevel.SOP:
        identifierGettingFn = this.getPrePath.bind(this);
        break;
      default:
        throw new Error(
            "Invalid identifier level specified " +
            "in getIdentifier(): " + aLevel);
    }

    try {
      identifier = identifierGettingFn(aUri);
    } catch (e) {
      // This will happen not infrequently with chrome:// and similar values
      // for the uri that get passed to this function.
      identifier = false;
    }

    if (identifier) {
      return identifier;
    } else {
      if (aUri.indexOf("file://") === 0) {
        return "file://";
      } else if (aUri.indexOf("data:") === 0) {
        // Format: data:[<MIME-type>][;charset=<encoding>][;base64],<data>
        identifier = aUri.split(",")[0];
        return identifier.split(";")[0];
      }
      this.log.info("Unable to getIdentifier from uri " +
          aUri + " using identifier level " + aLevel + ".");
      return aUri;
    }
  }

  public getHostByUriObj(aUriObj: XPCOM.nsIURI): string | null {
    try {
      return aUriObj.host;
    } catch (e) {
      return null;
    }
  }

  public getHost(aUri: string): string | null {
    return this.getHostByUriObj(this.getUriObject(aUri));
  }

  public uriObjHasPort(aUriObj: XPCOM.nsIURI): boolean {
    try {
      // tslint:disable-next-line no-unused-expression
      aUriObj.port;
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Returns an nsIURI object from a uri string. Note that nsIURI objects will
   * automatically convert ACE formatting to UTF8 for IDNs in the various
   * attributes of the object that are available.
   */
  public getUriObject(uri: string): XPCOM.nsIURI {
    // fixme: if `uri` is relative, `newURI()` throws NS_ERROR_MALFORMED_URI.
    // possible solution: use nsIURI.resolve() instead for relative uris

    // Throws an exception if uri is invalid.
    try {
      return this.mozIOService.newURI(uri, null, null);
    } catch (e) {
      const msg = "getUriObject() exception on uri <" + uri + ">.";
      this.log.log(msg);
      throw e;
    }
  }

  public isValidUri(uri: string): boolean {
    try {
      this.mozIOService.newURI(uri, null, null);
      return true;
    } catch (e) {
      return false;
    }
  }

  public getBaseDomain(uri: string): string | null {
    const host = this.getHost(uri);
    if (host === null) {
      return null;
    }
    try {
      // The nsIEffectiveTLDService functions will always leave IDNs as ACE.
      const baseDomain = this.mozETLDService.getBaseDomainFromHost(host, 0);
      // Note: we use convertToDisplayIDN rather than convertACEtoUTF8() because
      // we want to only convert IDNs that that are in Mozilla's IDN whitelist.
      // The second argument will have the property named "value" set to true if
      // the result is ASCII/ACE encoded, false otherwise.
      return this.mozIDNService.convertToDisplayIDN(baseDomain, {});
    } catch (e) {
      if (e.name === "NS_ERROR_HOST_IS_IP_ADDRESS") {
        return host;
      } else if (e.name === "NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS") {
        return host;
      } else {
        throw e;
      }
    }
  }

  public isIPAddress(host: string): boolean {
    try {
      this.mozETLDService.getBaseDomainFromHost(host, 0);
      return false;
    } catch (e) {
      switch (e.name) {
        case "NS_ERROR_HOST_IS_IP_ADDRESS":
          return true;

        case "NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS":
          return false;

        default:
          console.error("Unexpected error:", e);
          return false;
      }
    }
  }

  public getPath(uri: string): string {
    return this.getUriObject(uri).path;
  }

  /**
   * Returns the prePath from a uri string. Note that this will return
   * a prePath in UTF8 format for all IDNs, even if the uri passed to
   * the function is ACE formatted.
   */
  public getPrePath(uri: string): string {
    return this.getUriObject(uri).prePath;
  }

  public stripFragment(uri: string) {
    return uri.split("#")[0];
  }

  /**
   * Adds a path of "/" to the uri if it doesn't have one. That is,
   * "http://127.0.0.1" is returned as "http://127.0.0.1/". Will return
   * the origin uri if the provided one is not valid.
   */
  public ensureUriHasPath(uri: string): string {
    try {
      return this.getUriObject(uri).spec;
    } catch (e) {
      return uri;
    }
  }

  /**
   * Returns the same uri but makes sure that it's UTF8 formatted
   * instead of ACE formatted if it's an IDN that Mozilla supports
   * displaying in UTF8 format. See
   * http://www.mozilla.org/projects/security/tld-idn-policy-list.html
   * for more info.
   */
  public formatIDNUri(uri: string): string {
    // Throws an exception if uri is invalid. This is almost the same as the
    // ensureUriHasPath function, but the separate function makes the calling
    // code clearer and this one we want to raise an exception if the uri is
    // not valid.
    return this.getUriObject(uri).spec;
  }

  /**
   * Determines whether a URI uses the standard port for its scheme.
   */
  public hasStandardPort(uri: XPCOM.nsIURI): boolean {
    // A port value of -1 in the uriObj means the default for the protocol.
    return uri.port === -1 ||
          uri.scheme !== "http" && uri.scheme !== "https" ||
          uri.port === 80 && uri.scheme === "http" ||
          uri.port === 443 && uri.scheme === "https";
  }

  public getDefaultPortForScheme(scheme: string): number | null {
    switch (scheme) {
      case "http":
        return 80;
      case "https":
        return 443;
      default:
        this.log.warn("Unknown default port for scheme " + scheme + ".");
        return null;
    }
  }
}
