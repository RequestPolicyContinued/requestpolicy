/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

import { API, JSMs, XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import {
  XpcomClassFactoryModule,
} from "legacy/lib/classes/xpcom-class-factory-module";

// =============================================================================
// utilities, constants
// =============================================================================

type ID =
    "advancedprefs" |
    "basicprefs" |
    "defaultpolicy" |
    "experimental" |
    "oldrules" |
    "setup" |
    "subscriptions" |
    "yourpolicy";

const FILENAMES = {
  advancedprefs: "advancedprefs.html",
  basicprefs: "basicprefs.html",
  defaultpolicy: "defaultpolicy.html",
  experimental: "experimental.html",
  oldrules: "oldrules.html",
  setup: "setup.html",
  subscriptions: "subscriptions.html",
  yourpolicy: "yourpolicy.html",
};

// =============================================================================
// AboutUri
// =============================================================================

export class AboutUri extends XpcomClassFactoryModule {
  protected readonly XPCOM_CATEGORIES = [];

  protected classDescription = "about:requestpolicy";
  protected contractID =
      "@mozilla.org/network/protocol/about;1?what=requestpolicy";
  protected interfaceID = "{77d4be21-6a28-4b91-9886-15ccd83795e8}";

  constructor(
      parentLog: Common.ILog,
      catManager: XPCOM.nsICategoryManager,
      compRegistrar: XPCOM.nsIComponentRegistrar,
      xpcComponentInterfaces:
          XPCOM.nsXPCComponents_Interfaces,
      xpcComponentResults: XPCOM.nsXPCComponents_Results,
      xpcComponentID: XPCOM.nsXPCComponents["ID"],
      XPCOMUtils: JSMs.XPCOMUtils,
      private readonly miscInfos: API.IMiscInfos,
      private readonly ioService: XPCOM.nsIIOService2,
  ) {
    super(
        `app.runtime.aboutUri`,
        parentLog,
        catManager,
        compRegistrar,
        xpcComponentInterfaces,
        xpcComponentResults,
        xpcComponentID,
        XPCOMUtils,
    );
  }

  public getURIFlags(aURI: XPCOM.nsIURI) {
    return this.xpcComponentInterfaces.nsIAboutModule.ALLOW_SCRIPT;
  }

  public newChannel(
      aURI: XPCOM.nsIURI,
      aLoadInfo: XPCOM.nsILoadInfo,
  ): XPCOM.nsIChannel {
    const uri = this.getURI(aURI);
    let channel;
    if (this.miscInfos.isGeckoVersionAtLeast("48.0a1")) {
      // newChannelFromURIWithLoadInfo is available since Gecko 48.
      channel = this.ioService.newChannelFromURIWithLoadInfo!(uri, aLoadInfo);
    } else {
      // newChannel is obsolete since Gecko 48 (Bug 1254752)
      channel = this.ioService.newChannelFromURI!(uri);
    }
    channel.originalURI = aURI;
    return channel;
  }

  protected getImplementedInterfaces() {
    return super.getImplementedInterfaces().concat([
      this.xpcComponentInterfaces.nsIAboutModule,
    ]);
  }

  private getURI(aURI: XPCOM.nsIURI) {
    let id: ID | undefined;
    const index = aURI.path.indexOf("?");
    if (index >= 0 && aURI.path.length > index) {
      id = aURI.path.substr(index + 1) as ID;
    }
    if (!id || !(id in FILENAMES)) {
      id = "basicprefs";
    }
    const spec = `chrome://rpcontinued/content/settings/${FILENAMES[id]}`;
    return this.ioService.newURI(spec, null, null);
  }
}
