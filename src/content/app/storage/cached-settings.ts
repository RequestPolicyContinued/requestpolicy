/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

import { App } from "app/interfaces";
import { API } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

interface IDefaultValues {
  [key: string]: string | number | boolean;
}

export class CachedSettings extends Module
implements App.storage.ICachedSettings {
  public readonly alias: {[a: string]: (...keys: any[]) => any} = {};

  protected get dependencies(): Module[] {
    return [
      this.storageApi,
    ];
  }

  private cachedKeys: string[];
  private cachedKeysSet: Set<string>;
  private defaultValues: IDefaultValues;

  private get storageArea() { return this.storageApi.local; }

  constructor(
      log: Common.ILog,
      {
          cachedKeys,
          boolAliases,
          defaultValues,
      }: {
          cachedKeys: string[],
          boolAliases: Array<[string, string]>,
          defaultValues: IDefaultValues,
      },
      private storageApi: App.storage.IStorageApiWrapper,
      private rpPrefBranch: API.storage.IPrefBranch,
  ) {
    super("app.storage.cachedSettings", log);

    this.cachedKeys = cachedKeys;
    this.cachedKeysSet = new Set(cachedKeys);
    this.defaultValues = defaultValues;

    boolAliases.forEach(([storageKey, alias]) => {
      this.alias[`is${alias}`] = () => this.get(storageKey);
      this.alias[`set${alias}`] = (value) => this.set({[storageKey]: value});
    });
  }

  public isKeyCached(aKey: string) {
    this.assertReady();
    return this.cachedKeysSet.has(aKey);
  }

  public get<T = any>(aKeys: ""): {};
  public get<T = any>(aKeys: string[] | null | undefined): {[key: string]: T};
  public get<T = any>(aKeys: string): T;
  public get(aKeys: "" | string | string[] | null | undefined) {
    this.assertReady();
    if (aKeys === "") return {};
    if (aKeys === null || aKeys === undefined) {
      return this.get(this.cachedKeys);
    }
    if (typeof aKeys === "string") {
      const key = aKeys;
      return this.getRaw(key);
    }
    if (Array.isArray(aKeys)) {
      const result: {[key: string]: any} = {};
      aKeys.forEach((key) => {
        result[key] = this.getRaw(key);
      });
      return result;
    }
    throw new Error(`Invalid key "${aKeys}"`);
  }

  public set(aKeys: {[key: string]: any}): Promise<void> {
    const p = this.set_(aKeys);
    p.catch((e) => {
      console.error("Error when saving to storage:");
      console.dir({error: e, keys: aKeys});
    });
    return p;
  }

  public set_(aKeys: {[key: string]: any}): Promise<void> {
    this.assertReady();
    return this.storageArea.set(aKeys);
  }

  private getRaw(aKey: string): any {
    if (!this.isKeyCached(aKey)) {
      throw new Error(`Key "${aKey}" is not cached in Storage!`);
    }
    const result = this.rpPrefBranch.get(aKey);
    return result === undefined ? this.defaultValues[aKey] : result;
  }
}
