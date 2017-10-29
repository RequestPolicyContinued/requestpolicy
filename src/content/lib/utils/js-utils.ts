/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2015 Martin Kimmerle
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

export function arrayIncludes<T = any>(array: T[], searchElement: T) {
  // tslint:disable-next-line prefer-const
  for (let element of array) {
    if (element === searchElement) {
      return true;
    }
  }
  return false;
}

enum PromiseState {
  pending = "pending",
  fulfilled = "fulfilled",
  rejected = "rejected",
}

export interface IDeferred<T> {
  promise: Promise<T>;
  promiseState: PromiseState;
  reject: (arg: any) => void;
  resolve: (arg: any) => void;
}

/**
 * Defer some task.
 */
export function defer<T = void>(): IDeferred<T> {
  let promiseState: PromiseState = PromiseState.pending;
  let rejectFn: (value: T) => void;
  let resolveFn: (value: T) => void;

  const promise = new Promise<T>((resolve, reject) => {
    rejectFn = reject;
    resolveFn = resolve;
  });

  return {
    promise,
    promiseState,
    reject(arg: T) {
      promiseState = PromiseState.rejected;
      rejectFn(arg);
    },
    resolve(arg: T) {
      promiseState = PromiseState.fulfilled;
      resolveFn(arg);
    },
  };
}

export function defineLazyGetter<V = any>(
    aOnObj: {[key: string]: any},
    aKey: string,
    aValueFn: () => V,
) {
  Object.defineProperty(aOnObj, aKey, {
    get() {
      delete aOnObj[aKey];
      const value = aValueFn.call(aOnObj);
      Object.defineProperty(aOnObj, aKey, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
      return value;
    },
    configurable: true,
    enumerable: true,
  });
}

export function leftRotateArray<T = any>(array: T[], n: number): T[] {
  n = n % array.length;
  const firstPart = array.slice(0, n);
  const secondPart = array.slice(n);
  return secondPart.concat(firstPart);
}

// Object.values() polyfill
export function objectEntries<T = any>(
    obj: {[k: string]: T},
): Array<[string, T]> {
  const keys = Object.keys(obj);
  let i = keys.length;
  const resArray = new Array(i);
  while (i--) resArray[i] = [keys[i], obj[keys[i]]];
  return resArray;
}

// Object.values() polyfill
export function objectValues(obj: any): any[] {
  const keys = Object.keys(obj);
  let i = keys.length;
  const resArray = new Array(i);
  while (i--) resArray[i] = keys[i];
  return resArray;
}

/**
 * Create an array containing the elements [0, ..., n-1].
 *
 * @param {number} n
 * @return {Array<number>}
 */
export function range(n: number): number[] {
  const array = [];
  for (let i = 0; i < n; i++) {
    array.push(i);
  }
  return array;
}
