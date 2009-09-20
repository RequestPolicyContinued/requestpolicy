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

var EXPORTED_SYMBOLS = ["DomainUtil"]

const CI = Components.interfaces;
const CC = Components.classes;

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/Logger.jsm",
    requestpolicy.mod);

var DomainUtil = {};

DomainUtil._ios = CC["@mozilla.org/network/io-service;1"]
    .getService(CI.nsIIOService);

DomainUtil._eTLDService = Components.classes["@mozilla.org/network/effective-tld-service;1"]
    .getService(Components.interfaces.nsIEffectiveTLDService);

// LEVEL_DOMAIN: Use example.com from http://www.a.example.com:81
DomainUtil.LEVEL_DOMAIN = 1;
// LEVEL_HOST: Use www.a.example.com from http://www.a.example.com:81
DomainUtil.LEVEL_HOST = 2;
// LEVEL_SOP: Use http://www.a.example.com:81 from http://www.a.example.com:81
DomainUtil.LEVEL_SOP = 3;

DomainUtil.getIdentifier = function(uri, level) {
  var identifier;
  var identifierGettingFunctionName;
  switch (level) {
    case this.LEVEL_DOMAIN :
      identifierGettingFunctionName = "getDomain";
      break;
    case this.LEVEL_HOST :
      identifierGettingFunctionName = "getHost";
      break;
    case this.LEVEL_SOP :
      identifierGettingFunctionName = "getPrePath";
      break;
    default :
      throw "Invalid identifier level specified in DomainUtil.getIdentifier().";
  }

  try {
    identifier = this[identifierGettingFunctionName](uri);
  } catch (e) {
    // This will happen not infrequently with chrome:// and similar values
    // for the uri that get passed to this function.
    identifier = false;
  }

  if (identifier) {
    return identifier;
  } else {
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Unable to getIdentifier from uri " + uri + " using identifier level "
            + level + ".");
    return uri;
  }
};

DomainUtil.identifierIsInUri = function(identifier, uri, level) {
  return identifier == this.getIdentifier(uri, level);
};

/**
 * Returns the hostname from a uri string.
 * 
 * @param {String}
 *          uri The uri.
 * @return {String} The hostname of the uri or throws an exception if it is an
 *         invalid uri.
 */
DomainUtil.getHost = function(uri) {
  return this.getUriObject(uri).host;
};

/**
 * Returns an nsIURI object from a uri string.
 * 
 * @param {String}
 *          uri The uri.
 * @return {nsIURI} The nsIURI object created from the uri, or throws an
 *         exception if it is an invalid uri.
 */
DomainUtil.getUriObject = function(uri) {
  // Throws an exception if uri is invalid.
  return this._ios.newURI(uri, null, null);
};

/**
 * Determines whether a uri string represents a valid uri.
 * 
 * @param {String}
 *          uri The uri.
 * @return {boolean} True if the uri is valid, false otherwise.
 */
DomainUtil.isValidUri = function(uri) {
  try {
    this.getUriObject(uri);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Returns the domain from a uri string.
 * 
 * @param {String}
 *          uri The uri.
 * @return {String} The domain of the uri.
 */
DomainUtil.getDomain = function(uri) {
  var host = this.getHost(uri);
  try {
    return this._eTLDService.getBaseDomainFromHost(host, 0);
  } catch (e) {
    if (e == "NS_ERROR_HOST_IS_IP_ADDRESS ") {
      return this.getHost(uri);
    } else if (e == "NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS") {
      return this.getHost(uri);
    } else {
      throw e;
    }
  }
};

/**
 * Returns the prePath from a uri string.
 * 
 * @param {String}
 *          uri The uri.
 * @return {String} The prePath of the uri.
 */
DomainUtil.getPrePath = function(uri) {
  return this._ios.newURI(uri, null, null).prePath;
};

/**
 * Strips any "www." from the beginning of a hostname.
 * 
 * @param {String}
 *          hostname The hostname to strip.
 * @return {String} The hostname with any leading "www." removed.
 */
DomainUtil.stripWww = function(hostname) {
  return hostname.indexOf('www.') == 0 ? hostname.substring(4) : hostname;
};

/**
 * Determine if two hostnames are the same if any "www." prefix is ignored.
 * 
 * @param {String}
 *          destinationHost The destination hostname.
 * @param {String}
 *          originHost The origin hostname.
 * @return {Boolean} True if the hostnames are the same regardless of "www.",
 *         false otherwise.
 */
DomainUtil.sameHostIgnoreWww = function(destinationHost, originHost) {
  return destinationHost
      && this.stripWww(destinationHost) == this.stripWww(originHost);

};

DomainUtil.stripFragment = function(uri) {
  return uri.split("#")[0];
};

/**
 * Determine if the destination hostname is a subdomain of the origin hostname,
 * ignoring any "www." that may exist in the origin hostname. That is,
 * "images.example.com" is subdomain of both "www.example.com" and
 * "example.com", but "www.example.com " and "example.com" are not subdomains of
 * "images.example.com".
 * 
 * @param {String}
 *          destinationHost The destination hostname.
 * @param {String}
 *          originHost The origin hostname.
 * @return {Boolean} True if the destination hostname is a subdomain of the
 *         origin hostname.
 */
DomainUtil.destinationIsSubdomainOfOrigin = function(destinationHost,
    originHost) {
  var destHostNoWww = this.stripWww(destinationHost);
  var originHostNoWww = this.stripWww(originHost);

  var lengthDifference = destHostNoWww.length - originHostNoWww.length;
  if (lengthDifference > 1) {
    if (destHostNoWww.substring(lengthDifference - 1) == '.' + originHostNoWww) {
      return true;
    }
  }
  return false;
};

// TODO: Maybe this should have a different home.
/**
 * Gets the relevant pieces out of a meta refresh or header refresh string.
 * 
 * @param {String}
 *          refreshString The original content of a refresh header or meta tag.
 * @return {Array} First element is the delay in seconds, second element is the
 *         url to refresh to.
 */
DomainUtil.parseRefresh = function(refreshString) {
  var parts = /^\s*(\S*)\s*;\s*url\s*=\s*(.*?)\s*$/i(refreshString);
  // Strip off enclosing quotes around the url.
  var first = parts[2][0];
  var last = parts[2][parts[2].length - 1];
  if (first == last && (first == "'" || first == '"')) {
    parts[2] = parts[2].substring(1, parts[2].length - 1)
  }
  return [parts[1], parts[2]];
}

/**
 * Adds a path of "/" to the uri if it doesn't have one. That is,
 * "http://127.0.0.1" is returned as "http://127.0.0.1/". Will return the origin
 * uri if the provided one is not valid.
 * 
 * @param {String}
 *          uri
 * @return {String}
 */
DomainUtil.ensureUriHasPath = function(uri) {
  try {
    return this._ios.newURI(uri, null, null).spec;
  } catch (e) {
    return uri;
  }
}

/**
 * Given an origin URI string and a destination path to redirect to, returns a
 * string which is a valid uri which will be/should be redirected to. This takes
 * into account whether the destPath is an absolute path (starts with a slash)
 * or is relative to the originUri path.
 * 
 * @param {String}
 *          originUri
 * @param {String}
 *          destPath
 * @return {String}
 */
DomainUtil.determineRedirectUri = function(originUri, destPath) {
  if (destPath[0] == '/') {
    return this.getPrePath(originUri) + destPath
  } else {
    var curDir = originUri.split("/").slice(0, -1).join("/");
    return curDir + "/" + destPath;
  }
}
