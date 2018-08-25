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
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

export class RPServices extends Module {
  constructor(
      log: Common.ILog,
      public readonly httpChannel: App.services.IHttpChannelService,
      public readonly privateBrowsing: App.services.IPrivateBrowsingService,
      public readonly redirections: App.services.IRedirectionService,
      public readonly request: App.services.IRequestService,
      public readonly requestSet: App.services.IRequestSetService,
      public readonly rules: App.services.IRulesServices,
      public readonly uri: App.services.IUriService,
      public readonly versionInfo: App.services.IVersionInfoService,
      public readonly windows: App.services.IWindowService,
  ) {
    super("app.services", log);
  }

  protected get subModules() {
    return {
      httpChannel: this.httpChannel,
      privateBrowsing: this.privateBrowsing,
      redirections: this.redirections,
      request: this.request,
      requestSet: this.requestSet,
      rules: this.rules,
      uri: this.uri,
      versionInfo: this.versionInfo,
      windows: this.windows,
    };
  }
}
