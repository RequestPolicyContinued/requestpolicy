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
import { WindowModule } from "app/windows/window/window.module";
import { XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";
import { getDOMWindowUtils } from "lib/utils/window-utils";

export class Windows extends Module {
  private windowModules = new Map<number, WindowModule>();

  protected get startupPreconditions() {
    return [
      this.cachedSettings.whenReady,
      this.windowService.whenReady,
    ];
  }

  protected get subModules() {
    const subModules: {[name: string]: Module} = {
      chromeStyleSheets: this.chromeStyleSheets,
      toolbarbutton: this.toolbarbutton,
    };
    return subModules;
  }

  constructor(
      parentLog: Common.ILog,
      private cachedSettings: App.storage.ICachedSettings,
      private createWindowModule: App.windows.WindowModuleFactory,
      private windowService: App.services.IWindowService,

      private chromeStyleSheets: App.windows.IChromeStyleSheets,
      private toolbarbutton: App.windows.IToolbarButton,
  ) {
    super("app.windows", parentLog);
  }

  protected startupSelf() {
    const promises = this.windowService.forEachOpenWindow<
        Windows,
        Promise<void>
    >(this.loadIntoWindow.bind(this));
    this.windowService.onWindowLoaded.
        addListener(this.loadIntoWindow.bind(this));
    this.windowService.onWindowUnloaded.
        addListener(this.unloadFromWindow.bind(this));
    return Promise.all(promises).then(() => undefined);
  }

  protected shutdownSelf() {
    const rvs = this.windowService.forEachOpenWindow<
        Windows,
        Promise<void>
    >(this.unloadFromWindow.bind(this));
    return Promise.all(rvs).then(() => undefined);
  }

  private loadIntoWindow(window: XPCOM.nsIDOMWindow) {
    const domWindowUtils = getDOMWindowUtils(window as any);
    const {outerWindowID} = domWindowUtils;
    if (this.windowModules.has(outerWindowID)) {
      this.log.error(`Window #${outerWindowID} already loaded.`);
      return Promise.reject();
    }
    const windowModule = this.createWindowModule(window);
    this.windowModules.set(outerWindowID, windowModule);
    windowModule.startup().
        catch(this.log.onError(`Window #${outerWindowID} startup.`));
  }

  private unloadFromWindow(window: XPCOM.nsIDOMWindow) {
    const domWindowUtils = getDOMWindowUtils(window as any);
    const {outerWindowID} = domWindowUtils;
    if (!this.windowModules.has(outerWindowID)) {
      this.log.error(`Window #${outerWindowID} not loaded.`);
      return;
    }
    const windowModule = this.windowModules.get(outerWindowID)!;
    return windowModule.shutdown();
  }
}
