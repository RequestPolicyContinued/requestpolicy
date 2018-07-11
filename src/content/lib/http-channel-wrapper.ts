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
import {JSMs, XPCOM, XUL} from "bootstrap/api/interfaces";
import {C} from "data/constants";
import {
  getBrowserFromLoadContext,
  getDocShellFromHttpChannel,
  getLoadContextFromHttpChannel,
} from "lib/utils/try-catch-utils";
import {getBrowserForWindow} from "lib/utils/window-utils";

export class HttpChannelWrapper {
  // tslint:disable:variable-name
  private _docShell: XPCOM.nsIDocShell | null | typeof C["UNDEFINED"] =
      C.UNDEFINED;
  private _browser: XUL.browser | null | typeof C["UNDEFINED"] =
      C.UNDEFINED;
  private _loadContext: XPCOM.nsILoadContext | null | typeof C["UNDEFINED"] =
      C.UNDEFINED;
  private _uri: XPCOM.nsIURI | typeof C["UNDEFINED"] = C.UNDEFINED;
  // tslint:enable:variable-name

  constructor(
      private mozIOService: JSMs.Services["io"],
      public httpChannel: XPCOM.nsIHttpChannel,
  ) {}

  get uri(): XPCOM.nsIURI {
    if (this._uri === C.UNDEFINED) {
      this._uri = this.mozIOService.newURI(this.httpChannel.name, null, null);
    }
    return this._uri as XPCOM.nsIURI;
  }

  get loadContext(): XPCOM.nsILoadContext | null {
    if (this._loadContext === C.UNDEFINED) {
      const result = getLoadContextFromHttpChannel(this.httpChannel);
      this._loadContext = result.value;
      if (this._loadContext === null) {
        log.warn(`${"The HTTPChannel's " +
            "Load Context couldn't be found! "}${result.error}`);
      }
    }
    return this._loadContext as XPCOM.nsILoadContext | null;
  }

  /**
   * Get the <browser> related to this request.
   */
  get browser(): XUL.browser | null {
    if (this._browser === C.UNDEFINED) {
      const loadContext = this.loadContext;

      if (loadContext === null) {
        this._browser = null;
      } else {
        const result = getBrowserFromLoadContext(
            loadContext, getBrowserForWindow,
        );
        this._browser = result.value as XUL.browser;
        if ("error" in result) {
          log.warn(
              "Error getting the HTTPChannel's load context: ",
              result.error,
          );
        } else if (this._browser === null) {
          log.warn(
              "The browser for the HTTPChannel's load context " +
              "couldn't be found!");
        }
      }
    }
    return this._browser as XUL.browser | null;
  }

  /**
   * Get the DocShell related to this request.
   */
  get docShell(): XPCOM.nsIDocShell | null {
    if (!this.hasOwnProperty("_docShell")) {
      const result = getDocShellFromHttpChannel(this.httpChannel);
      this._docShell = result.value;
      if ("error" in result) {
        log.warn("Error getting the HTTPChannel's DocShell: ", result.error);
      } else if (this._docShell === null) {
        log.warn("The HTTPChannel's DocShell couldn't be found!");
      }
    }
    return this._docShell as XPCOM.nsIDocShell | null;
  }
}
