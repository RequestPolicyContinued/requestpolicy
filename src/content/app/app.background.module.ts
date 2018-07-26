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
import { Runtime } from "app/runtime/runtime.module";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

export class AppBackground extends Module {
  constructor(
      log: Common.ILog,
      public readonly browserSettings: App.IBrowserSettings,
      public readonly migration: App.IMigration,
      public readonly policy: App.IPolicy,
      public readonly runtime: Runtime,
      public readonly services: App.IRPServices,
      public readonly storage: App.IStorage,
      public readonly ui: App.IUi,
      public readonly webRequest: App.IWebRequest,
      public readonly windows: App.IWindows,
  ) {
    super("app", log);
  }

  protected get subModules() {
    return {
      browserSettings: this.browserSettings,
      migration: this.migration,
      policy: this.policy,
      runtime: this.runtime,
      services: this.services,
      storage: this.storage,
      ui: this.ui,
      webRequest: this.webRequest,
      windows: this.windows,
    };
  }
}
