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

import {log} from "app/log";
import {
  getLoadContextFromHttpChannel,
  getBrowserFromLoadContext,
  getDocShellFromHttpChannel,
} from "lib/utils/try-catch-utils";
import {getBrowserForWindow} from "lib/utils/window-utils";

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
      const result = getLoadContextFromHttpChannel(this._httpChannel);
      this._loadContext = result.value;
      if (this._loadContext === null) {
        log.warn(`${"The HTTPChannel's " +
            "Load Context couldn't be found! "}${result.error}`);
      }
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
        const result = getBrowserFromLoadContext(
            loadContext, getBrowserForWindow,
        );
        this._browser = result.value;
        if (this._browser === null) {
          log.warn(`${"The browser for " +
              "the HTTPChannel's Load Context couldn't be " +
              "found! "}${result.error}`);
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
      const result = getDocShellFromHttpChannel(this._httpChannel);
      this._docShell = result.value;
      if (this._docShell === null) {
        log.warn("The HTTPChannel's DocShell couldn't be found!", result.error);
      }
    }
    return this._docShell;
  }
}
