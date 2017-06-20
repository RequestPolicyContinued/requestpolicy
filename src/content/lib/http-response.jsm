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

/* global Components */
const {interfaces: Ci, results: Cr, utils: Cu} = Components;

/* exported HttpResponse */
/* exported EXPORTED_SYMBOLS */
var EXPORTED_SYMBOLS = ["HttpResponse"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {Logger} = importModule("lib/logger");
let {DomainUtil} = importModule("lib/utils/domains");
let {WindowUtils} = importModule("lib/utils/windows");
let {Prefs} = importModule("models/prefs");

//==============================================================================
// HttpResponse
//==============================================================================

function HttpResponse(aHttpChannel) {
  this.httpChannel = aHttpChannel;

  this._determineRedirectionHeader();
}

HttpResponse.HEADER_TYPES = Object.freeze(["Location", "Refresh"]);

HttpResponse.prototype.removeResponseHeader = function() {
  this.httpChannel.setResponseHeader(this.redirHeaderType, "", false);
};

/**
 * Get the value of a particular response header.
 *
 * @return {String|undefined} The header's value, or `undefined`
 *     if the header does not exist.
 */
HttpResponse.prototype._getResponseHeader = function(aHeaderName) {
  try {
    return this.httpChannel.getResponseHeader(aHeaderName);
  } catch (e) {
    if (e.result !== Cr.NS_ERROR_NOT_AVAILABLE) {
      Cu.reportError(e);
    }
    // The header is not set in the response.
    return undefined;
  }
};

/**
 * Determine `headerType` and `headerValue`.
 */
HttpResponse.prototype._determineRedirectionHeader = function() {
  if (this.hasOwnProperty("hasRedirectionHeader")) {
    // Determine only once.
    return;
  }

  for (let headerType of HttpResponse.HEADER_TYPES) {
    let headerValue = this._getResponseHeader(headerType);
    if (headerValue !== undefined) {
      // The redirection header exists.
      this.hasRedirectionHeader = true;
      this.redirHeaderType = headerType;
      this.redirHeaderValue = headerValue;
      return;
    }
  }

  // No redirection header in the response.
  this.hasRedirectionHeader = false;
  this.redirHeaderType = null;
  this.redirHeaderValue = null;
};

Object.defineProperty(HttpResponse.prototype, "rawDestString", {
  get: function() {
    if (!this.hasOwnProperty("_rawDestString")) {
      switch (this.redirHeaderType) {
        case "Location":
          this._rawDestString = this.redirHeaderValue;
          break;

        case "Refresh":
          try {
            // We can ignore the delay because we aren't manually doing
            // the refreshes. Allowed refreshes we still leave to the browser.
            // The rawDestString may be empty if the origin is what should
            // be refreshed.
            // This will be handled by DomainUtil.determineRedirectUri().
            this._rawDestString = DomainUtil.
                                  parseRefresh(this.redirHeaderValue).destURI;
          } catch (e) {
            Logger.warning(Logger.TYPE_HEADER_REDIRECT,
                "Invalid refresh header: <" + this.redirHeaderValue + ">");
            if (!Prefs.isBlockingDisabled()) {
              this.removeResponseHeader();
            }
            this._rawDestString = null;
          }
          break;

        default:
          this._rawDestString = null;
          break;
      }
    }
    return this._rawDestString;
  }
});

Object.defineProperty(HttpResponse.prototype, "destURI", {
  get: function() {
    if (!this.hasOwnProperty("_destURI")) {
      this._destURI = Services.io.newURI(this.rawDestString, null,
                                         this.originURI);
    }
    return this._destURI;
  }
});

Object.defineProperty(HttpResponse.prototype, "originURI", {
  get: function() {
    if (!this.hasOwnProperty("_originURI")) {
      this._originURI = Services.io.newURI(this.httpChannel.name, null, null);
    }
    return this._originURI;
  }
});

Object.defineProperty(HttpResponse.prototype, "loadContext", {
  get: function() {
    if (!this.hasOwnProperty("_loadContext")) {
      // more info on the load context:
      // https://developer.mozilla.org/en-US/Firefox/Releases/3.5/Updating_extensions

      /* start - be careful when editing here */
      try {
        this._loadContext = this.httpChannel.notificationCallbacks
                               .QueryInterface(Ci.nsIInterfaceRequestor)
                               .getInterface(Ci.nsILoadContext);
      } catch (ex) {
        try {
          this._loadContext = this.httpChannel.loadGroup
                                 .notificationCallbacks
                                 .getInterface(Ci.nsILoadContext);
        } catch (ex2) {
          // fixme: the Load Context can't be found in case a favicon
          //        request is redirected, that is, the server responds
          //        with a 'Location' header when the server's
          //        `favicon.ico` is requested.
          Logger.warning(Logger.TYPE_HEADER_REDIRECT, "The redirection's " +
                         "Load Context couldn't be found! " + ex2);
          this._loadContext = null;
        }
      }
      /* end - be careful when editing here */
    }
    return this._loadContext;
  }
});

/**
 * Get the <browser> related to this request.
 * @return {?nsIDOMXULElement}
 */
Object.defineProperty(HttpResponse.prototype, "browser", {
  get: function() {
    if (!this.hasOwnProperty("_browser")) {
      let loadContext = this.loadContext;

      if (loadContext === null) {
        this._browser = null;
      } else {
        try {
          if (loadContext.topFrameElement) {
            // the top frame element should be already the browser element
            this._browser = loadContext.topFrameElement;
          } else {
            // we hope the associated window is available. in multiprocessor
            // firefox it's not available.
            this._browser = WindowUtils.
                            getBrowserForWindow(loadContext.topWindow);
          }
        } catch (e) {
          Logger.warning(Logger.TYPE_HEADER_REDIRECT, "The browser for " +
                         "the redirection's Load Context couldn't be " +
                         "found! " + e);
          this._browser = null;
        }
      }
    }
    return this._browser;
  }
});

/**
 * Get the DocShell related to this request.
 * @return {?nsIDocShell}
 */
Object.defineProperty(HttpResponse.prototype, "docShell", {
  get: function() {
    if (!this.hasOwnProperty("_docShell")) {
      try {
        this._docShell = this.httpChannel.notificationCallbacks.
                         QueryInterface(Ci.nsIInterfaceRequestor).
                         getInterface(Ci.nsIDocShell);
      } catch (e) {
        Logger.warning(Logger.TYPE_HEADER_REDIRECT,
                       "The redirection's DocShell couldn't be " +
                       "found! " + e);
        this._docShell = null;
      }
    }
    return this._docShell;
  }
});
