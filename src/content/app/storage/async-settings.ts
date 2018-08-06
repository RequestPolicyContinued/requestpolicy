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
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import { createListenersMap } from "lib/utils/listener-factories";

interface IObject<T> {
  [key: string]: T;
}
type tSettingValue = string | number | boolean;
type IDefaultSettings = IObject<tSettingValue>;

export class AsyncSettings extends Module
    implements App.storage.IAsyncSettings {
  protected get startupPreconditions() {
    return [
      this.storageReadyPromise,
    ];
  }

  private changeEventListener = this.onChangedEvent.bind(this);
  private events = createListenersMap(["onChanged"]);

  // tslint:disable-next-line:member-ordering
  public onChanged = this.events.interfaces.onChanged;

  constructor(
      log: Common.ILog,
      protected readonly outerWindowID: number | null,
      private storageApi: typeof browser.storage,
      private storageArea: browser.storage.StorageArea,
      private defaultSettings: IDefaultSettings,
      private storageReadyPromise: Promise<void>,
  ) {
    super(
        `${
            outerWindowID === null ? "app" : `AppContent[${outerWindowID}]`
        }.storage.asyncSettings`, log);
  }

  public get(aKeys: "" | string | string[]): Promise<any> {
    this.assertReady();
    if (aKeys === "") return Promise.resolve({});
    const keys: string[] =  typeof aKeys === "string" ? [aKeys] : aKeys;
    const keysWithDefaults: IObject<tSettingValue> = {};
    keys.forEach((key) => {
      if (!this.defaultSettings.hasOwnProperty(key)) {
        throw new Error(`Setting "${key}" has no default value!`);
      }
      keysWithDefaults[key] = this.defaultSettings[key];
    });
    return this.storageArea.get(keysWithDefaults);
  }

  public set(aKeys: IObject<any>) {
    return this.storageArea.set(aKeys);
  }

  protected startupSelf() {
    this.storageApi.onChanged.addListener(this.changeEventListener);
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf() {
    this.storageApi.onChanged.removeListener(this.changeEventListener);
    return MaybePromise.resolve(undefined);
  }

  private onChangedEvent(
      changes: browser.storage.ChangeDict,
      areaName: string,
  ) {
    const changes2: browser.storage.ChangeDict = {};
    Object.keys(changes).forEach((key) => {
      if (!this.defaultSettings.hasOwnProperty(key)) return;
      const change = changes[key];
      if (!change.hasOwnProperty("newValue")) {
        const defaultValue = this.defaultSettings[key];
        if (change.hasOwnProperty("oldValue") &&
            change.oldValue === defaultValue) return;
        change.newValue = defaultValue;
      }
      changes2[key] = change;
    });
    if (Object.keys(changes2).length === 0) return;
    this.events.listenersMap.onChanged.emit(changes2, areaName);
  }
}
