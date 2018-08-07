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
import { API, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

export class XulTrees extends Module {
  private get overlay() { return this.overlayWrapper.module!; }

  protected get startupPreconditions() {
    return [
      Promise.resolve(),
    ];
  }

  constructor(
      parentLog: Common.ILog,
      protected readonly windowID: number,
      protected readonly window: XUL.chromeWindow,

      private readonly xulService: API.services.IXulService,

      private readonly classicmenu: App.windows.window.IClassicMenu,
      private readonly menu: App.windows.window.IMenu,
      private readonly overlayWrapper: {
        module: App.windows.window.IOverlay | null;
      },
  ) {
    super(
        `app.windows[${windowID}].xulTrees`,
        parentLog,
    );
  }

  protected startupSelf() {
    // create a scope variable
    (this.window as any).rpcontinued = {
      classicmenu: this.classicmenu,
      menu: this.menu,
      overlay: this.overlay,
    };

    // add all XUL elements
    this.xulService.addTreeElementsToWindow(this.window, "mainTree");

    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf() {
    // remove all XUL elements
    this.xulService.removeTreeElementsFromWindow(this.window, "mainTree");

    // Remove the scope variable.
    // This wouldn't be needed when the window is closed, but this has to be
    // done when RP is being disabled.
    // eslint-disable-next-line no-param-reassign
    delete (this.window as any).rpcontinued;

    return MaybePromise.resolve(undefined);
  }
}
