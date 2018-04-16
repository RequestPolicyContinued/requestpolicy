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

import { Module } from "lib/classes/module";
import { API } from "./interfaces";

export class Api extends Module {
  constructor(
      log: API.ILog,
      public readonly extension: API.extension.IExtension,
      public readonly i18n: API.i18n.II18n,
      public readonly management: API.management.IManagement,
      public readonly manifest: API.IManifest,
      public readonly runtime: API.runtime.IRuntime,
      public readonly storage: API.storage.IStorage,
      private readonly miscInfos: API.IMiscInfos,
      private readonly prefs: API.storage.IPrefs,
      private readonly prefObserverFactory: API.storage.PrefObserverFactory,
  ) {
    super("API", log);
  }

  protected get subModules() {
    return {
      extension: this.extension,
      i18n: this.i18n,
      management: this.management,
      manifest: this.manifest,
      runtime: this.runtime,
      storage: this.storage,
    };
  }

  public get backgroundApi() {
    return {
      extension: this.extension.backgroundApi,
      i18n: this.i18n.backgroundApi,
      management: this.management.backgroundApi,
      runtime: this.runtime.backgroundApi,
      storage: this.storage.backgroundApi,
    };
  }

  public get contentApi() {
    return {
      extension: this.extension.contentApi,
      i18n: this.i18n.contentApi,
      runtime: this.runtime.contentApi,
      storage: this.storage.contentApi,
    };
  }

  public get legacyApi() {
    return {
      createPrefObserver: this.prefObserverFactory,
      i18n: this.i18n.legacyApi,
      miscInfos: this.miscInfos,
      prefs: this.prefs,
      storage: {},
    };
  }

  public get bootstrap() {
    return {
      setBackgroundPage: this.extension.setBackgroundPage.
          bind(this.extension),
    };
  }
}
