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

import { App, IObject } from "app/interfaces";
import { XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { C } from "data/constants";
import { BoundMethods } from "lib/classes/bound-methods";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import { getWindowId } from "lib/utils/window-utils";

export class Windows extends Module implements App.IWindows {
  protected get debugEnabled() { return C.LOG_BG_CONTENT_BOUNDARIES; }

  private boundMethods = new BoundMethods(this);

  protected get dependencies() {
    return {
      cachedSettings: this.cachedSettings,
      windowService: this.windowService,
    };
  }

  protected get subModules() {
    // On startup, `windowModules` will contain nothing, but on shutdown
    // it will contain all `IWindowModule`s.
    const windowModules = {} as IObject<Module>;
    this.windowModules._map.forEach((v, k) => {
      windowModules[`windowModule #${k}`] = v;
    });
    return Object.assign(
        {
          chromeStyleSheets: this.chromeStyleSheets,
          windowModuleMap: this.windowModules,
        } as IObject<Module>,
        this.toolbarbutton ? {
          toolbarbutton: this.toolbarbutton,
        } : {},
        windowModules,
    );
  }

  constructor(
      parentLog: Common.ILog,
      private readonly cachedSettings: App.storage.ICachedSettings,
      private readonly createWindowModule: App.windows.WindowModuleFactory,
      private readonly windowService: App.services.IWindowService,

      public readonly chromeStyleSheets: App.windows.IChromeStyleSheets,
      public readonly toolbarbutton: App.windows.IToolbarButton | null,
      public readonly windowModules: App.windows.IWindowModuleMap,
  ) {
    super("app.windows", parentLog);
  }

  protected startupSelf() {
    const promises = this.windowService.
        forEachOpenWindow<Windows, Promise<void>>(
            this.boundMethods.get(this.loadIntoWindow),
            undefined,
            { ready: true },
        );
    this.windowService.onWindowLoaded.addListener(
        this.boundMethods.get(this.onWindowLoaded),
    );
    this.windowService.onWindowUnloaded.addListener(
        this.boundMethods.get(this.onWindowUnloaded),
    );
    return MaybePromise.all(promises) as MaybePromise<any>;
  }

  private onWindowLoaded(chromeWindow: XUL.chromeWindow): void {
    this.loadIntoWindow(chromeWindow).
        catch(this.log.onError("loadIntoWindow()"));
  }

  private onWindowUnloaded(chromeWindow: XUL.chromeWindow): void {
    this.unloadFromWindow(chromeWindow);
  }

  private loadIntoWindow(window: XUL.chromeWindow): Promise<void> {
    const windowID = getWindowId(window);
    this.debugLog.log(`loadIntoWindow(), windowID=${windowID}`);
    if (this.windowModules._map.has(windowID)) {
      this.log.error(`Window #${windowID} already loaded.`);
      return MaybePromise.reject(undefined) as MaybePromise<any>;
    }
    const windowModule = this.createWindowModule(window);
    this.windowModules._map.set(windowID, windowModule);
    return windowModule.startup();
  }

  private unloadFromWindow(window: XUL.chromeWindow): void {
    const windowID = getWindowId(window);
    this.debugLog.log(`unloadFromWindow(), windowID=${windowID}`);
    if (!this.windowModules._map.has(windowID)) {
      this.log.warn(`Window #${windowID} not loaded.`);
      return;
    }
    const windowModule = this.windowModules._map.get(windowID)!;
    const rv = windowModule.shutdown();
    this.windowModules._map.delete(windowID);
    return rv;
  }
}
