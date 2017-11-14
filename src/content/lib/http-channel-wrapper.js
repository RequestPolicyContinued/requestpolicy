/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2016 Martin Kimmerle
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
import * as WindowUtils from "content/lib/utils/window-utils";

// =============================================================================
// HttpChannelWrapper
// =============================================================================

export class HttpChannelWrapper {
  constructor(aHttpChannel) {
    this._httpChannel = aHttpChannel;
  }

  get uri() {
    if (!this.hasOwnProperty("_uri")) {
      this._uri = Services.io.newURI(this._httpChannel.name, null, null);
    }
    return this._uri;
  }

  get loadContext() {
    if (!this.hasOwnProperty("_loadContext")) {
      // more info on the load context:
      // https://developer.mozilla.org/en-US/Firefox/Releases/3.5/Updating_extensions

      /* start - be careful when editing here */
      try {
        /* eslint-disable new-cap */
        this._loadContext = this._httpChannel.notificationCallbacks.
                            QueryInterface(Ci.nsIInterfaceRequestor).
                            getInterface(Ci.nsILoadContext);
        /* eslint-enable new-cap */
      } catch (ex) {
        try {
          this._loadContext = this._httpChannel.loadGroup.
                              notificationCallbacks.
                              getInterface(Ci.nsILoadContext);
        } catch (ex2) {
          // FIXME: the Load Context can't be found in case a favicon
          //        request is redirected, that is, the server responds
          //        with a 'Location' header when the server's
          //        `favicon.ico` is requested.
          log.warn("The HTTPChannel's " +
                         "Load Context couldn't be found! " + ex2);
          this._loadContext = null;
        }
      }
      /* end - be careful when editing here */
    }
    return this._loadContext;
  }

  /**
   * Get the <browser> related to this request.
   * @return {?nsIDOMXULElement}
   */
  get browser() {
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
          log.warn("The browser for " +
                         "the HTTPChannel's Load Context couldn't be " +
                         "found! " + e);
          this._browser = null;
        }
      }
    }
    return this._browser;
  }

  /**
   * Get the DocShell related to this request.
   * @return {?nsIDocShell}
   */
  get docShell() {
    if (!this.hasOwnProperty("_docShell")) {
      try {
        /* eslint-disable new-cap */
        this._docShell = this._httpChannel.notificationCallbacks.
                         QueryInterface(Ci.nsIInterfaceRequestor).
                         getInterface(Ci.nsIDocShell);
        /* eslint-enable new-cap */
      } catch (e) {
        log.warn("The HTTPChannel's DocShell couldn't be found!", e);
        this._docShell = null;
      }
    }
    return this._docShell;
  }
}
