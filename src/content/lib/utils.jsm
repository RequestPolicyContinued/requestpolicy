/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["Utils"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
//Cu.import("resource://gre/modules/devtools/Console.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/environment",
  "lib/logger"
], this);





let Utils = (function() {
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
    //console.log("registering async execution. Caller is "+
    //            Components.stack.caller.filename);
    let params = Array.prototype.slice.call(arguments, 2);
    let runnable = {
      run: function() {
        callback.apply(thisPtr, params);
      }
    };
    self.threadManager.currentThread.dispatch(runnable,
        Ci.nsIEventTarget.DISPATCH_NORMAL);
  };
  XPCOMUtils.defineLazyServiceGetter(self, "categoryManager",
      "@mozilla.org/categorymanager;1", "nsICategoryManager");
  XPCOMUtils.defineLazyServiceGetter(self, "threadManager",
      "@mozilla.org/thread-manager;1", "nsIThreadManager");


  /**
   * Calls a function multiple times until it succeeds. The
   * function must return TRUE on success.
   *
   * @param {function():boolean} aFunction
   * @param {number} aTries - The number of tries.
   */
  self.tryMultipleTimes = function(aFunction, aTries=10) {
    if (aTries <= 0) {
      //console.log("no more tries!");
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
   */
  self.getObjectPath = function(object, ...properties) {
    return properties.reduce(self.getObjectProperty, object);
  };

  /**
   * @private
   */
  self.getObjectProperty = function(object, property) {
    if (!!object && object.hasOwnProperty(property)) {
      return object[property];
    }
    return undefined;
  };


  /**
   * This function returns and eventually creates a module's `internal`
   * variable. The `internal` can be accessed from all submodules of that
   * module (which might be in different files).
   *
   * The `internal` is added to `self`, and as soon as all modules have been
   * loaded, i.e. when the startup functions are called, the `internal` is
   * removed from `self` (the module is „sealed“).
   *
   *   This function can be used as follows:
   *   let MyModule = (function(self) {
   *     let internal = Utils.moduleInternal(self);
   *   }(MyModule || {}));
   *
   * @param {Object} aModuleScope
   * @returns {Object} the module's `internal`
   */
  self.moduleInternal = function(aModuleScope) {
    aModuleScope.internal = aModuleScope.internal || {};
    function sealInternal() {
      delete aModuleScope.internal;
    };
    ProcessEnvironment.addStartupFunction(Environment.LEVELS.ESSENTIAL,
                                          sealInternal);
    return aModuleScope.internal;
  };


  /**
   * Wrap a function. Allow 'before' and 'after' functions.
   * If the function was wrapped already earlier in time, the old
   * wrapper function will be re-used.
   *
   * @param {Object} aOwnerObject The object which contains (a reference to)
   *     the function which should be wrapped.
   * @param {string} aFunctionName The function's name in the object.
   * @param {Function=} aBeforeFunction The function to be called before the
   *     original function.
   * @param {Function=} aAfterFunction The function to be called after the
   *     original function.
   */
  self.wrapFunction = function(aOwnerObject, aFunctionName,
                               aBeforeFunction = null, aAfterFunction = null) {
    initWrapperFunction(aOwnerObject, aFunctionName);

    var fnMetadata = aOwnerObject.rpcontinuedWrappedFunctions[aFunctionName];
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
    self.wrapFunction(aOwnerObject, aFunctionName, null, null);
  };

  /**
   * @param {Object} aOwnerObject The object which contains (a reference to)
   *     the function which should be wrapped.
   * @param {string} aFunctionName The function's name in the object.
   */
  function initWrapperFunction(aOwnerObject, aFunctionName) {
    // create metadata object
    if (!aOwnerObject.hasOwnProperty("rpcontinuedWrappedFunctions")) {
      aOwnerObject.rpcontinuedWrappedFunctions = {};
    }

    var metadata = aOwnerObject.rpcontinuedWrappedFunctions;

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
      var {main, before, after} = metadata[aFunctionName];

      // Execute some action before the original function call.
      try {
        if (before) {
          before.apply(aOwnerObject, arguments);
        }
      } catch (e) {
        Logger.warning(Logger.TYPE_ERROR, "The 'before' function of the " +
                       "`" + aFunctionName + "()` wrapper has thrown an " +
                       "error.", e);
      }

      // Execute original function.
      var rv = main.apply(aOwnerObject, arguments);

      // Execute some action afterwards.
      try {
        if (after) {
          after.apply(aOwnerObject, arguments);
        }
      } catch (e) {
        Logger.warning(Logger.TYPE_ERROR, "The 'after' function of the " +
                       "`" + aFunctionName + "()` wrapper has thrown an " +
                       "error.", e);
      }

      // return the original result
      return rv;
    };
  }

  return self;
}());
