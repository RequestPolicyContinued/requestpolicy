/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

import {
  StorageMigrationFromXpcom,
} from "controllers/storage-migration-from-xpcom";
import { Connection } from "lib/classes/connection";
import { Module } from "lib/classes/module";
import { Log } from "models/log";

export class EweModule extends Module {
  constructor(
      log: Log,
      public readonly legacyConnection: Connection<any, any>,
      public readonly settingsMigration: StorageMigrationFromXpcom,
  ) {
    super("ewe", log);
  }

  public get subModules() {
    return {
      legacyConnection: this.legacyConnection,
      settingsMigration: this.settingsMigration,
    };
  }
}
