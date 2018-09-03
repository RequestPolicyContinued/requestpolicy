/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2018 Martin Kimmerle
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
import { XPCOM, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { C } from "data/constants";
import { promiseObserverTopic } from "legacy/lib/utils/xpcom-utils";
import { BoundMethods } from "lib/classes/bound-methods";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import {
  arrayIncludes,
  defer,
  leftRotateArray,
  range,
} from "lib/utils/js-utils";
import { createListenersMap } from "lib/utils/listener-factories";
import {
  getDOMWindowFromXULWindow,
  getTabBrowser,
  getWindowId,
  getWindowtype,
} from "lib/utils/window-utils";
import {CompatibilityRules} from "models/compatibility-rules";

export class WindowService extends Module
    implements App.services.IWindowService {
  protected get debugEnabled() { return C.LOG_BG_CONTENT_BOUNDARIES; }

  public readonly pWindowsAvailable = this.areWindowsAvailable() ?
      Promise.resolve() : this.promiseSessionstoreWindowsRestored();

  private events = createListenersMap<void, XUL.chromeWindow>([
    "onWindowLoaded",
    "onWindowUnloaded",
  ]);

  // tslint:disable:member-ordering
  public onWindowLoaded = this.events.interfaces.onWindowLoaded;
  public onWindowUnloaded = this.events.interfaces.onWindowUnloaded;
  // tslint:enable:member-ordering

  private chromeWindows = new Set<XUL.chromeWindow>();

  private boundMethods = new BoundMethods(this);

  private windowMediatorListener: (
      XPCOM.nsIWindowMediatorListener_without_nsISupports
  ) = {
    onCloseWindow: (xulWindow: XPCOM.nsIXULWindow) => undefined,
    onOpenWindow: this.boundMethods.get(this.onChromeWindowOpened),
    onWindowTitleChange: (
        xulWindow: XPCOM.nsIXULWindow,
        newTitle: any,
    ) => undefined,
  };

  protected get dependencies() {
    return {
      uriService: this.uriService,
    };
  }

  protected get startupPreconditions() {
    return {
      pWindowsAvailable: this.pWindowsAvailable,
    };
  }

  constructor(
      parentLog: Common.ILog,
      private ci: XPCOM.nsXPCComponents_Interfaces,
      private windowMediator: XPCOM.nsIWindowMediator,

      private readonly uriService: App.services.IUriService,
  ) {
    super("app.services.windows", parentLog);
  }

  /**
   * Return a DOM element by its id. First search in the main document,
   * and if not found search in the document included in the frame.
   */
  public $id(aChromeWindow: XUL.chromeWindow, id: string): HTMLElement | null {
    let element = aChromeWindow.top.document.getElementById(id);
    if (!element) {
      const popupframe = aChromeWindow.top.document.
          getElementById("rpc-popup-frame") as HTMLFrameElement;
      if (popupframe && popupframe.contentDocument) {
        element = popupframe.contentDocument.getElementById(id);
      }
    }
    return element;
  }

  public $menupopup(aChromeWindow: XUL.chromeWindow): XUL.menupopup {
    return this.$id(aChromeWindow, "rpc-popup") as any;
  }

  public closeMenu(aChromeWindow: XUL.chromeWindow) {
    this.$menupopup(aChromeWindow).hidePopup();
  }

  public forEachOpenWindow<Tthis, Trv = void>(
      aCallback: (this: Tthis, window: XUL.chromeWindow) => Trv,
      aThisArg: Tthis | null = null,
      { ready: aReady }: { ready?: boolean } = {},
  ): Trv[] {
    // Apply a function to all open browser windows
    const xulWindows = this.windowMediator.getEnumerator("navigator:browser");
    const rvs: Trv[] = [];
    while (xulWindows.hasMoreElements()) {
      const window = xulWindows.getNext().
          QueryInterface<XPCOM.nsIDOMWindow>(this.ci.nsIDOMWindow);
      if (aReady !== undefined) {
        const isReady = window.document.readyState === "complete";
        if (isReady !== aReady) {
          continue;
        }
      }
      const rv = aCallback.call(aThisArg, window);
      rvs.push(rv);
    }
    return rvs;
  }

  public getMostRecentBrowserWindow(): XUL.chromeWindow {
    return this.windowMediator.getMostRecentWindow("navigator:browser") as any;
  }

  public promiseTabBrowser(
      aChromeWindow: XUL.chromeWindow,
  ): Promise<XUL.tabBrowser> {
    //
    // FIXME!
    // (what is the event we need to listen for?)
    //

    const d = defer<XUL.tabBrowser>();
    let n = 100;

    const step = () => {
      const tabBrowser = getTabBrowser(aChromeWindow);
      if (tabBrowser === null) {
        if (n-- === 0) {
          this.log.error(`window has no tabBrowser`);
          d.reject(undefined);
          return;
        }
        this.setTimeout(step, 10);
      } else {
        d.resolve(tabBrowser);
      }
    };
    step();

    return d.promise;
  }

  /**
   * Get the top-level document's uri.
   *
   * @return {string}
   */
  public getTopLevelDocumentUri(aChromeWindow: XUL.chromeWindow) {
    const uri = getTabBrowser(aChromeWindow)!.selectedBrowser.currentURI.spec;
    return CompatibilityRules.getTopLevelDocTranslation(uri) ||
        this.uriService.stripFragment(uri);
  }

  public openTabWithUrl(
      aChromeWindow: XUL.chromeWindow,
      url: string,
      equivalentURLs: string[],
      relatedToCurrent: boolean = false,
  ) {
    const possibleURLs = equivalentURLs.concat(url);
    const tabbrowser = getTabBrowser(aChromeWindow)!;

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
        this.closeMenu(aChromeWindow);
        return;
      }
    }

    this.openLinkInNewTab(aChromeWindow, url, relatedToCurrent);
  }

  protected startupSelf() {
    this.forEachOpenWindow(
        this.boundMethods.get(this.watchWindow),
    );
    this.windowMediator.addListener(this.windowMediatorListener);
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf(): void {
    this.windowMediator.removeListener(this.windowMediatorListener);

    const progressEventListener = this.boundMethods.get(this.onProgressEvent);
    for (const window of this.chromeWindows.values()) {
      window.removeEventListener("load", progressEventListener, false);
      window.removeEventListener("unload", progressEventListener, false);
    }
    this.chromeWindows.clear();
  }

  private onChromeWindowOpened(xulWindow: XPCOM.nsIXULWindow) {
    this.debugLog.log("window opened");
    const chromeWindow =
        getDOMWindowFromXULWindow(xulWindow) as XUL.chromeWindow;
    return this.watchWindow(chromeWindow, { emitIfAlreadyLoaded: true });
  }

  private watchWindow(
      chromeWindow: XUL.chromeWindow,
      { emitIfAlreadyLoaded = false }: { emitIfAlreadyLoaded?: boolean } = {},
  ) {
    this.chromeWindows.add(chromeWindow);
    const progressEventListener = this.boundMethods.get(this.onProgressEvent);

    if (chromeWindow.document.readyState !== "complete") {
      this.debugLog.log(`adding window "load" listener`);
      chromeWindow.addEventListener("load", progressEventListener, false);
    } else if (emitIfAlreadyLoaded) {
      this.debugLog.log(`immediately emitting window "load" event`);
      this.events.listenersMap.onWindowLoaded.emit(chromeWindow);
    }
    chromeWindow.addEventListener("unload", progressEventListener, false);
  }

  private onProgressEvent(event: ProgressEvent) {
    try {
      return this.onProgressEvent_(event);
    } catch (e) {
      this.log.error("onProgressEvent() error", e);
      throw e;
    }
  }

  private onProgressEvent_(event: ProgressEvent) {
    this.debugLog.log(`obtaining progress event...`);
    const chromeDocument = event.target as XUL.chromeDocument;
    const chromeWindow = chromeDocument.defaultView;

    if (event.type in ["load", "unload"]) {
      chromeWindow.removeEventListener(
          event.type,
          this.boundMethods.get(this.onProgressEvent),
          false,
      );
    }

    const windowtype = getWindowtype(chromeWindow);

    if (windowtype !== "navigator:browser") {
      this.debugLog.log(`ignoring window with type "${windowtype}"`);
      return;
    }

    const windowID = getWindowId(chromeWindow);

    switch (event.type) {
      case "load":
        this.debugLog.log(
            `window "load" event, ` +
            `windowID=${ windowID }, ` +
            `#listeners=${ this.events.listenersMap.onWindowLoaded.size }`,
        );
        this.events.listenersMap.onWindowLoaded.emit(chromeWindow);
        break;

      case "unload":
        this.debugLog.log(
            `window "unload" event", ` +
            `windowID=${ windowID }, ` +
            `#listeners=${ this.events.listenersMap.onWindowUnloaded.size }`,
        );
        this.events.listenersMap.onWindowUnloaded.emit(chromeWindow);
        this.chromeWindows.delete(chromeWindow);
        break;

      default:
        break;
    }
  }

  private areWindowsAvailable() {
    return this.getMostRecentBrowserWindow() !== null;
  }

  private promiseSessionstoreWindowsRestored() {
    const p = promiseObserverTopic("sessionstore-windows-restored");
    return p as Promise<any>;
  }

  private openLinkInNewTab(
      aChromeWindow: XUL.chromeWindow,
      url: string,
      relatedToCurrent?: boolean,
  ) {
    aChromeWindow.openUILinkIn(
        url,
        "tab",
        {relatedToCurrent: !!relatedToCurrent},
    );
    this.closeMenu(aChromeWindow);
  }
}
