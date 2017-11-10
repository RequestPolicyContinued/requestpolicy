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

import {Log as log} from "content/models/log";

declare const Cc: any;
declare const Ci: any;
declare const Services: any;

export interface IUri {
  spec: string;
  scheme: string;
  host: string;
  port: number;
  prePath: string;
  path: string;
}

// =============================================================================
// DomainUtils
// =============================================================================

/*
 * It's worth noting that many of the functions in this module will
 * convert ACE formatted IDNs to UTF8 formatted values. This is done
 * automatically when constructing nsIURI instances from ACE
 * formatted URIs when the TLD is one in which Mozilla supports
 * UTF8 IDNs.
 */

const IDN_SERVICE = Cc["@mozilla.org/network/idn-service;1"]
    .getService(Ci.nsIIDNService);

const STANDARDURL_CONTRACTID = "@mozilla.org/network/standard-url;1";

export enum Level {
  // Use example.com from http://www.a.example.com:81
  DOMAIN = 1,
  // LEVEL_HOST: Use www.a.example.com from http://www.a.example.com:81
  HOST = 2,
  // LEVEL_SOP: Use http://www.a.example.com:81 from http://www.a.example.com:81
  SOP = 3,
}

export const LEVEL_DOMAIN = Level.DOMAIN;
export const LEVEL_HOST = Level.HOST;
export const LEVEL_SOP = Level.SOP;

export function getIdentifier(aUri: string, aLevel: Level = Level.SOP): string {
  let identifier: string | null | false;
  let identifierGettingFn: (uri: typeof aUri) => string | null;

  // We only have one identifier that we're using now:
  //     the pre-path / LEVEL_SOP.
  // TODO: figure out how we want to rename this function and clean up the
  // unused parts.

  switch (aLevel) {
    case Level.DOMAIN:
      identifierGettingFn = () => null;
      break;
    case LEVEL_HOST:
      identifierGettingFn = getHost;
      break;
    case LEVEL_SOP:
      identifierGettingFn = getPrePath;
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
    log.info("Unable to getIdentifier from uri " +
        aUri + " using identifier level " + aLevel + ".");
    return aUri;
  }
}

export function getHostByUriObj(aUriObj: IUri): string | null {
  try {
    return aUriObj.host;
  } catch (e) {
    return null;
  }
}

export function getHost(aUri: string): string | null {
  return getHostByUriObj(getUriObject(aUri));
}

export function uriObjHasPort(aUriObj: IUri): boolean {
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
export function getUriObject(uri: string): IUri {
  // fixme: if `uri` is relative, `newURI()` throws NS_ERROR_MALFORMED_URI.
  // possible solution: use nsIURI.resolve() instead for relative uris

  // Throws an exception if uri is invalid.
  try {
    return Services.io.newURI(uri, null, null);
  } catch (e) {
    const msg = "getUriObject() exception on uri <" + uri + ">.";
    log.log(msg);
    throw e;
  }
}

export function isValidUri(uri: string): boolean {
  try {
    getUriObject(uri);
    return true;
  } catch (e) {
    return false;
  }
}

export function getBaseDomain(uri: string): string | null {
  const host = getHost(uri);
  if (host === null) {
    return null;
  }
  try {
    // The nsIEffectiveTLDService functions will always leave IDNs as ACE.
    const baseDomain = Services.eTLD.getBaseDomainFromHost(host, 0);
    // Note: we use convertToDisplayIDN rather than convertACEtoUTF8() because
    // we want to only convert IDNs that that are in Mozilla's IDN whitelist.
    // The second argument will have the property named "value" set to true if
    // the result is ASCII/ACE encoded, false otherwise.
    return IDN_SERVICE.convertToDisplayIDN(baseDomain, {});
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

export function isIPAddress(host: string): boolean {
  try {
    Services.eTLD.getBaseDomainFromHost(host, 0);
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

export function getPath(uri: string): string {
  return getUriObject(uri).path;
}

/**
 * Returns the prePath from a uri string. Note that this will return
 * a prePath in UTF8 format for all IDNs, even if the uri passed to
 * the function is ACE formatted.
 */
export function getPrePath(uri: string): string {
  return getUriObject(uri).prePath;
}

export function stripFragment(uri: string) {
  return uri.split("#")[0];
}

// TODO: Maybe this should have a different home.
/**
 * Gets the relevant pieces out of a meta refresh or header refresh string.
 *
 * @return {Object} The delay in seconds and the url to refresh to.
 *     The url may be an empty string if the current url should be
 *     refreshed.
 * @throws Generic exception if the refreshString has an invalid format,
 *     including if the seconds can't be parsed as a float.
 */
export function parseRefresh(
    refreshString: string,
): {
    delay: number,
    destURI: string,
} {
  const parts = /^\s*(\S*?)\s*(;\s*url\s*=\s*(.*?)\s*)?$/i.exec(refreshString);
  if (parts === null) {
    throw new Error("parseRefresh regex did not match");
  }
  const delay = parseFloat(parts[1]);
  if (isNaN(delay)) {
    throw new Error("Invalid delay value in refresh string: " + parts[1]);
  }
  let url = parts[3];
  if (url === undefined) {
    url = "";
  }
  // Strip off enclosing quotes around the url.
  if (url) {
    const first = url[0];
    const last = url[url.length - 1];
    if (first === last && (first === "'" || first === "\"")) {
      url = url.substring(1, url.length - 1);
    }
  }
  return {delay, destURI: url};
}

/**
 * Adds a path of "/" to the uri if it doesn't have one. That is,
 * "http://127.0.0.1" is returned as "http://127.0.0.1/". Will return
 * the origin uri if the provided one is not valid.
 *
 * @param {String} uri
 * @return {String}
 */
export function ensureUriHasPath(uri: string): string {
  try {
    return getUriObject(uri).spec;
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
 *
 * @param {String} uri The uri.
 * @return {nsIURI} The same uri but with UTF8 formatting if the original uri
 *     was ACE formatted.
 */
export function formatIDNUri(uri: string) {
  // Throws an exception if uri is invalid. This is almost the same as the
  // ensureUriHasPath function, but the separate function makes the calling
  // code clearer and this one we want to raise an exception if the uri is
  // not valid.
  return getUriObject(uri).spec;
}

/**
 * Given an origin URI string and a destination path to redirect to, returns a
 * string which is a valid uri which will be/should be redirected to. This
 * takes into account whether the destPath is a full URI, an absolute path
 * (starts with a slash), a protocol relative path (starts with two slashes),
 * or is relative to the originUri path.
 *
 * @param {String} originUri
 * @param {String} destPath
 * @return {String}
 */
export function determineRedirectUri(
    originUri: string,
    destPath: string,
): string {
  const baseUri = getUriObject(originUri);
  const urlType = Ci.nsIStandardURL.URLTYPE_AUTHORITY;
  const newUri = Cc[STANDARDURL_CONTRACTID].createInstance(Ci.nsIStandardURL);
  newUri.init(urlType, 0, destPath, null, baseUri);
  const resolvedUri = newUri.QueryInterface(Ci.nsIURI);
  return resolvedUri.spec;
}

/**
 * Determines whether a URI uses the standard port for its scheme.
 *
 * @param {nsIURI} uri
 * @return {Boolean}
 */
export function hasStandardPort(uri: IUri) {
  // A port value of -1 in the uriObj means the default for the protocol.
  return uri.port === -1 ||
         uri.scheme !== "http" && uri.scheme !== "https" ||
         uri.port === 80 && uri.scheme === "http" ||
         uri.port === 443 && uri.scheme === "https";
}

export function getDefaultPortForScheme(scheme: string): number | null {
  switch (scheme) {
    case "http":
      return 80;
    case "https":
      return 443;
    default:
      log.warn("Unknown default port for scheme " + scheme + ".");
      return null;
  }
}
