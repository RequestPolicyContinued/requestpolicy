/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = [
  "HttpResponse"
];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/logger",
  "lib/utils/domains",
  "lib/utils/windows"
], this);



function HttpResponse(aHttpChannel) {
  this.httpChannel = aHttpChannel;

  this.containsRedirection = undefined;
  this.redirHeaderType = undefined;
  this.redirHeaderValue = undefined;

  // initialize
  determineHttpHeader.call(this);
  XPCOMUtils.defineLazyGetter(this, "rawDestString", getRawDestString);
  XPCOMUtils.defineLazyGetter(this, "destURI", getDestURI);
  XPCOMUtils.defineLazyGetter(this, "originURI", getOriginURI);

  XPCOMUtils.defineLazyGetter(this, "loadContext", getLoadContext);
  XPCOMUtils.defineLazyGetter(this, "browser", getBrowser);
  XPCOMUtils.defineLazyGetter(this, "docShell", getDocShell);
}

HttpResponse.headerTypes = ["Location", "Refresh"];

HttpResponse.prototype.removeResponseHeader = function() {
  this.httpChannel.setResponseHeader(this.redirHeaderType, "", false);
};





/**
 * This function calls getResponseHeader(headerType). If there is no such
 * header, that function will throw NS_ERROR_NOT_AVAILABLE.
 */
function determineHttpHeader() {
  this.containsRedirection = true;

  for (let i in HttpResponse.headerTypes) {
    try {
      this.redirHeaderType = HttpResponse.headerTypes[i];
      this.redirHeaderValue = this.httpChannel.getResponseHeader(this.redirHeaderType);
      // In case getResponseHeader() didn't throw NS_ERROR_NOT_AVAILABLE,
      // the header-type exists, so we return:
      return;
    } catch (e) {
    }
  }

  // The following will be executed when there is no redirection:
  this.containsRedirection = false;
  this.redirHeaderType = null;
  this.redirHeaderValue = null;
}

function getRawDestString() {
  switch (this.redirHeaderType) {
    case "Location":
      return this.redirHeaderValue;

    case "Refresh":
      try {
        // We can ignore the delay because we aren't manually doing
        // the refreshes. Allowed refreshes we still leave to the browser.
        // The rawDestString may be empty if the origin is what should be refreshed.
        // This will be handled by DomainUtil.determineRedirectUri().
        return DomainUtil.parseRefresh(this.redirHeaderValue).destURI;
      } catch (e) {
        Logger.warning(Logger.TYPE_HEADER_REDIRECT,
            "Invalid refresh header: <" + this.redirHeaderValue + ">");
        if (!Prefs.isBlockingDisabled()) {
          this.removeResponseHeader();
        }
        return null;
      }

    default:
      return null;
  }
}

function getDestURI() {
  return Services.io.newURI(this.rawDestString, null, this.originURI);
}

function getOriginURI() {
  return Services.io.newURI(this.httpChannel.name, null, null);
}

function getLoadContext() {
  // more info on the load context:
  // https://developer.mozilla.org/en-US/Firefox/Releases/3.5/Updating_extensions

  /* start - be careful when editing here */
  try {
    return this.httpChannel.notificationCallbacks
                           .QueryInterface(Ci.nsIInterfaceRequestor)
                           .getInterface(Ci.nsILoadContext);
  } catch (ex) {
    try {
      return this.httpChannel.loadGroup
                             .notificationCallbacks
                             .getInterface(Ci.nsILoadContext);
    } catch (ex2) {
      // fixme: the Load Context can't be found in case a favicon
      //        request is redirected, that is, the server responds
      //        with a 'Location' header when the server's
      //        `favicon.ico` is requested.
      Logger.warning(Logger.TYPE_HEADER_REDIRECT, "The redirection's " +
                     "Load Context couldn't be found! " + ex2);
      return null;
    }
  }
  /* end - be careful when editing here */
}

/**
 * Get the <browser> related to this request.
 * @return {?nsIDOMXULElement}
 */
function getBrowser() {
  let loadContext = this.loadContext;

  if (loadContext === null) {
    return null;
  }

  try {
    if (loadContext.topFrameElement) {
      // the top frame element should be already the browser element
      return loadContext.topFrameElement;
    } else {
      // we hope the associated window is available. in multiprocessor
      // firefox it's not available.
      return WindowUtils.getBrowserForWindow(loadContext.topWindow);
    }
  } catch (e) {
    Logger.warning(Logger.TYPE_HEADER_REDIRECT, "The browser for " +
                   "the redirection's Load Context couldn't be " +
                   "found! " + e);
    return null;
  }
}

/**
 * Get the DocShell related to this request.
 * @return {?nsIDocShell}
 */
function getDocShell() {
  try {
    return this.httpChannel.notificationCallbacks
                           .QueryInterface(Ci.nsIInterfaceRequestor)
                           .getInterface(Ci.nsIDocShell);
  } catch (e) {
    Logger.warning(Logger.TYPE_HEADER_REDIRECT,
                   "The redirection's DocShell couldn't be " +
                   "found! " + e);
    return null;
  }
}
