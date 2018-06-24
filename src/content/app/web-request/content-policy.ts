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

import {
  XpcomClassFactoryModule,
} from "legacy/lib/classes/xpcom-class-factory-module";
import { Common } from "common/interfaces";
import { XPCOM, JSMs, API } from "bootstrap/api/interfaces";
import { NonDI } from "non-di-interfaces";
import { defer } from "lib/utils/js-utils";

export class RPContentPolicy extends XpcomClassFactoryModule {
  protected readonly XPCOM_CATEGORIES = ["content-policy"];

  protected readonly classDescription = "RequestPolicy ContentPolicy Implementation";
  protected readonly interfaceID = "{d734b30a-996c-4805-be24-25a0738249fe}";
  protected readonly contractID = "@requestpolicy.org/content-policy;1";

  private CP_OK = this.xpcComponentInterfaces.nsIContentPolicy.ACCEPT;

  // FIXME: suspend all requests before this module is ready
  private forcedReturnValue: number | null = this.CP_OK;

  private dCapturing = defer();

  constructor(
      moduleName: string,
      parentLog: Common.ILog,
      xpconnectService: API.IXPConnectService,
      xpcComponentInterfaces: XPCOM.nsXPCComponents_Interfaces,
      xpcComponentResults: XPCOM.nsXPCComponents_Results,
      xpcComponentID: XPCOM.nsXPCComponents["ID"],
      XPCOMUtils: JSMs.XPCOMUtils,
      private readonly requestProcessor: NonDI.IRequestProcessor,
      private readonly normalRequestFactory: NonDI.NormalRequestFactory,
  ) {
    super(
        moduleName,
        parentLog,
        xpconnectService,
        xpcComponentInterfaces,
        xpcComponentResults,
        xpcComponentID,
        XPCOMUtils,
    );
  }

  getImplementedInterfaces() {
    return super.getImplementedInterfaces().concat([
      this.xpcComponentInterfaces.nsIContentPolicy,
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
    this.forcedReturnValue = this.CP_OK;
  }

  // ---------------------------------------------------------------------------
  // nsIContentPolicy interface implementation
  // ---------------------------------------------------------------------------

  public shouldLoad(
      aContentType: any, aContentLocation: any, aRequestOrigin: any,
      aContext: any, aMimeTypeGuess: any, aExtra: any, aRequestPrincipal: any,
  ) {
    if (this.forcedReturnValue !== null) {
      return this.forcedReturnValue;
    }

    const request = this.normalRequestFactory(
        aContentType, aContentLocation, aRequestOrigin, aContext,
        aMimeTypeGuess, aExtra, aRequestPrincipal,
    );
    return this.requestProcessor.process(request);
  }
}
