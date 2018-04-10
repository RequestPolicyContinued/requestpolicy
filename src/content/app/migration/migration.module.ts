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

import { V0RulesMigration } from "legacy/app/migration/v0-rules-migration";
import { IModule, Module } from "lib/classes/module";
import { Log } from "models/log";

export class Migration extends Module {
  constructor(
      log: Log,
      public readonly v0Rules: V0RulesMigration | null,
  ) {
    super("app.migration", log);
  }

  protected get subModules() {
    const rv: {[k: string]: IModule} = {};
    if (this.v0Rules) { rv.v0Rules = this.v0Rules; }
    return rv;
  }
}
