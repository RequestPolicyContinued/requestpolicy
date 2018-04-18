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
import { RulesServices } from "app/services/rules/rules-services.module";
import { UriService } from "app/services/uri-service";
import { VersionInfoService } from "app/services/version-info-service";
import { Module } from "lib/classes/module";

export class RPServices extends Module {
  constructor(
      log: App.ILog,
      public readonly rules: RulesServices,
      public readonly uri: UriService,
      public readonly versionInfo: VersionInfoService,
  ) {
    super("app.services", log);
  }

  protected get subModules() {
    return {
      rules: this.rules,
      uri: this.uri,
      versionInfo: this.versionInfo,
    };
  }
}
