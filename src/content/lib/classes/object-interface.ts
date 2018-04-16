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

import {createListenersMap} from "lib/utils/listener-factories";

export interface IKeysObject {
  [key: string]: any;
}
export type IKeysWithDefaults = IKeysObject;

type GetFunctionParameter1<TKeysWithDefaults extends IKeysObject> =
    string | string[] | TKeysWithDefaults | null | undefined;

// =============================================================================

export abstract class AbstractObjectInterface<TKeys extends IKeysObject> {
  private eventListenersMap = createListenersMap([
    "onChanged",
  ]).listenersMap;

  // tslint:disable:member-ordering
  public readonly onChanged = this.eventListenersMap.onChanged.interface;
  // tslint:enable:member-ordering

  public get(aKeys: GetFunctionParameter1<TKeys>) {
    let keys: string[];
    let isObjectWithDefaults = false;

    if (typeof aKeys === "string") {
      keys = [aKeys];
    } else if (typeof aKeys === "object" && aKeys !== null) {
      if (Array.isArray(aKeys)) {
        keys = aKeys as string[];
      } else {
        isObjectWithDefaults = true;
        keys = Object.keys(aKeys as IKeysWithDefaults);
      }
      if (keys.length === 0) {
        return this.getNothing();
      }
    } else {
      return this.getAll();
    }
    const results = this.getByKeys(keys);
    if (isObjectWithDefaults) {
      const defaults = aKeys as IKeysWithDefaults;
      // tslint:disable-next-line prefer-const
      for (let key in keys) {
        if (!(results.hasOwnProperty(key))) {
          results[key] = defaults[key];
        }
      }
    }
    return results;
  }

  public set(aKeys: IKeysObject) {
    if (typeof aKeys !== "object") {
      throw new Error("aKeys must be an object!");
    }
    Object.keys(aKeys).forEach((key) => {
      this.setByKey(key, aKeys[key]);
    });
    this.eventListenersMap.onChanged.emit();
  }

  public remove(aKeys: string | string[]) {
    if (typeof aKeys === "string") {
      aKeys = [aKeys];
    }
    this.removeByKeys(aKeys);
    this.eventListenersMap.onChanged.emit();
  }

  protected abstract getAll(): TKeys;
  protected abstract getNothing(): TKeys;
  protected abstract getByKeys(keys: string[]): TKeys;
  protected abstract setByKey(key: string, value: any): void;
  protected abstract removeByKeys(keys: string[]): void;
}

// =============================================================================

// tslint:disable-next-line:max-classes-per-file
export class ObjectInterface<
    TKeys extends IKeysObject
> extends AbstractObjectInterface<TKeys> {
  private obj: IKeysObject;

  constructor(aObject: IKeysObject) {
    super();
    this.obj = aObject;
  }

  protected getAll(): TKeys {
    return Object.assign({}, this.obj) as TKeys;
  }
  protected getNothing(): TKeys {
    return {} as TKeys;
  }
  protected getByKeys(aKeys: string[]): TKeys {
    const rv = {} as TKeys;
    aKeys.forEach((key) => {
      if (key in this.obj) rv[key] = this.obj[key];
    });
    return rv;
  }
  protected setByKey(key: string, value: any): void {
    this.obj[key] = value;
  }
  protected removeByKeys(keys: string[]): void {
    keys.forEach((key) => {
      if (key in this.obj) delete this.obj[key];
    });
  }
}
