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

import {JSMs, XPCOM, XUL} from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import {C} from "data/constants";
import { HttpChannelWrapper } from "lib/classes/http-channel-wrapper";
import { Module } from "lib/classes/module";
import {getBrowserForWindow} from "lib/utils/window-utils";

export class HttpChannelService extends Module {
  constructor(
      log: Common.ILog,
      private mozIOService: JSMs.Services["io"],
      private tcu: Common.ITryCatchUtils,
  ) {
    super("app.services.httpChannel", log);
  }

  public getUri(channel: HttpChannelWrapper): XPCOM.nsIURI {
    if (channel._uri === C.UNDEFINED) {
      channel._uri = this.mozIOService.newURI(
          channel.httpChannel.name, null, null,
      );
    }
    return channel._uri as XPCOM.nsIURI;
  }

  public getLoadContext(
      channel: HttpChannelWrapper,
  ): XPCOM.nsILoadContext | null {
    if (channel._loadContext === C.UNDEFINED) {
      const result = this.tcu.getLoadContextFromHttpChannel(
          channel.httpChannel,
      );
      channel._loadContext = result.value;
      if (channel._loadContext === null) {
        this.log.warn(`${"The HTTPChannel's " +
            "Load Context couldn't be found! "}${result.error}`);
      }
    }
    return channel._loadContext as XPCOM.nsILoadContext | null;
  }

  /**
   * Get the <browser> related to this request.
   */
  public getBrowser(channel: HttpChannelWrapper): XUL.browser | null {
    if (channel._browser === C.UNDEFINED) {
      const loadContext = this.getLoadContext(channel);

      if (loadContext === null) {
        channel._browser = null;
      } else {
        const result = this.tcu.getBrowserFromLoadContext(
            loadContext, getBrowserForWindow,
        );
        channel._browser = result.value as XUL.browser;
        if ("error" in result) {
          this.log.warn(
              "Error getting the HTTPChannel's load context: ",
              result.error,
          );
        } else if (channel._browser === null) {
          this.log.warn(
              "The browser for the HTTPChannel's load context " +
              "couldn't be found!");
        }
      }
    }
    return channel._browser as XUL.browser | null;
  }

  /**
   * Get the DocShell related to this request.
   */
  public getDocShell(channel: HttpChannelWrapper): XPCOM.nsIDocShell | null {
    if (!this.hasOwnProperty("_docShell")) {
      const result = this.tcu.getDocShellFromHttpChannel(channel.httpChannel);
      channel._docShell = result.value;
      if ("error" in result) {
        this.log.warn(
            "Error getting the HTTPChannel's DocShell: ",
            result.error,
        );
      } else if (channel._docShell === null) {
        this.log.warn("The HTTPChannel's DocShell couldn't be found!");
      }
    }
    return channel._docShell as XPCOM.nsIDocShell | null;
  }
}
