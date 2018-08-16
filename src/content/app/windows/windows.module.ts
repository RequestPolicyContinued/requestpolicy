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

import { App } from "app/interfaces";
import { XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { BoundMethods } from "lib/classes/bound-methods";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

export class Windows extends Module implements App.IWindows {
  // protected get debugEnabled() { return true; }

  private boundMethods = new BoundMethods(this);

  protected get dependencies(): Module[] {
    return [
      this.cachedSettings,
      this.windowService,
    ];
  }

  protected get subModules() {
    const subModules: {[name: string]: Module} = {
      chromeStyleSheets: this.chromeStyleSheets,
      toolbarbutton: this.toolbarbutton,
      windowModules: this.windowModules,
    };
    return subModules;
  }

  constructor(
      parentLog: Common.ILog,
      private readonly cachedSettings: App.storage.ICachedSettings,
      private readonly createWindowModule: App.windows.WindowModuleFactory,
      private readonly windowService: App.services.IWindowService,

      public readonly chromeStyleSheets: App.windows.IChromeStyleSheets,
      public readonly toolbarbutton: App.windows.IToolbarButton,
      public readonly windowModules: App.windows.IWindowModuleMap,
  ) {
    super("app.windows", parentLog);
  }

  protected startupSelf() {
    const promises = this.windowService.
        forEachOpenWindow<Windows, MaybePromise<void>>(
            this.boundMethods.get(this.loadIntoWindow),
        );
    this.windowService.onWindowLoaded.addListener(
        this.boundMethods.get(this.onWindowLoaded),
    );
    this.windowService.onWindowUnloaded.addListener(
        this.boundMethods.get(this.onWindowUnloaded),
    );
    return MaybePromise.all(promises) as MaybePromise<any>;
  }

  protected shutdownSelf() {
    const rvs = this.windowService.
        forEachOpenWindow<Windows, MaybePromise<void>>(
            this.boundMethods.get(this.unloadFromWindow),
        );
    return MaybePromise.all(rvs) as MaybePromise<any>;
  }

  private onWindowLoaded(event: ProgressEvent): void {
    const doc = event.target as XUL.chromeDocument;
    const win = doc.defaultView as XUL.chromeWindow;
    this.loadIntoWindow(win);
  }

  private onWindowUnloaded(event: ProgressEvent): void {
    const doc = event.target as XUL.chromeDocument;
    const win = doc.defaultView as XUL.chromeWindow;
    this.unloadFromWindow(win);
  }

  private loadIntoWindow(window: XUL.chromeWindow): MaybePromise<void> {
    const windowID = this.windowModules.getWindowId(window);
    this.debugLog.log(`loadIntoWindow(), windowID=${windowID}`);
    if (this.windowModules._map.has(windowID)) {
      this.log.error(`Window #${windowID} already loaded.`);
      return MaybePromise.reject(undefined) as MaybePromise<any>;
    }
    const windowModule = this.createWindowModule(window);
    this.windowModules._map.set(windowID, windowModule);
    return windowModule.startup();
  }

  private unloadFromWindow(window: XUL.chromeWindow): MaybePromise<void> {
    const windowID = this.windowModules.getWindowId(window);
    this.debugLog.log(`unloadFromWindow(), windowID=${windowID}`);
    if (!this.windowModules._map.has(windowID)) {
      this.log.warn(`Window #${windowID} not loaded.`);
      return MaybePromise.resolve(undefined);
    }
    const windowModule = this.windowModules._map.get(windowID)!;
    return windowModule.shutdown();
  }
}
