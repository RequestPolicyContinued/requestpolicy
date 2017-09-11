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

// =============================================================================
// Utils
// =============================================================================

export const Utils = (function() {
  let self = {};

  /**
   * Posts an action to the event queue of the current thread to run it
   * asynchronously. Any additional parameters to this function are passed
   * as parameters to the callback.
   *
   * @param {Function} callback
   * @param {Object} thisPtr
   */
  self.runAsync = function(callback, thisPtr) {
    let params = Array.prototype.slice.call(arguments, 2);
    let runnable = {
      run: function() {
        callback.apply(thisPtr, params);
      }
    };
    Services.tm.currentThread.dispatch(runnable,
        Ci.nsIEventTarget.DISPATCH_NORMAL);
  };

  /**
   * Calls a function multiple times until it succeeds. The
   * function must return TRUE on success.
   *
   * @param {function():boolean} aFunction
   * @param {number} aTries - The number of tries.
   */
  self.tryMultipleTimes = function(aFunction, aTries=10) {
    if (aTries <= 0) {
      return;
    }
    let triesLeft = aTries - 1;
    self.runAsync(function() {
      if (aFunction.call(null, triesLeft) !== true) {
        self.tryMultipleTimes(aFunction, triesLeft);
      }
    });
  };

  /**
   * Return a nested property or `undefined` if it does not exist.
   * Any element in the object chain may be undefined.
   *
   * Other implementations at http://stackoverflow.com/questions/2631001/javascript-test-for-existence-of-nested-object-key
   *
   * @param {Object} object
   * @param {...string} properties
   * @return {any}
   */
  self.getObjectPath = function(object, ...properties) {
    return properties.reduce(self.getObjectProperty, object);
  };

  /**
   * @private
   * @param {Object} object
   * @param {string} property
   * @return {any}
   */
  self.getObjectProperty = function(object, property) {
    if (!!object && object.hasOwnProperty(property)) {
      return object[property];
    }
    return undefined;
  };

  /**
   * Return a module's `internal` object, which is a singleton.
   * The `internal` can be accessed from all submodules of that module.
   *
   * @param {Object} aModuleScope
   * @return {Object} the module's `internal`
   */
  self.createModuleInternal = function(aModuleScope) {
    let internal = {};
    let sealed = false;
    aModuleScope.getInternal = function() {
      if (sealed) {
        return undefined;
      }
      return internal;
    };
    aModuleScope.sealInternal = function() {
      sealed = true;
    };
    return internal;
  };

  /**
   * Wrap a function. Allow 'before' and 'after' functions.
   * If the function was wrapped already earlier in time, the old
   * wrapper function will be re-used.
   *
   * @param {Object} aOwnerObject The object which contains (a reference to)
   *     the function which should be wrapped.
   * @param {string} aFunctionName The function's name in the object.
   * @param {Function=} aErrorCallback
   * @param {Function=} aBeforeFunction The function to be called before the
   *     original function.
   * @param {Function=} aAfterFunction The function to be called after the
   *     original function.
   */
  self.wrapFunction = function(aOwnerObject, aFunctionName, aErrorCallback,
                               aBeforeFunction = null, aAfterFunction = null) {
    initWrapperFunction(aOwnerObject, aFunctionName);

    const fnMetadata = aOwnerObject.rpcontinuedWrappedFunctions[aFunctionName];
    fnMetadata.before = aBeforeFunction;
    fnMetadata.after = aAfterFunction;
  };

  /**
   * Unwrap a function which has been wrapped before. The function won't
   * be removed though, because another addon could have wrapped the same
   * function as well. Instead, the 'before' and 'after' functions are
   * set to `null`.
   *
   * @param {Object} aOwnerObject The object which contains (a reference to)
   *     the function which should be wrapped.
   * @param {string} aFunctionName The function's name in the object.
   */
  self.unwrapFunction = function(aOwnerObject, aFunctionName) {
    self.wrapFunction(aOwnerObject, aFunctionName, null, null, null);
  };

  /**
   * @param {Object} aOwnerObject The object which contains (a reference to)
   *     the function which should be wrapped.
   * @param {string} aFunctionName The function's name in the object.
   * @param {Function} aErrorCallback
   */
  function initWrapperFunction(aOwnerObject, aFunctionName, aErrorCallback) {
    function onError(aError, aWhen) {
      if (typeof aErrorCallback === "function") {
        aErrorCallback(
            `The "${aWhen}" function of the \`${aFunctionName}()\` wrapper ` +
            `has thrown an error.`, aError);
      }
    }

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
      main: aOwnerObject[aFunctionName], // the original function
      before: null,
      after: null
    };

    // actually wrap the object
    aOwnerObject[aFunctionName] = function() {
      const {main, before, after} = metadata[aFunctionName];

      // Execute some action before the original function call.
      try {
        if (before) {
          before.apply(aOwnerObject, arguments);
        }
      } catch (e) {
        onError(e, "before");
      }

      // Execute original function.
      const rv = main.apply(aOwnerObject, arguments);

      // Execute some action afterwards.
      try {
        if (after) {
          after.apply(aOwnerObject, arguments);
        }
      } catch (e) {
        onError(e, "after");
      }

      // return the original result
      return rv;
    };
  }

  return self;
})();
