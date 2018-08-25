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
import { API } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

export class WindowModule extends Module {
  protected get subModules() {
    return {
      classicMenu: this.classicMenu,
      keyboardShortcuts: this.keyboardShortcuts,
      menu: this.menu,
      overlay: this.overlay,
      toolbarButton: this.toolbarButton,
    };
  }

  constructor(
      parentLog: Common.ILog,
      public readonly windowID: number,

      private classicMenu: App.windows.window.IClassicMenu,
      private keyboardShortcuts: API.windows.window.IKeyboardShortcutModule,
      private menu: App.windows.window.IMenu,
      private overlay: App.windows.window.IOverlay,
      private toolbarButton: App.windows.window.IToolbarButton,
  ) {
    super(`app.windows[${windowID}]`, parentLog);
  }
}
