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
import { Module } from "lib/classes/module";
import { getDOMWindowUtils } from "lib/utils/window-utils";

export class WindowModuleMap extends Module
    implements App.windows.IWindowModuleMap {
  // tslint:disable-next-line:variable-name
  public _map = new Map<number, App.windows.IWindowModule>();

  constructor(
      parentLog: Common.ILog,
  ) {
    super("app.windows.windowModuleMap", parentLog);
  }

  public get(window: XUL.chromeWindow): App.windows.IWindowModule | undefined {
    return this._map.get(this.getWindowId(window));
  }

  public getWindowId(window: XUL.chromeWindow): number {
    const domWindowUtils = getDOMWindowUtils(window);
    return domWindowUtils.outerWindowID;
  }
}
