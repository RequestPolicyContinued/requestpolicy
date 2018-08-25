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
import { promiseObserverTopic } from "legacy/lib/utils/xpcom-utils";
import { Module } from "lib/classes/module";
import { createListenersMap } from "lib/utils/listener-factories";
import { getDOMWindowFromXULWindow } from "lib/utils/window-utils";
import * as WindowUtils from "lib/utils/window-utils";

export class WindowService extends Module
    implements App.services.IWindowService {
  public readonly pWindowsAvailable = this.areWindowsAvailable() ?
      Promise.resolve() : this.promiseSessionstoreWindowsRestored();

  private events = createListenersMap([
    "onWindowLoaded",
    "onWindowUnloaded",
  ]);

  // tslint:disable:member-ordering
  public onXULWindowOpened = this.events.interfaces.onXULWindowOpened;
  public onXULWindowClosed = this.events.interfaces.onXULWindowClosed;
  public onWindowLoaded = this.events.interfaces.onWindowLoaded;
  public onWindowUnloaded = this.events.interfaces.onWindowUnloaded;
  // tslint:enable:member-ordering

  private windows = new Set<XPCOM.nsIDOMWindow>();

  private progressEventListener = this.onProgressEvent.bind(this);
  private windowMediatorListener: (
      XPCOM.nsIWindowMediatorListener_without_nsISupports
  ) = {
    onCloseWindow: (xulWindow: XPCOM.nsIXULWindow) => undefined,
    onOpenWindow: (xulWindow: XPCOM.nsIXULWindow) => {
      const domWindow = getDOMWindowFromXULWindow(xulWindow);
      this.windows.add(domWindow);
      domWindow.addEventListener("load", this.progressEventListener, false);
      domWindow.addEventListener("unload", this.progressEventListener, false);
    },
    onWindowTitleChange: (
        xulWindow: XPCOM.nsIXULWindow,
        newTitle: any,
    ) => undefined,
  };

  protected get startupPreconditions() {
    return [
      this.pWindowsAvailable,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      private ci: XPCOM.nsXPCComponents_Interfaces,
      private windowMediator: XPCOM.nsIWindowMediator,
  ) {
    super("app.services.windows", parentLog);
  }

  public forEachOpenWindow<Tthis, Trv = void>(
      aCallback: (this: Tthis, window: XUL.chromeWindow) => Trv,
      aThisArg: Tthis | null = null,
  ): Trv[] {
    // Apply a function to all open browser windows
    const windows = this.windowMediator.getEnumerator("navigator:browser");
    const rvs: Trv[] = [];
    while (windows.hasMoreElements()) {
      const window = windows.getNext().
          QueryInterface<XPCOM.nsIDOMWindow>(this.ci.nsIDOMWindow);
      const rv = aCallback.call(aThisArg, window);
      rvs.push(rv);
    }
    return rvs;
  }

  public getMostRecentBrowserWindow(): XUL.chromeWindow {
    return this.windowMediator.getMostRecentWindow("navigator:browser") as any;
  }

  protected startupSelf() {
    this.windowMediator.addListener(this.windowMediatorListener);
    return Promise.resolve();
  }

  protected shutdownSelf() {
    this.windowMediator.removeListener(this.windowMediatorListener);

    for (const window of this.windows.values()) {
      window.removeEventListener("load", this.progressEventListener, false);
      window.removeEventListener("unload", this.progressEventListener, false);
    }
    this.windows.clear();

    return Promise.resolve();
  }

  private onProgressEvent(event: ProgressEvent) {
    const domWindow = event.target as XPCOM.nsIDOMWindow;

    if (event.type in ["load", "unload"]) {
      domWindow.removeEventListener(
          event.type, this.progressEventListener, false,
      );
    }
    switch (event.type) {
      case "load":
        this.events.listenersMap.onWindowLoaded.emit(event);
        break;

      case "unload":
        this.events.listenersMap.onWindowUnloaded.emit(event);
        this.windows.delete(domWindow);
        break;

      default:
        break;
    }
  }

  private areWindowsAvailable() {
    if (this.getMostRecentBrowserWindow() === null) {
      return false;
    }
    try {
      this.forEachOpenWindow((win) => WindowUtils.getTabBrowser(win));
    } catch (e) {
      return false;
    }
    return true;
  }

  private promiseSessionstoreWindowsRestored() {
    return promiseObserverTopic("sessionstore-windows-restored").
        then(() => undefined);
  }
}
