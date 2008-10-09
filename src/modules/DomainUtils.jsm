var EXPORTED_SYMBOLS = ["DomainUtils"]

const CI = Components.interfaces;
const CC = Components.classes;

var DomainUtils = {};

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
  return DomainUtils.stripWww(destinationHost) == DomainUtils
      .stripWww(originHost);

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
  var destHostNoWww = DomainUtils.stripWww(destinationHost);
  var originHostNoWww = DomainUtils.stripWww(originHost);

  var lengthDifference = destHostNoWww.length - originHostNoWww.length;
  if (lengthDifference > 1) {
    if (destHostNoWww.substring(lengthDifference - 1) == '.' + originHostNoWww) {
      return true;
    }
  }
  return false;
};
