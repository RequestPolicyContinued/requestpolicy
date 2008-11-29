var EXPORTED_SYMBOLS = ["DomainUtils"]

const CI = Components.interfaces;
const CC = Components.classes;

var DomainUtils = {};

DomainUtils._ios = CC["@mozilla.org/network/io-service;1"]
    .getService(CI.nsIIOService);

DomainUtils._eTLDService = Components.classes["@mozilla.org/network/effective-tld-service;1"]
    .getService(Components.interfaces.nsIEffectiveTLDService);

// LEVEL_DOMAIN: Use example.com from http://www.a.example.com:81
DomainUtils.LEVEL_DOMAIN = 1;
// LEVEL_HOST: Use www.a.example.com from http://www.a.example.com:81
DomainUtils.LEVEL_HOST = 2;
// LEVEL_SOP: Use http://www.a.example.com:81 from http://www.a.example.com:81
DomainUtils.LEVEL_SOP = 3;

DomainUtils.getIdentifier = function(uri, level) {
  var identifier;
  switch (level) {
    case this.LEVEL_DOMAIN :
      try {
        identifier = this.getDomain(uri);
        if (identifier) {
          return identifier;
        }
      } catch (e) {
        // fall through
      }
    case this.LEVEL_HOST :
      try {
        identifier = this.getHost(uri);
        if (identifier) {
          return identifier;
        }
      } catch (e) {
        // fall through
      }

    case this.LEVEL_SOP :
      try {
        identifier = this.getPrePath(uri);
        if (identifier) {
          return identifier;
        }
      } catch (e) {
        // fall through
      }

    default :
      return uri;
  }
};

DomainUtils.identifierIsInUri = function(identifier, uri, level) {
  return identifier == this.getIdentifier(uri, level);
};

/**
 * Returns the hostname from a uri string.
 * 
 * @param {String}
 *            uri The uri.
 * @return {String} The hostname of the uri.
 */
DomainUtils.getHost = function(uri) {
  return this._ios.newURI(uri, null, null).host
};

/**
 * Returns the domain from a uri string.
 * 
 * @param {String}
 *            uri The uri.
 * @return {String} The domain of the uri.
 */
DomainUtils.getDomain = function(uri) {
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
 *            uri The uri.
 * @return {String} The prePath of the uri.
 */
DomainUtils.getPrePath = function(uri) {
  return this._ios.newURI(uri, null, null).prePath;
};

/**
 * Strips any "www." from the beginning of a hostname.
 * 
 * @param {String}
 *            hostname The hostname to strip.
 * @return {String} The hostname with any leading "www." removed.
 */
DomainUtils.stripWww = function(hostname) {
  return hostname.indexOf('www.') == 0 ? hostname.substring(4) : hostname;
};

/**
 * Determine if two hostnames are the same if any "www." prefix is ignored.
 * 
 * @param {String}
 *            destinationHost The destination hostname.
 * @param {String}
 *            originHost The origin hostname.
 * @return {Boolean} True if the hostnames are the same regardless of "www.",
 *         false otherwise.
 */
DomainUtils.sameHostIgnoreWww = function(destinationHost, originHost) {
  return destinationHost
      && this.stripWww(destinationHost) == this.stripWww(originHost);

};

DomainUtils.stripFragment = function(uri) {
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
 *            destinationHost The destination hostname.
 * @param {String}
 *            originHost The origin hostname.
 * @return {Boolean} True if the destination hostname is a subdomain of the
 *         origin hostname.
 */
DomainUtils.destinationIsSubdomainOfOrigin = function(destinationHost,
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
 *            refreshString The original content of a refresh header or meta
 *            tag..
 * @return {Array} First element is the delay in seconds, second element is the
 *         url to refresh to.
 */
DomainUtils.parseRefresh = function(refreshString) {
  var parts = /^\s*(\S*)\s*;\s*url\s*=\s*(.*?)\s*$/i(refreshString);
  return [parts[1], parts[2]];
}

/**
 * Adds a path of "/" to the uri if it doesn't have one. That is,
 * "http://127.0.0.1" is returned as "http://127.0.0.1/". Will return the origin
 * uri if the provided one is not valid.
 * 
 * @param {String}
 *            uri
 * @return {String}
 */
DomainUtils.ensureUriHasPath = function(uri) {
  try {
    return this._ios.newURI(uri, null, null).spec;
  } catch (e) {
    return uri;
  }
}
