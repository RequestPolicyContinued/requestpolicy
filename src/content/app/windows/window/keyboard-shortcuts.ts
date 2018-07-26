/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2015 Martin Kimmerle
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

export class KeyboardShortcuts extends Module {
  // protected get debugEnabled() { return true; }

  // tslint:disable-next-line:variable-name
  private readonly _subModules = {
    openMenu: this.generateKeyboardShortcut(
        "openMenu",
        "alt shift r",
        () => { this.rpOverlay.toggleMenu(); },
        "keyboardShortcuts.openMenu.enabled",
        "keyboardShortcuts.openMenu.combo",
    ),
    openRequestLog: this.generateKeyboardShortcut(
        "openRequestLog",
        "none",
        () => { this.rpOverlay.toggleRequestLog(); },
        "keyboardShortcuts.openRequestLog.enabled",
        "keyboardShortcuts.openRequestLog.combo",
    ),
  };

  protected get subModules() {
    return this._subModules;
  }

  protected get startupPreconditions() {
    return [
      this.rpOverlay.whenReady,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      windowID: number,
      private rpOverlay: App.windows.window.IOverlay,
      private generateKeyboardShortcut:
          API.windows.window.KeyboardShortcutFactory,
  ) {
    super(
        `app.windows.window[${windowID}].keyboardShortcuts`,
        parentLog,
    );
  }
}
