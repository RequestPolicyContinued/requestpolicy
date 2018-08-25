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

import { JSMs, XPCOM } from "bootstrap/api/interfaces";

declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Services: JSMs.Services;

/**
 * Posts an action to the event queue of the current thread to run it
 * asynchronously. Any additional parameters to this function are passed
 * as parameters to the callback.
 */
export function runAsync<T>(
    this: T,
    callback: () => void | Promise<void>,
    thisPtr: T | null = null,
    ...params: any[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const runnable = {
      run() {
        try {
          resolve(callback.apply(thisPtr, params));
        } catch (e) {
          console.error("Asynchronous callback failed unexpectly. Details:");
          console.dir(e);
          reject(e);
        }
      },
    };
    Services.tm.currentThread.dispatch(
        runnable,
        Ci.nsIEventTarget.DISPATCH_NORMAL,
    );
  });
}

/**
 * Calls a function multiple times until it succeeds. The
 * function must return TRUE on success.
 *
 * @param {function():boolean} aFunction
 * @param {number} aTries - The number of tries.
 */
export function tryMultipleTimes(
    aFunction: (triesLeft: number) => boolean,
    aTries: number = 10,
): Promise<void> {
  if (aTries <= 0) {
    return Promise.reject();
  }
  const triesLeft = aTries - 1;
  return runAsync(() => {
    const rv = aFunction(triesLeft);
    if (rv !== true) {
      return tryMultipleTimes(aFunction, triesLeft);
    }
  });
}

/**
 * Return a module's `internal` object, which is a singleton.
 * The `internal` can be accessed from all submodules of that module.
 */
export function createModuleInternal(aModuleScope: any): any {
  /* eslint-disable no-param-reassign */
  const internal = {};
  let sealed = false;
  aModuleScope.getInternal = () => {
    if (sealed) {
      return undefined;
    }
    return internal;
  };
  aModuleScope.sealInternal = () => {
    sealed = true;
  };
  return internal;
}

/**
 * Wrap a function. Allow 'before' and 'after' functions.
 * If the function was wrapped already earlier in time, the old
 * wrapper function will be re-used.
 */
export function wrapFunction(
    aOwnerObject: any,
    aFunctionName: string,
    aErrorCallback: ((message: string, error: any) => void) | null,
    aBeforeFunction: ((message: string, error: any) => void) | null = null,
    aAfterFunction: ((message: string, error: any) => void) | null = null,
) {
  initWrapperFunction(aOwnerObject, aFunctionName, aErrorCallback);

  const fnMetadata = aOwnerObject.rpcontinuedWrappedFunctions[aFunctionName];
  fnMetadata.before = aBeforeFunction;
  fnMetadata.after = aAfterFunction;
}

/**
 * Unwrap a function which has been wrapped before. The function won't
 * be removed though, because another addon could have wrapped the same
 * function as well. Instead, the 'before' and 'after' functions are
 * set to `null`.
 */
export function unwrapFunction(aOwnerObject: any, aFunctionName: string) {
  wrapFunction(aOwnerObject, aFunctionName, null, null, null);
}

function initWrapperFunction(
    aOwnerObject: any,
    aFunctionName: string,
    aErrorCallback: ((message: string, error: any) => void) | null,
) {
  const onError = (aError: any, aWhen: any) => {
    if (typeof aErrorCallback === "function") {
      aErrorCallback(
          `The "${aWhen}" function of the \`${aFunctionName}()\` wrapper ` +
          `has thrown an error.`,
          aError,
      );
    }
  };

  // create metadata object
  if (!aOwnerObject.hasOwnProperty("rpcontinuedWrappedFunctions")) {
    aOwnerObject.rpcontinuedWrappedFunctions = {};
  }

  const metadata = aOwnerObject.rpcontinuedWrappedFunctions;

  if (metadata.hasOwnProperty(aFunctionName)) {
    // the function is already wrapped by RequestPolicy
    return;
  }

  // create metadata
  metadata[aFunctionName] = {
    after: null,
    before: null,
    main: aOwnerObject[aFunctionName], // the original function
  };

  // actually wrap the object
  aOwnerObject[aFunctionName] = (...args: any[]) => {
    const {main, before, after} = metadata[aFunctionName];

    // Execute some action before the original function call.
    try {
      if (before) {
        before.apply(aOwnerObject, args);
      }
    } catch (e) {
      onError(e, "before");
    }

    // Execute original function.
    const rv = main.apply(aOwnerObject, args);

    // Execute some action afterwards.
    try {
      if (after) {
        after.apply(aOwnerObject, args);
      }
    } catch (e) {
      onError(e, "after");
    }

    // return the original result
    return rv;
  };
}
