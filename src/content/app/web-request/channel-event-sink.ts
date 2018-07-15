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

import { App } from "app/interfaces";
import {API, JSMs, XPCOM} from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import {
  XpcomClassFactoryModule,
} from "legacy/lib/classes/xpcom-class-factory-module";
import { HttpChannelWrapper } from "lib/classes/http-channel-wrapper";
import { defer } from "lib/utils/js-utils";
import { NonDI } from "non-di-interfaces";

export class RPChannelEventSink extends XpcomClassFactoryModule {
  protected readonly XPCOM_CATEGORIES = ["net-channel-event-sinks"];

  protected readonly classDescription =
      "RequestPolicy ChannelEventSink Implementation";
  protected readonly interfaceID = "{dc6e2000-2ff0-11e6-bdf4-0800200c9a66}";
  protected readonly contractID =
      "@requestpolicy.org/net-channel-event-sinks;1";

  private readonly CP_REJECT =
      this.xpcComponentInterfaces.nsIContentPolicy.REJECT_SERVER;
  private readonly CES_ACCEPT = this.xpcComponentResults.NS_OK;
  private readonly CES_REJECT = this.xpcComponentResults.NS_ERROR_FAILURE;

  // FIXME: suspend all redirects before this module is ready
  private forcedReturnValue: number | null = this.CES_ACCEPT;

  private dCapturing = defer();

  constructor(
      parentLog: Common.ILog,
      xpconnectService: API.IXPConnectService,
      xpcComponentInterfaces: XPCOM.nsXPCComponents_Interfaces,
      xpcComponentResults: XPCOM.nsXPCComponents_Results,
      xpcComponentID: XPCOM.nsXPCComponents["ID"],
      XPCOMUtils: JSMs.XPCOMUtils,
      private readonly requestProcessor: App.webRequest.IRequestProcessor,
      private readonly redirectRequestFactory: NonDI.RedirectRequestFactory,
  ) {
    super(
        "app.webRequest.channelEventSink",
        parentLog,
        xpconnectService,
        xpcComponentInterfaces,
        xpcComponentResults,
        xpcComponentID,
        XPCOMUtils,
    );
  }

  // ---------------------------------------------------------------------------
  // nsIChannelEventSink interface implementation
  // ---------------------------------------------------------------------------

  public asyncOnChannelRedirect(
      aOldChannel: XPCOM.nsIChannel,
      aNewChannel: XPCOM.nsIChannel,
      aFlags: number,
      aCallback: XPCOM.nsIAsyncVerifyRedirectCallback,
  ) {
    let result: number;
    if (this.forcedReturnValue !== null) {
      result = this.forcedReturnValue;
    } else {
      const oldChannelWrapper = new HttpChannelWrapper(
          aOldChannel as XPCOM.nsIHttpChannel,  // FIXME
      );
      const newChannelWrapper = new HttpChannelWrapper(
          aNewChannel as XPCOM.nsIHttpChannel,  // FIXME
      );
      const request = this.redirectRequestFactory(
          oldChannelWrapper, newChannelWrapper, aFlags,
      );
      const rv = this.requestProcessor.processUrlRedirection(request);
      result = rv === this.CP_REJECT ? this.CES_REJECT : this.CES_ACCEPT;
    }
    aCallback.onRedirectVerifyCallback(result);
  }

  // ---------------------------------------------------------------------------

  protected getImplementedInterfaces() {
    return super.getImplementedInterfaces().concat([
      this.xpcComponentInterfaces.nsIChannelEventSink,
      this.xpcComponentInterfaces.nsIObserver,
      this.xpcComponentInterfaces.nsISupportsWeakReference,
    ]);
  }

  protected startupSelf() {
    const pCapturing = this.requestProcessor.whenReady.then(() => {
      this.forcedReturnValue = null;
    });
    this.dCapturing.resolve(pCapturing);
    pCapturing.catch(this.log.onError("pCapturing"));

    return super.startupSelf();
  }

  protected beforeUnregistering() {
    this.log.log("shutting down RPChannelEventSink...");
    this.forcedReturnValue = this.CES_ACCEPT;
    super.beforeUnregistering();
  }
}
