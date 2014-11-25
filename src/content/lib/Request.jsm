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

var EXPORTED_SYMBOLS = [
  "Request",
  "NormalRequest",
  "RedirectRequest",

  "REQUEST_TYPE_NORMAL",
  "REQUEST_TYPE_REDIRECT"
];

const CI = Components.interfaces;
const CC = Components.classes;

const REQUEST_TYPE_NORMAL = 1;
const REQUEST_TYPE_REDIRECT = 2;


if (!rp) {
  var rp = {mod : {}};
}
Components.utils.import("chrome://requestpolicy/content/lib/DomainUtil.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/Logger.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/Util.jsm", rp.mod);




function Request(originURI, destURI, requestType) {
  this.originURI = originURI;
  this.destURI = destURI;
  this.requestType = requestType;

  // TODO: Merge "RequestResult" into this class.
  this.requestResult = undefined;
}

Request.prototype.setOriginURI = function(originURI) {
  this.originURI = originURI;
};

Request.prototype.setDestURI = function(destURI) {
  this.destURI = destURI;
};

Request.prototype.detailsToString = function() {
  // Note: try not to cause side effects of toString() during load, so "<HTML
  // Element>" is hard-coded.
  return "destination: " + this.destURI + ", origin: " + this.originURI;
};




function NormalRequest(aContentType, aContentLocation, aRequestOrigin, aContext,
    aMimeTypeGuess, aExtra, aRequestPrincipal) {
  Request.call(this,
      // About originURI and destURI:
      // We don't need to worry about ACE formatted IDNs because it seems
      // that they'll automatically be converted to UTF8 format before we
      // even get here, as long as they're valid and Mozilla allows the TLD
      // to have UTF8 formatted IDNs.
      aRequestOrigin ? aRequestOrigin.specIgnoringRef : undefined, // originURI
      aContentLocation.specIgnoringRef, // destURI
      REQUEST_TYPE_NORMAL);

  this.aContentType = aContentType;
  this.aContentLocation = aContentLocation;
  this.aRequestOrigin = aRequestOrigin;
  this.aContext = aContext;
  this.aMimeTypeGuess = aMimeTypeGuess;
  this.aExtra = aExtra;
  this.aRequestPrincipal = aRequestPrincipal;

  this.shouldLoadResult = undefined;
}
NormalRequest.prototype = Object.create(Request.prototype);
NormalRequest.prototype.constructor = Request;

NormalRequest.prototype.setOriginURI = function(originURI) {
  this.originURI = originURI;
  this.aRequestOrigin = rp.mod.DomainUtil.
          getUriObject(originURI);
};

NormalRequest.prototype.setDestURI = function(destURI) {
  this.destURI = destURI;
  this.aContentLocation = rp.mod.DomainUtil.
      getUriObject(destURI);
};

NormalRequest.prototype.detailsToString = function() {
  // Note: try not to cause side effects of toString() during load, so "<HTML
  // Element>" is hard-coded.
  return "type: " + this.aContentType +
      ", destination: " + this.destURI +
      ", origin: " + this.originURI +
      ", context: " + ((this.aContext) instanceof (CI.nsIDOMHTMLElement)
          ? "<HTML Element>"
          : this.aContext) +
      ", mime: " + this.aMimeTypeGuess +
      ", " + this.aExtra;
};

/**
  * Determines if a request is only related to internal resources.
  *
  * @return {Boolean} true if the request is only related to internal
  *         resources.
  */
NormalRequest.prototype.isInternal = function() {
  // Note: Don't OK the origin scheme "moz-nullprincipal" without further
  // understanding. It appears to be the source when test8.html is used. That
  // is, javascript redirect to a "javascript:" url that creates the entire
  // page's content which includes a form that it submits. Maybe
  // "moz-nullprincipal" always shows up when using "document.location"?

  // Not cross-site requests.
  if (this.aContentLocation.scheme == "resource"
      || this.aContentLocation.scheme == "about"
      || this.aContentLocation.scheme == "data"
      || this.aContentLocation.scheme == "chrome"
      || this.aContentLocation.scheme == "moz-icon"
      || this.aContentLocation.scheme == "moz-filedata"
      || this.aContentLocation.scheme == "blob"
      || this.aContentLocation.scheme == "wyciwyg"
      || this.aContentLocation.scheme == "javascript") {
    return true;
  }

  if (this.aRequestOrigin === undefined || this.aRequestOrigin === null) {
    return true;
  }

  if (this.aRequestOrigin.spec === "") {
    // The spec can be empty if odd things are going on, like the Refcontrol
    // extension causing back/forward button-initiated requests to have
    // aRequestOrigin be a virtually empty nsIURL object.
    rp.mod.Logger.info(rp.mod.Logger.TYPE_CONTENT,
        "Allowing request with empty aRequestOrigin spec!");
    return true;
  }

  if (this.aRequestOrigin.asciiHost === undefined ||
      this.aContentLocation.asciiHost === undefined) {
    // The asciiHost values will exist but be empty strings for the "file"
    // scheme, so we don't want to allow just because they are empty strings,
    // only if not set at all.
    rp.mod.Logger.info(rp.mod.Logger.TYPE_CONTENT,
        "Allowing request with no asciiHost on either aRequestOrigin <" +
        this.aRequestOrigin.spec + "> or aContentLocation <" +
        this.aContentLocation.spec + ">");
    return true;
  }

  var destHost = this.aContentLocation.asciiHost;

  // "global" dest are [some sort of interal requests]
  // "browser" dest are [???]
  if (destHost == "global" || destHost == "browser") {
    return true;
  }

  // see issue #180
  if (this.aRequestOrigin.scheme == 'about' &&
      this.aRequestOrigin.spec.indexOf("about:neterror?") == 0) {
    return true;
  }

  // If there are entities in the document, they may trigger a local file
  // request. We'll only allow requests to .dtd files, though, so we don't
  // open up all file:// destinations.
  if (this.aContentLocation.scheme == "file" &&
      this.aContentType == CI.nsIContentPolicy.TYPE_DTD) {
    return true;
  }

  return false;
};

/**
 * Get the nsIDOMWindow related to this request.
 */
NormalRequest.prototype.getWindow = function() {
  let context = this.aContext;
  if (!context) {
    return null;
  }

  let win;
  try {
    win = context.QueryInterface(CI.nsIDOMWindow);
  } catch (e) {
    let doc;
    try {
      doc = context.QueryInterface(CI.nsIDOMDocument);
    } catch (e) {
      try {
        doc = context.QueryInterface(CI.nsIDOMNode).ownerDocument;
      } catch(e) {
        return null;
      }
    }
    win = doc.defaultView;
  }
  return win;
};


// see https://github.com/RequestPolicyContinued/requestpolicy/issues/447
var knownSchemesWithoutHost = [
  // common schemes
  "about",
  "feed",
  "mediasource",
  "mailto",

  // custom schemes
  "magnet",
  "UT2004"
];

function isKnownSchemeWithoutHost(scheme) {
  for (let i = 0, len = knownSchemesWithoutHost.length; i < len; ++i) {
    if (scheme == knownSchemesWithoutHost[i]) {
      return true;
    }
  }
  return false;
}

NormalRequest.prototype.checkURISchemes = function() {
/**
  * This is a workaround to the problem that RequestPolicy currently cannot
  * handle some URIs. This workaround should be removed not later than for
  * the stable 1.0 release.
  *
  * see https://github.com/RequestPolicyContinued/requestpolicy/issues/447
  *
  * TODO: solve this problem and remove this workaround.
  */
  let uris = [this.aContentLocation, this.aRequestOrigin];
  for (let i = 0; i < 2; ++i) {
    let uri = uris[i];

    // filter URIs which *do* have a host
    try {
      // this might throw NS_ERROR_FAILURE
      if (uri.host) {
        continue;
      }
    } catch(e) {}

    // ensure that the URI has a scheme
    try {
      if (!uri.scheme) {
        throw "no scheme!";
      }
    } catch(e) {
      rp.mod.Logger.warning(rp.mod.Logger.TYPE_CONTENT,
          "URI <" + uri.spec + "> has no scheme!");
      continue;
    }

    let scheme = uri.scheme;
    if (scheme == "file") {
      continue;
    }

    if (isKnownSchemeWithoutHost(scheme)) {
      rp.mod.Logger.warning(rp.mod.Logger.TYPE_CONTENT,
          "RequestPolicy currently cannot handle '" + scheme + "' schemes. " +
          "Therefore the request from <" + this.originURI + "> to <" +
          this.destURI + "> is allowed (but not recorded).");
      // tell shouldLoad() to return CP_OK:
      return {shouldLoad: true};
    }

    // if we get here, the scheme is unknown. try to show a notification.
    rp.mod.Logger.warning(rp.mod.Logger.TYPE_CONTENT,
        "uncatched scheme '" + scheme + "'. The request is from <" +
        this.originURI + "> to <" + this.destURI + "> ");
    try {
      let win = this.getWindow();
      if (!win) {
        throw "The window could not be extracted from aContext.";
      }
      rp.mod.Util.getChromeWindow(win).requestpolicy.overlay
          .showSchemeNotification(win, scheme);
    } catch (e) {
      rp.mod.Logger.warning(rp.mod.Logger.TYPE_ERROR,
                            "The user could not be informed about the " +
                            "unknown scheme. Error was: " + e);
    }
  }

  return {shouldLoad: null};
};




function RedirectRequest(originURI, destURI, httpHeader) {
  Request.call(this, originURI, destURI, REQUEST_TYPE_REDIRECT);

  this.httpHeader = httpHeader;
}
RedirectRequest.prototype = Object.create(Request.prototype);
RedirectRequest.prototype.constructor = Request;
