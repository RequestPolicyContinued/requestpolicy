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
import { RPServices } from "app/services/services.module";
import { Module } from "lib/classes/module";
import { Migration } from "./migration/migration.module";
import { Policy } from "./policy/policy.module";
import { Storage } from "./storage/storage.module";
import { Ui } from "./ui/ui.module";

export class AppBackground extends Module {
  constructor(
      log: App.ILog,
      public readonly migration: Migration,
      public readonly policy: Policy,
      public readonly services: RPServices,
      public readonly storage: Storage,
      public readonly ui: Ui,
  ) {
    super("App", log);
  }

  public get subModules() {
    return {
      migration: this.migration,
      policy: this.policy,
      services: this.services,
      storage: this.storage,
      ui: this.ui,
    };
  }
}
