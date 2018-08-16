/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

import { App, IVersionComparator } from "app/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import {objectValues} from "lib/utils/js-utils";

interface IInfos {
  curAppVersion: string;
  curRPVersion: string;
  isRPUpgrade: boolean;
  lastAppVersion: string;
  lastRPVersion: string;
}
interface IOptionalInfos {
  curAppVersion?: IInfos["curAppVersion"];
  curRPVersion?: IInfos["curRPVersion"];
  isRPUpgrade?: IInfos["isRPUpgrade"];
  lastAppVersion?: IInfos["lastAppVersion"];
  lastRPVersion?: IInfos["lastRPVersion"];
}
interface IInfoPromises {
  curAppVersion?: Promise<IInfos["curAppVersion"]>;
  curRPVersion?: Promise<IInfos["curRPVersion"]>;
  isRPUpgrade?: Promise<IInfos["isRPUpgrade"]>;
  lastAppVersion?: Promise<IInfos["lastAppVersion"]>;
  lastRPVersion?: Promise<IInfos["lastRPVersion"]>;
}

// =============================================================================
// VersionInfos
// =============================================================================

export class VersionInfoService extends Module {
  public get curAppVersion() { return this.infos.curAppVersion; }
  public get curRPVersion() { return this.infos.curRPVersion; }
  public get isRPUpgrade() { return this.infos.isRPUpgrade; }
  public get lastAppVersion() { return this.infos.lastAppVersion; }
  public get lastRPVersion() { return this.infos.lastRPVersion; }

  private infos: IInfos;

  constructor(
      log: Common.ILog,
      private versionComparator: IVersionComparator,
      private cachedSettings: App.storage.ICachedSettings,
      private managementApi: typeof browser.management,
      private runtimeApi: typeof browser.runtime,
  ) {
    super("app.services.versionInfo", log);
  }

  protected get dependencies(): Module[] {
    return [
      this.cachedSettings,
    ];
  }

  protected startupSelf() {
    const promises: IInfoPromises = {};

    const checkPromise = (aPropName: keyof IInfoPromises) => {
      (promises[aPropName] as Promise<any>).catch((e) => {
        this.log.error(`Error initializing "${aPropName}":`, e);
      });
    };

    const infos: IOptionalInfos = {};

    // -------------------------------------------------------------------------
    // RP version info
    // -------------------------------------------------------------------------

    promises.lastRPVersion = Promise.resolve(
        this.cachedSettings.get("lastVersion") as IInfos["lastRPVersion"],
    );
    checkPromise("lastRPVersion");

    promises.isRPUpgrade =
        promises.lastRPVersion.
        then((lastRPVersion) => {
          // Compare with version 1.0.0a8 since that version introduced
          // the "welcome window".
          infos.isRPUpgrade = !!lastRPVersion &&
              this.versionComparator.compare(lastRPVersion, "1.0.0a8") <= 0;
          return infos.isRPUpgrade;
        });
    checkPromise("isRPUpgrade");

    promises.curRPVersion =
        this.managementApi.getSelf().
        then((addon) => {
          infos.curRPVersion = addon.version;
          return infos.curRPVersion;
        });
    checkPromise("curRPVersion");

    // -------------------------------------------------------------------------
    // app version info
    // -------------------------------------------------------------------------

    promises.lastAppVersion = Promise.resolve(
        this.cachedSettings.get("lastAppVersion") as IInfos["lastAppVersion"],
    );
    checkPromise("lastAppVersion");

    promises.curAppVersion =
        this.runtimeApi.getBrowserInfo().
        then(({version}) => {
          infos.curAppVersion = version;
          return version;
        });
    checkPromise("curAppVersion");

    // -------------------------------------------------------------------------
    // store last*Version
    // -------------------------------------------------------------------------

    const p = Promise.all(objectValues(promises)).then(() => {
      this.infos = infos as IInfos;
      const {curAppVersion, curRPVersion} = infos;
      return this.cachedSettings.set({
        lastAppVersion: curAppVersion,
        lastVersion: curRPVersion,
      });
    }).catch((e) => {
      this.log.error("Failed to initialize VersionInfoService", e);
    }) as Promise<void>;

    return MaybePromise.resolve(p);
  }
}
