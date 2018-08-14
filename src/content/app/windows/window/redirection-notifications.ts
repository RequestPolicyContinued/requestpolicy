/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
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
import { XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import {C} from "data/constants";
import { Module } from "lib/classes/module";
import { getTabBrowser } from "lib/utils/window-utils";
import { IClassicmenuRuleSpec } from "./classicmenu";

export class RedirectionNotifications extends Module
    implements App.windows.window.IRedirectionNotifications {
  protected get debugEnabled() { return true; }

  private get gBrowser() { return getTabBrowser(this.window)!; }
  private get $str() { return this.i18n.getMessage.bind(browser.i18n); }

  protected get startupPreconditions() {
    return [
      this.runtime.whenReady,
      this.privateBrowsingService.whenReady,
      this.uriService.whenReady,
      this.windowService.whenReady,
      this.cachedSettings.whenReady,
      this.requestProcessor.whenReady,
    ];
  }

  constructor(
      readonly parentLog: Common.ILog,
      readonly windowID: number,
      private readonly window: XUL.chromeWindow,

      private readonly i18n: typeof browser.i18n,

      private readonly classicmenu: App.windows.window.IClassicMenu,
      private readonly menu: App.windows.window.IMenu,

      private readonly runtime: App.IRuntime,
      private readonly privateBrowsingService:
          App.services.IPrivateBrowsingService,
      private readonly uriService: App.services.IUriService,
      private readonly windowService: App.services.IWindowService,
      private readonly cachedSettings: App.storage.ICachedSettings,
      private readonly requestProcessor: App.webRequest.IRequestProcessor,
  ) {
    super(`app.windows[${windowID}].r21n`, parentLog);
  }

  public asyncShowNotification(
      vBrowser: XUL.browser,
      redirectTargetUri: string,
      delay: number,
      aRedirectOriginUri?: string,
      replaceIfPossible?: boolean,
  ): Promise<boolean> {
    const p = Promise.resolve().then(() => this.showNotification(
        vBrowser,
        redirectTargetUri,
        delay,
        aRedirectOriginUri,
        replaceIfPossible,
    ));
    p.catch(this.log.onError("failed to show redirection notification"));
    return p;
  }

  /**
   * Shows a notification that a redirect was requested by a page (meta refresh
   * or with headers).
   *
   * @return {boolean} whether showing the notification succeeded
   */
  public showNotification(
      vBrowser: XUL.browser,
      redirectTargetUri: string,
      delay: number,
      aRedirectOriginUri?: string,
      replaceIfPossible?: boolean,
  ): boolean {
    this.debugLog.log("going to show a redirection notification");

    // TODO: Do something with the delay. Not sure what the best thing to do is
    // without complicating the UI.

    // TODO: The following error seems to be resulting when the notification
    // goes away with a redirect, either after clicking "allow" or if the
    // redirect is allowed and happens automatically.
    //
    // Source file: chrome://browser/content/browser.js
    // Line: 3704
    // ----------
    // Error: this._closedNotification.parentNode is null
    // Source file: chrome://global/content/bindings/notification.xml
    // Line: 260

    // redirectOriginUri is optional and is not necessary for <meta> redirects.
    const isOriginUndefined = aRedirectOriginUri === undefined;
    const redirectOriginUri = aRedirectOriginUri ||
        this.windowService.getTopLevelDocumentUri(this.window);

    if (this.runtime.isFennec) {
      this.log.warn(
          `Should have shown redirect notification to <${redirectTargetUri
          }>, but it's not implemented yet on Fennec.`,
      );
      return false;
    }

    const notificationBox = this.gBrowser.getNotificationBox(vBrowser);
    const notificationValue = "request-policy-meta-redirect";

    // prepare the notification's label
    let notificationLabel;
    if (isOriginUndefined) {
      notificationLabel = this.$str(
          "redirectNotification",
          [
            this.cropUri(redirectTargetUri, 50),
          ],
      );
    } else {
      notificationLabel = this.$str(
          "redirectNotificationWithOrigin",
          [
            this.cropUri(redirectOriginUri, 50),
            this.cropUri(redirectTargetUri, 50),
          ],
      );
    }

    const addRuleMenuName = "rpcontinuedRedirectAddRuleMenu";
    const addRulePopup: XUL.menupopup = this.$id(addRuleMenuName) as any;
    this.classicmenu.emptyMenu(addRulePopup);

    const originBaseDomain = this.uriService.getBaseDomain(redirectOriginUri);
    const destBaseDomain = this.uriService.getBaseDomain(redirectTargetUri);

    let origin = null;
    let dest = null;
    if (originBaseDomain !== null) {
      origin = this.menu.addWildcard(originBaseDomain);
    }
    if (destBaseDomain !== null) {
      dest = this.menu.addWildcard(destBaseDomain);
    }

    const mayPermRulesBeAdded = this.privateBrowsingService.
        mayPermanentRulesBeAdded(this.window);

    const allowRedirection = () => {
      // Fx 3.7a5+ calls shouldLoad for location.href changes.

      // TODO: currently the allow button ignores any additional
      //       HTTP response headers [1]. Maybe there is a way to take
      //       those headers into account (e.g. `Set-Cookie`?), or maybe
      //       this is not necessary at all.
      // tslint:disable-next-line:max-line-length
      // [1] https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Response_fields

      this.requestProcessor.registerAllowedRedirect(
          redirectOriginUri,
          redirectTargetUri,
      );

      const data: any = {
        uri: redirectTargetUri,
      };
      if (replaceIfPossible) {
        data.replaceUri = redirectOriginUri;
      }
      vBrowser.messageManager.sendAsyncMessage(
          `${C.MM_PREFIX}setLocation`,
          data,
      );
    };

    const addMenuItem = (aRuleSpec: IClassicmenuRuleSpec) => {
      this.classicmenu.addMenuItem(addRulePopup, aRuleSpec, () => {
        if (this.cachedSettings.get("autoReload")) {
          allowRedirection();
        }
      });
    };
    const addMenuSeparator = () => {
      this.classicmenu.addMenuSeparator(addRulePopup);
    };

    {
      // allow ALL
      const label = this.$str("allowAllRedirections");
      this.classicmenu.addCustomMenuItem(addRulePopup, label, () => {
        this.windowService.openTabWithUrl(
            this.window,
            browser.runtime.getURL("settings/defaultpolicy.html"),
            [],
            true,
        );
      });
      addMenuSeparator();
    }

    if (destBaseDomain !== null) {
      addMenuItem({allow: true, dest});
      if (mayPermRulesBeAdded) {
        addMenuItem({allow: true, dest});
      }
    }

    if (originBaseDomain !== null && destBaseDomain !== null) {
      addMenuSeparator();
    }

    if (originBaseDomain !== null) {
      addMenuItem({allow: true, origin, temp: true});
      if (mayPermRulesBeAdded) {
        addMenuItem({allow: true, origin});
      }
    }

    if (originBaseDomain !== null && destBaseDomain !== null) {
      addMenuSeparator();

      addMenuItem({allow: true, origin, dest, temp: true});
      if (mayPermRulesBeAdded) {
        addMenuItem({allow: true, origin, dest});
      }
    }

    const notification = notificationBox.
        getNotificationWithValue(notificationValue);
    if (notification) {
      notification.label = notificationLabel;
    } else {
      const buttons = [
        {
          accessKey: this.$str("allow_accesskey"),
          callback: allowRedirection,
          label: this.$str("allow"),
          popup: null,
        },
        {
          accessKey: this.$str("deny_accesskey"),
          label: this.$str("deny"),
          popup: null,
          callback() {
            // Do nothing. The notification closes when this is called.
          },
        },
        {
          accessKey: this.$str("addRule_accesskey"),
          callback: null,
          label: this.$str("addRule"),
          popup: addRuleMenuName,
        },
        // TODO: add a "read more about URL redirection" button, targetting to
        //       https://en.wikipedia.org/wiki/URL_redirection
      ];
      const priority = notificationBox.PRIORITY_WARNING_MEDIUM;

      const notificationElem = notificationBox.appendNotification(
          notificationLabel, notificationValue,
          "chrome://rpcontinued/skin/requestpolicy-icon-blocked.png",
          priority, buttons,
      );

      // Let the notification persist at least 300ms. This is needed in the
      // following scenario:
      //     If an URL is entered on an empty tab (e.g. "about:blank"),
      //     and that URL redirects to another URL with a different
      //     host, and that redirect is blocked by RequestPolicy,
      //     then immediately after blocking the redirect Firefox will make
      //     a location change, maybe back from the blocked URL to
      //     "about:blank". In any case, when the location changes, the
      //     function `notificationbox.removeTransientNotifications()`
      //     is called. It checks for the `persistence` and `timeout`
      //     properties. See MDN documentation:
      // tslint:disable-next-line:max-line-length
      //     https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/notification
      // See also issue #722.
      (notificationElem as any).timeout = Date.now() + 300;
    }
    return true;
  }

  /**
   * Return a DOM element by its id. First search in the main document,
   * and if not found search in the document included in the frame.
   */
  private $id(id: string): HTMLElement | null {
    let element = this.window.top.document.getElementById(id);
    if (!element) {
      const popupframe = this.window.top.document.
          getElementById("rpc-popup-frame") as HTMLFrameElement;
      if (popupframe && popupframe.contentDocument) {
        element = popupframe.contentDocument.getElementById(id);
      }
    }
    return element;
  }

  /**
   * Takes an URI, crops it if necessary, and returns it.
   * It's ensured that the returned URI isn't longer than a specified length,
   * but the prePath is never cropped, so that the resulting string might be
   * longer than aMaxLength.
   *
   * (There doesn't seem to be a way to use the xul crop attribute with the
   * notification.)
   *
   */
  private cropUri(aUri: string, aMaxLength: number): string {
    if (aUri.length < aMaxLength) {
      return aUri;
    } else {
      const prePathLength = this.uriService.getPrePath(aUri).length + 1;
      const len = Math.max(prePathLength, aMaxLength);
      return `${aUri.substring(0, len)}...`;
    }
  }
}
