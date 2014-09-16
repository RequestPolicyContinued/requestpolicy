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

var EXPORTED_SYMBOLS = ["Request"];

Components.utils.import("resource://requestpolicy/DomainUtil.jsm");
Components.utils.import("resource://requestpolicy/Logger.jsm");
Components.utils.import("resource://requestpolicy/PolicyManager.jsm");


function Request(aContentType, aContentLocation, aRequestOrigin, aContext,
    aMimeTypeGuess, aExtra, aRequestPrincipal) {
  this.aContentType = aContentType;
  this.aContentLocation = aContentLocation;
  this.aRequestOrigin = aRequestOrigin;
  this.aContext = aContext;
  this.aMimeTypeGuess = aMimeTypeGuess;
  this.aExtra = aExtra;
  this.aRequestPrincipal = aRequestPrincipal;

  this.shouldLoadResult = undefined;

  // TODO: Merge "RequestResult" into this class.
  this.requestResult = undefined;
}

/**
  * Determines if a request is only related to internal resources.
  *
  * @return {Boolean} true if the request is only related to internal
  *         resources.
  */
Request.prototype.isInternal = function() {
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

  if (this.aRequestOrigin == undefined || this.aRequestOrigin == null) {
    return true;
  }

  var missingSpecOrHost;
  try {
    // The asciiHost values will exist but be empty strings for the "file"
    // scheme, so we don't want to allow just because they are empty strings,
    // only if not set at all.
    this.aRequestOrigin.asciiHost;
    this.aContentLocation.asciiHost;
    // The spec can be empty if odd things are going on, like the Refcontrol
    // extension causing back/forward button-initiated requests to have
    // aRequestOrigin be a virtually empty nsIURL object.
    missingSpecOrHost = this.aRequestOrigin.spec === "";
  } catch (e) {
    missingSpecOrHost = true;
  }

  if (missingSpecOrHost) {
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_CONTENT,
        "No asciiHost or empty spec on either aRequestOrigin <"
            + this.aRequestOrigin.spec + "> or aContentLocation <"
            + this.aContentLocation.spec + ">");
    return true;
  }

  var destHost = this.aContentLocation.asciiHost;

  // "global" dest are [some sort of interal requests]
  // "browser" dest are [???]
  if (destHost == "global" || destHost == "browser") {
    return true;
  }

  if (this.aRequestOrigin.scheme == 'about'
      && this.aRequestOrigin.spec.indexOf("about:neterror?") == 0) {
    return true;
  }

  // If there are entities in the document, they may trigger a local file
  // request. We'll only allow requests to .dtd files, though, so we don't
  // open up all file:// destinations.
  if (this.aContentLocation.scheme == "file"
      && /.\.dtd$/.test(this.aContentLocation.path)) {
    return true;
  }

  return false;
};
