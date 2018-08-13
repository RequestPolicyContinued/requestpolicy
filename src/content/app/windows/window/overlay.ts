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
import { JSMs, XPCOM, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import {C} from "data/constants";
import { BoundMethods } from "lib/classes/bound-methods";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import * as DOMUtils from "lib/utils/dom-utils";
import {
  arrayIncludes,
  defer,
  leftRotateArray,
  range,
} from "lib/utils/js-utils";
import * as Utils from "lib/utils/misc-utils";
import {
  addSessionHistoryListener,
  removeSessionHistoryListener,
} from "lib/utils/try-catch-utils";
import { getTabBrowser } from "lib/utils/window-utils";
import {CompatibilityRules} from "models/compatibility-rules";
import { IClassicmenuRuleSpec } from "./classicmenu";

const {LOG_FLAG_STATE} = C;
declare const XPCOMUtils: JSMs.XPCOMUtils;

export class Overlay extends Module implements App.windows.window.IOverlay {
  // protected get debugEnabled() { return true; }

  // This is set by the request log when it is initialized.
  // We don't need to worry about setting it here.
  public requestLog: any = null;

  public readonly boundMethods = new BoundMethods(this);

  private toolbarButtonId = "/* @echo ALPHABETICAL_ID */ToolbarButton";

  private blockedContentStateUpdateDelay = 250; // milliseconds
  private blockedContentCheckTimeoutId: number | null = null;
  // private blockedContentCheckLastTime = 0;

  // private statusbar = null;
  // private toolbox = null;

  private isFennec = false;

  private locationListener: XPCOM.nsIWebProgressListener;
  private historyListener:
      XPCOM.nsISHistoryListener &
      XPCOM.nsISupportsWeakReference;

  private needsReloadOnMenuClose: boolean;

  private get gBrowser() { return getTabBrowser(this.window)!; }
  private get $str() { return this.i18n.getMessage.bind(browser.i18n); }

  protected get startupPreconditions() {
    return [
      this.eventListener.whenReady,
      this.privateBrowsingService.whenReady,
      this.uriService.whenReady,
      this.policy.whenReady,
      this.cachedSettings.whenReady,
      this.requestMemory.whenReady,
      this.requestProcessor.whenReady,
      this.msgListener.whenReady,
      this.xulTrees.whenReady,
    ];
  }

  constructor(
      readonly parentLog: Common.ILog,
      readonly windowID: number,
      private readonly window: XUL.chromeWindow,

      private readonly cc: XPCOM.nsXPCComponents_Classes,
      private readonly ci: XPCOM.nsXPCComponents_Interfaces,
      private readonly cr: XPCOM.nsXPCComponents_Results,
      private readonly xulAppInfo: XPCOM.nsIXULAppInfo,

      private readonly i18n: typeof browser.i18n,
      private readonly runtime: typeof browser.runtime,
      private readonly storageApi: typeof browser.storage,

      private readonly classicmenu: App.windows.window.IClassicMenu,
      private readonly menu: App.windows.window.IMenu,

      private readonly eventListener: App.common.IEventListenerModule,
      private readonly privateBrowsingService:
          App.services.IPrivateBrowsingService,
      private readonly uriService: App.services.IUriService,
      private readonly policy: App.IPolicy,
      private readonly cachedSettings: App.storage.ICachedSettings,
      private readonly requestMemory: App.webRequest.IRequestMemory,
      private readonly requestProcessor: App.webRequest.IRequestProcessor,
      private readonly msgListener: App.windows.window.IMessageListenerModule,
      private readonly xulTrees: App.windows.window.IXulTrees,
  ) {
    super(`app.windows[${windowID}].overlay`, parentLog);
  }

  /**
   * This function is called when any requests happen. This must be as
   * fast as possible because request processing blocks until this function
   * returns.
   *
   * @param {boolean} isAllowed
   * @param {string} originUri
   * @param {string} destUri
   */
  public observeRequest({isAllowed, originUri, destUri}: {
      isAllowed: boolean,
      originUri: string,
      destUri: string,
  }) {
    if (isAllowed) {
      if (this.requestLog) {
        this.requestLog!.addAllowedRequest(originUri, destUri);
      }
    } else {
      this.updateNotificationDueToBlockedContent();
      if (this.requestLog) {
        this.requestLog!.addBlockedRequest(originUri, destUri);
      }
    }
  }

  /**
   * This function gets called when a top-level document request has been
   * blocked.
   * This function is called during shouldLoad(). As shouldLoad shoudn't be
   * blocked, it's better to set a timeout here.
   */
  public observeBlockedTopLevelDocRequest(
      browser: XUL.browser,
      originUri: string,
      destUri: string,
  ) {
    // This function is called during shouldLoad() so set a timeout to
    // avoid blocking shouldLoad.
    this.setTimeout(() => {
      this.showRedirectNotification(
          browser,
          destUri,
          0,
          originUri,
      );
    }, 0);
  }

  /**
   * Called before the popup menu is shown.
   */
  public onPopupShowing(event: Event) {
    // if (event.currentTarget != event.originalTarget) {
    //   return;
    // }
    this.menu.prepareMenu();
  }

  /**
   * Called after the popup menu has been hidden.
   */
  public onPopupHidden(event: Event) {
    const rulesChanged = this.menu.processQueuedRuleChanges();
    if (rulesChanged || this.needsReloadOnMenuClose) {
      if (this.cachedSettings.get("autoReload")) {
        const mm = this.gBrowser.selectedBrowser.messageManager;
        mm.sendAsyncMessage(`${C.MM_PREFIX}reload`);
      }
    }
    this.needsReloadOnMenuClose = false;
  }

  /**
   * Get the top-level document's uri.
   *
   * @return {string}
   */
  public getTopLevelDocumentUri() {
    const uri = this.gBrowser.selectedBrowser.currentURI.spec;
    return CompatibilityRules.getTopLevelDocTranslation(uri) ||
        this.uriService.stripFragment(uri);
  }

  /**
   * Toggle disabling of all blocking for the current session.
   */
  public toggleTemporarilyAllowAll(): boolean {
    const disabled = !this.cachedSettings.alias.isBlockingDisabled();
    this.cachedSettings.alias.setBlockingDisabled(disabled);

    return disabled;
  }

  /**
   * Revoke all temporary permissions granted during the current session.
   */
  public revokeTemporaryPermissions(event: Event) {
    this.policy.revokeTemporaryRules();
    this.needsReloadOnMenuClose = true;
    this.popupElement.hidePopup();
  }

  public toggleMenu() {
    if (this.popupElement.state === "closed") {
      this.openMenu();
    } else {
      this.closeMenu();
    }
  }

  public openPrefs() {
    let url: string;
    const equivalentURLs: string[] = [];
    const relatedToCurrent = true;

    if (C.EXTENSION_TYPE === "legacy") {
      url = "about:requestpolicy";
      equivalentURLs.push(
          browser.runtime.getURL("settings/basicprefs.html"),
      );
    } else {
      url = browser.runtime.getURL("settings/basicprefs.html");
    }

    this.maybeOpenLinkInNewTab(url, equivalentURLs, relatedToCurrent);
  }

  public openPolicyManager() {
    this.maybeOpenLinkInNewTab(
        browser.runtime.getURL("settings/yourpolicy.html"),
        [],
        true,
    );
  }

  public openHelp() {
    this.maybeOpenLinkInNewTab(
        "https://github.com/" +
        "RequestPolicyContinued/requestpolicy/wiki/Help-and-Support",
        [],
    );
  }

  public clearRequestLog() {
    (this.requestLog as any).clear();
  }

  public toggleRequestLog() {
    const requestLog: any = this.$id("rpcontinued-requestLog");
    const requestLogSplitter = this.$id("rpcontinued-requestLog-splitter")!;
    const requestLogFrame = this.$id("rpcontinued-requestLog-frame")!;
    // var openRequestLog = this.$id("rpcontinuedOpenRequestLog");

    // TODO: figure out how this should interact with the new menu.
    // var closeRequestLog = this.$id("requestpolicyCloseRequestLog");
    const closeRequestLog: any = {};

    if (requestLog.hidden) {
      requestLogFrame.setAttribute(
          "src",
          "chrome://rpcontinued/content/ui/request-log/request-log.xul",
      );
      requestLog.hidden = false;
      requestLogSplitter.hidden = false;
      closeRequestLog.hidden = false;
      // openRequestLog.hidden = true;
    } else {
      requestLogFrame.setAttribute("src", "about:blank");
      requestLog.hidden = true;
      requestLogSplitter.hidden = true;
      closeRequestLog.hidden = true;
      // openRequestLog.hidden = false;
      this.requestLog = null;
    }
  }

  protected startupSelf(): MaybePromise<void> {
    const promises: Array<MaybePromise<void> | Promise<void>> = [];

    promises.push(this.addAppcontentTabSelectListener());
    promises.push(this.addContextMenuListener());
    promises.push(this.addTabContainerTabSelectListener());

    this.msgListener.addListener("notifyTopLevelDocumentLoaded", (message) => {
      // Clear any notifications that may have been present.
      this.setContentBlockedState(false);
      // We don't do this immediately anymore because slow systems might have
      // this slow down the loading of the page, which is noticable
      // especially with CSS loading delays (it's not unlikely that slow
      // webservers have a hand in this, too).
      // Note that the change to updateBlockedContentStateAfterTimeout seems to
      // have added a bug where opening a blank tab and then quickly switching
      // back to the original tab can cause the original tab's blocked content
      // notification to be cleared. A simple compensation was to decrease
      // the timeout from 1000ms to 250ms, making it much less likely the tab
      // switch can be done in time for a blank opened tab. This isn't a real
      // solution, though.
      this.updateBlockedContentStateAfterTimeout();
    });

    this.msgListener.addListener("notifyDOMFrameContentLoaded", (message) => {
      // This has an advantage over just relying on the
      // observeRequest() call in that this will clear a blocked
      // content notification if there no longer blocked content. Another way
      // to solve this would be to observe allowed requests as well as blocked
      // requests.
      // blockedContentCheckLastTime = (new Date()).getTime();
      this.stopBlockedContentCheckTimeout();
      this.updateBlockedContentState(message.target);
    });

    this.msgListener.addListener("handleMetaRefreshes", (message) => {
      this.handleMetaRefreshes(message);
    });

    this.msgListener.addListener("notifyLinkClicked", (message) => {
      this.requestProcessor.registerLinkClicked(
          message.data.origin,
          message.data.dest,
      );
    });

    this.msgListener.addListener("notifyFormSubmitted", (message) => {
      this.requestProcessor.registerFormSubmitted(
          message.data.origin,
          message.data.dest,
      );
    });

    promises.push(this.updatePermissiveStatusOnPrefChanges());
    promises.push(this.updatePermissiveStatus());

    const popupElement = this.popupElement!;

    // statusbar = $id("status-bar");
    // toolbox = $id("navigator-toolbox");

    this.isFennec = this.xulAppInfo.name === "Fennec";

    const p = this.runtime.getBrowserInfo().then((appInfo) => {
      if (appInfo.name === "Fennec") {
        this.log.log("Detected Fennec.");
        // Set an attribute for CSS usage.
        popupElement.setAttribute("fennec", "true");
        popupElement.setAttribute("position", "after_end");
      }
      return;
    }).catch((e) => {
      this.log.error("Error on Fennec detection. Details:", e);
    });
    promises.push(p);

    // Register this window with the requestpolicy service so that we can be
    // notified of blocked requests. When blocked requests happen, this
    // object's observerBlockedRequests() method will be called.
    this.requestMemory.onRequest.addListener(
        this.boundMethods.get(this.observeRequest),
    );

    this.setContextMenuEntryEnabled(this.cachedSettings.get("contextMenu"));

    // Tell the framescripts that the overlay is ready. The
    // listener must be added immediately.
    this.msgListener.addListener(
        "isOverlayReady",
        () => true,
        () => false,
    );
    this.window.messageManager.broadcastAsyncMessage(
        `${C.MM_PREFIX}overlayIsReady`, true,
    );

    return MaybePromise.all(promises) as MaybePromise<any>;
  }

  protected shutdownSelf() {
    this.requestMemory.onRequest.removeListener(
        this.boundMethods.get(this.observeRequest),
    );
    this.unwrapAddTab();
    this.removeHistoryObserver();
    this.removeLocationObserver();

    const requestLog = this.$id("rpcontinued-requestLog");

    // If the request log is found and is opened.
    // The XUL elements of the request log might have already
    // been removed.
    if (requestLog && requestLog.hidden === false) {
      this.toggleRequestLog();
    }

    return MaybePromise.resolve(undefined);
  }

  private get popupElement(): XUL.menupopup {
    return (this.$id("rpc-popup") as any) as XUL.menupopup;
  }

  private setTimeout(aFn: () => void, aDelay: number) {
    return setTimeout(() => {
      if (this.shutdownState !== "not yet shut down") {
        console.log(
            "[RequestPolicy] Not calling delayed function " +
            "because of add-on shutdown.",
        );
        return;
      }
      aFn.call(null);
    }, aDelay);
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

  private setContextMenuEntryEnabled(isEnabled: boolean) {
    const contextMenuEntry = this.$id("rpcontinuedContextMenuEntry");
    contextMenuEntry!.setAttribute("hidden", String(!isEnabled));
  }

  private addAppcontentTabSelectListener(): MaybePromise<void> {
    // Info on detecting page load at:
    // http://developer.mozilla.org/En/Code_snippets/On_page_load
    const appcontent = this.$id("appcontent"); // browser
    if (appcontent) {
      if (this.isFennec) {
        this.eventListener.addListener(
            appcontent, "TabSelect",
            this.boundMethods.get(this.tabChanged), false,
        );
      }
    }
    return MaybePromise.resolve(undefined);
  }

  /**
   * Add an event listener for when the contentAreaContextMenu (generally
   * the right-click menu within the document) is shown.
   */
  private addContextMenuListener(): MaybePromise<void> {
    const contextMenu = this.$id("contentAreaContextMenu");
    if (contextMenu) {
      this.eventListener.addListener(
          contextMenu, "popupshowing",
          this.boundMethods.get(this.contextMenuOnPopupShowing),
          false,
      );
    }
    return MaybePromise.resolve(undefined);
  }

  private addTabContainerTabSelectListener(): MaybePromise<void> {
    const promises: Array<MaybePromise<void>> = [];
    // Listen for the user changing tab so we can update any notification or
    // indication of blocked requests.
    if (!this.isFennec) {
      const container = this.gBrowser.tabContainer;

      this.eventListener.addListener(
          container as any,
          "TabSelect",
          this.boundMethods.get(this.tabChanged),
          false,
      );

      promises.push(this.wrapAddTab());
      promises.push(this.addLocationObserver());
      promises.push(this.addHistoryObserver());
    }
    return MaybePromise.all(promises) as MaybePromise<any>;
  }

  private handleMetaRefreshes(message: any) {
    this.log.log("Handling meta refreshes...");

    const {documentURI, metaRefreshes} = message.data;
    const browser = message.target;

    for (let i = 0, len = metaRefreshes.length; i < len; ++i) {
      const {delay, destURI, originalDestURI} = metaRefreshes[i];

      this.log.log(
          `meta refresh to <${destURI}> (${delay} second delay) ` +
          ` found in document at <${documentURI}>`,
      );

      if (originalDestURI) {
        this.log.log(
            `meta refresh destination <${originalDestURI}> ` +
            `appeared to be relative to <${documentURI}>, so ` +
            `it has been resolved to <${destURI}>`,
        );
      }

      // We don't automatically perform any allowed redirects. Instead, we
      // just detect when they will be blocked and show a notification. If
      // the docShell has allowMetaRedirects disabled, it will be respected.
      if (!this.cachedSettings.alias.isBlockingDisabled() &&
          !this.requestProcessor.isAllowedRedirect(documentURI, destURI)) {
        // Ignore redirects to javascript. The browser will ignore them
        // as well.
        if (this.uriService.getUriObject(destURI).schemeIs("javascript")) {
          this.log.warn(
              `Ignoring redirect to javascript URI <${destURI}>`,
          );
          continue;
        }
        // The request will be blocked by shouldLoad.
        this.showRedirectNotification(browser, destURI, delay);
      }
    }
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

  /**
   * Shows a notification that a redirect was requested by a page (meta refresh
   * or with headers).
   *
   * @return {boolean} whether showing the notification succeeded
   */
  private showRedirectNotification(
      vBrowser: XUL.browser,
      redirectTargetUri: string,
      delay: number,
      aRedirectOriginUri?: string,
      replaceIfPossible?: boolean,
  ): boolean {
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
    const redirectOriginUri =
        aRedirectOriginUri || this.getTopLevelDocumentUri();

    if (this.isFennec) {
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
      notificationLabel = this.$str("redirectNotification",
          [this.cropUri(redirectTargetUri, 50)]);
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

    const m = this.menu;
    const originBaseDomain = this.uriService.getBaseDomain(redirectOriginUri);
    const destBaseDomain = this.uriService.getBaseDomain(redirectTargetUri);

    let origin = null;
    let dest = null;
    if (originBaseDomain !== null) {
      origin = m.addWildcard(originBaseDomain);
    }
    if (destBaseDomain !== null) {
      dest = m.addWildcard(destBaseDomain);
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
        this.maybeOpenLinkInNewTab(
            browser.runtime.getURL("settings/defaultpolicy.html"),
            [], true,
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
   * Performs actions required to be performed after a tab change.
   */
  private tabChanged() {
    // TODO: verify the Fennec and all supported browser versions update the
    // status bar properly with only the ProgressListener. Once verified,
    // remove calls to tabChanged();
    // this._updateBlockedContentState(content.document);
  }

  /**
   * Checks if the document has blocked content and shows appropriate
   * notifications.
   */
  private updateBlockedContentState(browser: XUL.browser) {
    this.requestProcessor.whenReady.then(() => {
      const uri = this.uriService.stripFragment(browser.currentURI.spec);
      if (LOG_FLAG_STATE) {
        this.log.log(
            `Checking for blocked requests from page <${uri}>`,
        );
      }

      // TODO: this needs to be rewritten. checking if there is blocked
      // content could be done much more efficiently.
      const documentContainsBlockedContent = this.requestMemory.
          getAllRequestsInBrowser(browser).containsBlockedRequests();
      this.setContentBlockedState(documentContainsBlockedContent);

      if (LOG_FLAG_STATE) {
        const logText = documentContainsBlockedContent ?
          "Requests have been blocked." :
          "No requests have been blocked.";
        this.log.log(logText);
      }

      return Promise.resolve();
    }).catch((e) => {
      this.log.error(
          "[SEVERE] " +
          "Unable to complete 'updateBlockedContentState' actions. Details:",
          e,
      );
    });
  }

  /**
   * Sets the blocked content notifications visible to the user.
   */
  private setContentBlockedState(isContentBlocked: boolean) {
    const button = this.$id(this.toolbarButtonId);
    const contextMenuEntry = this.$id("rpcontinuedContextMenuEntry");
    if (button) {
      button.setAttribute("rpcontinuedBlocked", String(isContentBlocked));
      contextMenuEntry!.setAttribute(
          "rpcontinuedBlocked",
          String(isContentBlocked),
      );
    }
  }

  private onStorageChanged(changes: browser.storage.StorageChange) {
    if ("startWithAllowAllEnabled" in changes) {
      this.updatePermissiveStatus().
          catch(this.log.onError("onStorageChanged:startWithAllowAllEnabled"));
    }
  }

  /**
   * Update RP's "permissive" status, which is to true or false.
   */
  private updatePermissiveStatus(): MaybePromise<void> {
    const button = this.$id(this.toolbarButtonId);
    const contextMenuEntry = this.$id("rpcontinuedContextMenuEntry");
    if (button) {
      const isPermissive = this.cachedSettings.alias.isBlockingDisabled();
      button.setAttribute("rpcontinuedPermissive", isPermissive);
      contextMenuEntry!.setAttribute("rpcontinuedPermissive", isPermissive);
    }
    return MaybePromise.resolve(undefined);
  }

  private updatePermissiveStatusOnPrefChanges(): MaybePromise<void> {
    this.storageApi.onChanged.addListener(
        this.boundMethods.get(this.onStorageChanged),
    );
    return MaybePromise.resolve(undefined);
  }

  // TODO: observeBlockedFormSubmissionRedirect

  private updateNotificationDueToBlockedContent() {
    if (!this.blockedContentCheckTimeoutId) {
      this.updateBlockedContentStateAfterTimeout();
    }
  }

  private updateBlockedContentStateAfterTimeout() {
    const browser = this.gBrowser.selectedBrowser;
    this.blockedContentCheckTimeoutId = this.setTimeout(() => {
      try {
        this.updateBlockedContentState(browser);
      } catch (e) {
        // It's possible that the add-on has been disabled
        // in the meantime.
      }
    }, this.blockedContentStateUpdateDelay);
  }

  private stopBlockedContentCheckTimeout() {
    if (this.blockedContentCheckTimeoutId) {
      this.window.clearTimeout(this.blockedContentCheckTimeoutId);
      this.blockedContentCheckTimeoutId = null;
    }
  }

  /**
   * Called as an event listener when popupshowing fires on the
   * contentAreaContextMenu.
   */
  private contextMenuOnPopupShowing() {
    this.wrapOpenLink();
  }

  private wrapFunctionErrorCallback(aMessage: string, aError: any) {
    this.log.error(aMessage, aError);
  }

  private onOpenLinkViaContextMenu() {
    const contextMenu = this.window.gContextMenu;
    const origin = this.window.gContextMenuContentData ?
      this.window.gContextMenuContentData.docLocation :
      contextMenu.target.ownerDocument.URL;
    const dest = contextMenu.linkURL;
    this.requestProcessor.registerLinkClicked(origin, dest);
  }

  /**
   * Wraps (overrides) the following methods of gContextMenu
   * - openLink()
   * - openLinkInPrivateWindow()
   * - openLinkInCurrent()
   * so that RequestPolicy can register a link-click.
   *
   * The openLinkInTab() method doesn't need to be wrapped because new tabs
   * are already recognized by tabAdded(), which is wrapped elsewhere.
   * The tabAdded() function ends up being called when openLinkInTab()
   * is called.
   *
   * TODO: There are even more similar methods in gContextMenu (frame-specific),
   *       and perhaps the number will increase in future. Frame-specific
   *       contextMenu entries are working, but are registered e.g. as
   *       "new window opened" by the subsequent shouldLoad() call.
   */
  private wrapOpenLink() {
    Utils.wrapFunction(
        this.window.gContextMenu,
        "openLink",
        this.boundMethods.get(this.wrapFunctionErrorCallback),
        this.boundMethods.get(this.onOpenLinkViaContextMenu),
    );
    Utils.wrapFunction(
        this.window.gContextMenu,
        "openLinkInPrivateWindow",
        this.boundMethods.get(this.wrapFunctionErrorCallback),
        this.boundMethods.get(this.onOpenLinkViaContextMenu),
    );
    Utils.wrapFunction(
        this.window.gContextMenu,
        "openLinkInCurrent",
        this.boundMethods.get(this.wrapFunctionErrorCallback),
        this.boundMethods.get(this.onOpenLinkViaContextMenu),
    );
  }

  /**
   * Wraps the addTab() function so that RequestPolicy can be aware of the
   * tab being opened. Assume that if the tab is being opened, it was an action
   * the user wanted (e.g. the equivalent of a link click). Using a TabOpen
   * event handler, I (Justin) was unable to determine the referrer,
   * so that approach doesn't seem to be an option.
   *
   * TODO: Give examples when the wrap is necessary.
   */
  private wrapAddTab(): MaybePromise<void> {
    Utils.wrapFunction(
        this.gBrowser,
        "addTab",
        this.boundMethods.get(this.wrapFunctionErrorCallback),
        this.boundMethods.get(this.tabAdded),
    );
    return MaybePromise.resolve(undefined);
  }

  /**
   * Unwrap the addTab() function.
   */
  private unwrapAddTab() {
    Utils.unwrapFunction(this.gBrowser, "addTab");
  }

  /**
   * This is called by the modified addTab().
   *
   * @param {string} aURI
   * @param {(nsIURI|{referrerURI: nsIURI})} aReferrerURI The referrer or an
   *     object containing the referrer.
   */
  private tabAdded(
      aURI: string,
      aReferrerURI: XPCOM.nsIURI | {referrerURI: XPCOM.nsIURI},
  ) {
    let referrerURI: XPCOM.nsIURI;

    // The second argument can be an object of parameters.
    if (typeof aReferrerURI === "object" &&
        !(aReferrerURI instanceof this.ci.nsIURI)) {
      referrerURI = (aReferrerURI as any).referrerURI;
    } else {
      referrerURI = aReferrerURI as XPCOM.nsIURI;
    }

    if (referrerURI) {
      this.requestProcessor.registerLinkClicked(referrerURI.spec, aURI);
    }
  }

  private addLocationObserver(): MaybePromise<void> {
    this.locationListener = {
      onLocationChange: (aProgress, aRequest, aURI) => {
        // This gets called both for tab changes and for history navigation.
        // The timer is running on the main window, not the document's window,
        // so we want to stop the timer when the tab is changed.
        this.stopBlockedContentCheckTimeout();
        this.updateBlockedContentState(this.gBrowser.selectedBrowser);
      },

      // tslint:disable-next-line:object-literal-sort-keys
      QueryInterface: XPCOMUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ] as any[]),
    };

    // https://developer.mozilla.org/en/Code_snippets/Progress_Listeners
    this.gBrowser.addProgressListener(this.locationListener);

    return MaybePromise.resolve(undefined);
  }

  private removeLocationObserver() {
    this.gBrowser.removeProgressListener(this.locationListener);
  }

  private addHistoryObserver(): MaybePromise<void> {
    this.historyListener = {
      OnHistoryGoBack: (backURI) => {
        this.requestProcessor.registerHistoryRequest(backURI.asciiSpec);
        return true;
      },

      OnHistoryGoForward: (forwardURI) => {
        this.requestProcessor.registerHistoryRequest(forwardURI.asciiSpec);
        return true;
      },

      OnHistoryGotoIndex: (index, gotoURI) => {
        this.requestProcessor.registerHistoryRequest(gotoURI.asciiSpec);
        return true;
      },

      OnHistoryNewEntry: (newURI) => undefined,
      OnHistoryPurge: (numEntries) => true,
      OnHistoryReload: (reloadURI, reloadFlags) => true,
      OnHistoryReplaceEntry: (aIndex) => undefined,

      QueryInterface: <T extends XPCOM.nsISupports>(
          aIID: XPCOM.nsIJSID,
      ): T => {
        if (aIID.equals(this.ci.nsISHistoryListener) ||
            aIID.equals(this.ci.nsISupportsWeakReference) ||
            aIID.equals(this.ci.nsISupports)) {
          return this.historyListener as any;
        }
        throw this.cr.NS_NOINTERFACE;
      },

      // tslint:disable-next-line:object-literal-sort-keys
      GetWeakReference: <T extends XPCOM.nsISupports>() => {
        return this.cc["@mozilla.org/appshell/appShellService;1"].
            createInstance(this.ci.nsIWeakReference);
      },
    };

    const d = defer();

    // there seems to be a bug in Firefox ESR 24 -- the session history is
    // null. After waiting a few miliseconds it's available. To be sure this
    let tries = 0;
    const waitTime = 20;
    const maxTries = 10;
    const tryAddingSHistoryListener = () => {
      ++tries;
      const result = addSessionHistoryListener(
          this.gBrowser,
          this.historyListener,
      );
      if (!result.error) {
        d.resolve(undefined);
        return;
      }

      const e = result.error;
      if (tries >= maxTries) {
        this.log.error(
            `[SEVERE] Can't add session history listener, even ` +
            `after ${tries} tries. Details:`,
            e,
        );
        d.reject(e);
      } else {
        // call this function again in a few miliseconds.
        this.setTimeout(() => {
          // Prevent the `setTimeout` warning of the AMO Validator.
          tryAddingSHistoryListener();
        }, waitTime);
      }
    };
    tryAddingSHistoryListener();

    return MaybePromise.resolve(d.promise);
  }

  private removeHistoryObserver() {
    const result = removeSessionHistoryListener(
        this.gBrowser,
        this.historyListener,
    );
    if (result.error) {
      // When closing the last window in a session where additional windows
      // have been opened and closed, this will sometimes fail (bug #175).
    }
  }

  /**
   * Open the menu at the browsing content.
   *
   * The menu is aligned to the top right.
   */
  private openMenuAtContent() {
    // There's no good way to right-align a popup. So, we can either
    // let it be left aligned or we can figure out where we think the
    // top-left corner should be. And that's what we do.
    // The first time the width will be 0. The default value is determined by
    // logging it or you can probably figure it out from the CSS which doesn't
    // directly specify the width of the entire popup.
    // this.log.log('popup width: ' + popup.clientWidth);
    const popupElement = this.popupElement!;
    const popupWidth = popupElement.clientWidth === 0 ? 730 :
      popupElement.clientWidth;
    const anchor = this.$id("content")!;
    const contentWidth = anchor.clientWidth;
    // Take a few pixels off so it doesn't cover the browser chrome's border.
    const xOffset = contentWidth - popupWidth - 2;
    popupElement.openPopup(anchor, "overlap", xOffset);
  }

  private openMenuAtToolbarButton() {
    const anchor = this.$id("/* @echo ALPHABETICAL_ID */ToolbarButton");
    // rpcontinued.overlay._toolbox.insertBefore(
    //     rpcontinued.overlay.popupElement, null);
    this.popupElement.openPopup(anchor, "after_start", 0, 0, true, true);
  }

  /**
   * Open RequestPolicy's menu.
   *
   * If the toolbar button is visible, it will be placed there. Otherwise
   * it will be placed near the browsing content.
   */
  private openMenu() {
    // `setTimeout` is needed in certain cases where the toolbar button
    // is actually hidden. For example, it can reside in the Australis
    // menu. By delaying "openMenu" the menu will be closed in the
    // meantime, and the toolbar button will be detected as invisible.
    setTimeout(() => {
      this.debugLog.log("opening the menu");
      if (this.isToolbarButtonVisible()) {
        this.openMenuAtToolbarButton();
      } else {
        this.openMenuAtContent();
      }
    }, 0);
  }

  /**
   * Close RequestPolicy's menu.
   */
  private closeMenu() {
    this.menu.close();
  }

  private isToolbarButtonVisible() {
    return DOMUtils.isElementVisible(
        this.$id("/* @echo ALPHABETICAL_ID */ToolbarButton")!,
    );
  }

  private openLinkInNewTab(url: string, relatedToCurrent?: boolean) {
    this.window.openUILinkIn(
        url,
        "tab",
        {relatedToCurrent: !!relatedToCurrent},
    );
    this.popupElement.hidePopup();
  }

  private maybeOpenLinkInNewTab(
      url: string,
      equivalentURLs: string[],
      relatedToCurrent: boolean = false,
  ) {
    const possibleURLs = equivalentURLs.concat(url);
    const tabbrowser = this.gBrowser;

    const selectedTabIndex = tabbrowser.tabContainer.selectedIndex;
    const numTabs = tabbrowser.tabs.length;

    // Start iterating at the currently selected tab.
    const indexes = leftRotateArray(
        range(numTabs),
        selectedTabIndex,
    );
    for (const index of indexes) {
      const currentBrowser = tabbrowser.getBrowserAtIndex(index);
      const currentURI = currentBrowser.currentURI.spec;
      if (arrayIncludes(possibleURLs, currentURI)) {
        // The URL is already opened. Select this tab.
        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];
        this.popupElement.hidePopup();
        return;
      }
    }

    this.openLinkInNewTab(url, relatedToCurrent);
  }
}
