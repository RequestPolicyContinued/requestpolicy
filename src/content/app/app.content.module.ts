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
import { RPContentServices } from "app/services/services.module.content";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

export class AppContent extends Module {
  // protected get debugEnabled() { return true; }

  constructor(
      log: Common.ILog,
      protected readonly outerWindowID: number,
      public readonly contentSide: App.IContentSide,
      public readonly services: RPContentServices,
      public readonly storage: App.IStorage,
  ) {
    super(`AppContent[${outerWindowID}]`, log);
  }

  public get subModules() {
    return {
      contentSide: this.contentSide,
      services: this.services,
      storage: this.storage,
    };
  }
}
