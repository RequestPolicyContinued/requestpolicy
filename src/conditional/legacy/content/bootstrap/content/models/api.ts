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

import {PrefObserver} from "bootstrap/lib/classes/pref-observer";
import * as LegacyMiscInfos from "bootstrap/models/legacy-misc-infos";
import {Prefs} from "bootstrap/models/prefs";
import {Module} from "content/lib/classes/module";
import {Log} from "content/models/log";
import {Extension} from "./api/extension";
import {I18n} from "./api/i18n";
import {Management} from "./api/management";
import {Runtime} from "./api/runtime";
import {Storage} from "./api/storage";
import {Manifest} from "./manifest";

export class Api extends Module {
  private static lInstance: Api;
  public static get instance(): Api {
    if (!Api.lInstance) {
      Api.lInstance = new Api({log: Log.instance});
    }
    return Api.lInstance;
  }

  protected moduleName = "API";
  protected subModules = {
    extension: new Extension({log: this.log}),
    i18n: new I18n({log: this.log}),
    management: new Management({log: this.log}),
    manifest: new Manifest({log: this.log}),
    runtime: new Runtime({log: this.log}),
    storage: new Storage({log: this.log}),
  };

  public get backgroundApi() {
    return {
      extension: this.subModules.extension.backgroundApi,
      i18n: this.subModules.i18n.backgroundApi,
      management: this.subModules.management.backgroundApi,
      runtime: this.subModules.runtime.backgroundApi,
      storage: this.subModules.storage.backgroundApi,
    };
  }

  public get contentApi() {
    return {
      extension: this.subModules.extension.contentApi,
      i18n: this.subModules.i18n.contentApi,
      runtime: this.subModules.runtime.contentApi,
      storage: this.subModules.storage.contentApi,
    };
  }

  public get legacyApi() {
    return {
      PrefObserver,
      i18n: this.subModules.i18n.legacyApi,
      miscInfos: LegacyMiscInfos,
      prefs: Prefs,
      storage: {},
    };
  }

  public get manifest() {
    return this.subModules.manifest.manifest;
  }

  public get bootstrap() {
    return {
      setBackgroundPage: this.subModules.extension.setBackgroundPage.
          bind(this.subModules.extension),
    };
  }
}
