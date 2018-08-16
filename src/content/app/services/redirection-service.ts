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
import { XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import { RedirectRequest } from "lib/classes/request";
import { tryMultipleTimes } from "lib/utils/misc-utils";

export class RedirectionService extends Module
    implements App.services.IRedirectionService {
  // protected get debugEnabled() { return true; }

  protected get dependencies(): Module[] {
    return [
      this.requestService,
      this.windowModuleMap,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      private readonly ci: XPCOM.nsXPCComponents_Interfaces,

      private readonly requestService: App.services.IRequestService,
      private readonly windowModuleMap: App.windows.IWindowModuleMap,
  ) {
    super(`app.services.redirections`, parentLog);
  }

  public maybeShowNotification(aRequest: RedirectRequest) {
    const {loadFlags} = aRequest;
    const topLevelDocFlag = this.ci.nsIChannel.LOAD_INITIAL_DOCUMENT_URI;

    // tslint:disable-next-line:no-bitwise
    if ((loadFlags & topLevelDocFlag) !== topLevelDocFlag) {
      // the request corresponds to a top-level document load
      return;
    }

    this.showNotification(aRequest).catch((e) => {
      this.log.warn(
          `A redirection of a top-level document has been observed, ` +
          `but it was not possible to notify the user! The redirection ` +
          `was from page <${aRequest.originURI}> to <${aRequest.destURI}>.`,
      );
    });
  }

  private showNotification(request: RedirectRequest): MaybePromise<void> {
    this.debugLog.log("going to show a redirection notification");
    const browser = this.requestService.getBrowser(request);
    if (browser === null) {
      this.debugLog.log("showNotification: browser n/a");
      return MaybePromise.reject<void>(undefined);
    }

    const window = browser.ownerGlobal;

    const p = tryMultipleTimes(() => {
      const windowModule = this.windowModuleMap.get(window);
      if (!windowModule) {
        this.debugLog.log("showNotification: window module n/a");
        return false;
      }

      // Parameter "replaceIfPossible" is set to true,
      // because the "origin" of
      // redirections going through "nsIChannelEventSink" is just an
      // intermediate URI of a redirection chain, not a real site.
      return windowModule.r21n.showNotification(
          browser,
          {
            origin: request.originURI,
            target: request.destURIWithRef,
          },
          0,
          true,
      );
    });
    return MaybePromise.resolve(p);
  }
}
