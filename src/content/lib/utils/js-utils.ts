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

interface IObject<T> { [key: string]: T; }

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

export interface IDeferred<T, RejectT> {
  promise: Promise<T>;
  promiseState: PromiseState;
  // FIXME: It's necessary to pass `undefined` if `T` is `void`.
  // depends on https://github.com/Microsoft/TypeScript/issues/4260
  reject: (arg: RejectT | Promise<RejectT>) => void;
  resolve: (arg: T | Promise<T>) => void;
}

/**
 * Defer some task.
 */
export function defer<T = void, RejectT = any>(): IDeferred<T, RejectT> {
  let promiseState: PromiseState = PromiseState.pending;
  let rejectFn: (value: RejectT) => void;
  let resolveFn: (value: T) => void;

  const promise = new Promise<T>((aResolveFn, aRejectFn) => {
    rejectFn = aRejectFn;
    resolveFn = aResolveFn;
  });

  function reject(value: RejectT) {
    promiseState = PromiseState.rejected;
    rejectFn(value);
  }
  function resolve(value: T) {
    promiseState = PromiseState.fulfilled;
    resolveFn(value);
  }

  return {
    promise,
    get promiseState() {
      return promiseState;
    },
    reject,
    resolve,
  };
}

export function createLazyGetter<V = any>(
    aKey: string,
    aValueFn: () => V,
): () => V {
  return function(this: any) {
    delete this[aKey];
    const value = aValueFn.call(this);
    Object.defineProperty(this, aKey, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
    return value;
  };
}

export function defineLazyGetter<V = any>(
    aOnObj: {[key: string]: any},
    aKey: string,
    aValueFn: () => V,
) {
  Object.defineProperty(aOnObj, aKey, {
    configurable: true,
    enumerable: true,
    get: createLazyGetter(aKey, aValueFn),
  });
}

export function isThenable<T>(aObj: T | Promise<T>): aObj is Promise<T> {
  if (!aObj) return false;
  if (typeof aObj !== "object") return false;
  return typeof (aObj as Promise<T>).then === "function";
}

export function leftRotateArray<T = any>(array: T[], n: number): T[] {
  n = n % array.length;
  const firstPart = array.slice(0, n);
  const secondPart = array.slice(n);
  return secondPart.concat(firstPart);
}

export function mapObjectKeys<T>(
    obj: {[key: string]: T},
    map: (key: string) => string,
): {[key: string]: T} {
  return objectEntries(obj).map(
      ([key, value]) => [map(key), value],
  ).reduce(objectify, {});
}

export function mapObjectValues<T, U>(
    obj: {[key: string]: T},
    map: (value: T) => U,
): {[key: string]: U} {
  return objectEntries(obj).map(
      ([key, value]: [string, T]) => [key, map(value)],
  ).reduce(objectify, {});
}

export function objectify<T>(obj: IObject<T>, [k, v]: [string, T]) {
  return { ...obj, [k]: v };
}

// Object.values() polyfill
export function objectEntries<T>(
    obj: IObject<T>,
): Array<[string, T]> {
  const keys = Object.keys(obj);
  let i = keys.length;
  const resArray = new Array(i);
  while (i--) resArray[i] = [keys[i], obj[keys[i]]];
  return resArray;
}

// Object.values() polyfill
export function objectValues<T>(obj: IObject<T>): T[] {
  const keys = Object.keys(obj);
  let i = keys.length;
  const resArray: T[] = new Array(i);
  while (i--) resArray[i] = obj[keys[i]];
  return resArray;
}

/**
 * Create an array containing the elements [0, ..., n-1].
 *
 * @param {number} n
 * @return {Array<number>}
 */
export function range(n: number): number[] {
  const array: number[] = [];
  for (let i = 0; i < n; i++) {
    array.push(i);
  }
  return array;
}
