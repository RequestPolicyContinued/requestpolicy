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

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "logger",
  "utils/domains",
  "utils"
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
  XPCOMUtils.defineLazyGetter(this, "browser", getBrowser);
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

/**
 * Get the <browser> (nsIDOMXULElement) related to this request.
 */
function getBrowser() {
  /* start - be careful when editing here */
  let loadContext = null;
  try {
    loadContext = this.httpChannel.notificationCallbacks
                                  .QueryInterface(Ci.nsIInterfaceRequestor)
                                  .getInterface(Ci.nsILoadContext);
  } catch (ex) {
    try {
      loadContext = this.httpChannel.loadGroup.notificationCallbacks
          .getInterface(Ci.nsILoadContext);
    } catch (ex2) {
      return null;
    }
  }
  /* end - be careful when editing here */


  try {
    if (loadContext.topFrameElement) {
      // the top frame element should be already the browser element
      return loadContext.topFrameElement;
    } else {
      // we hope the associated window is available. in multiprocessor
      // firefox it's not available.
      return Utils.getBrowserForWindow(loadContext.topWindow);
    }
  } catch (e) {
    Logger.warning(Logger.TYPE_HEADER_REDIRECT, "The redirection's " +
                   "Load Context couldn't be found! " + e);
    return null;
  }
};
