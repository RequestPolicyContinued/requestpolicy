/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

var EXPORTED_SYMBOLS = ["Util"];

const CI = Components.interfaces;
const CC = Components.classes;

Components.utils.import("resource://requestpolicy/Logger.jsm");

const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";

var Util = {
  _versionComparator : CC["@mozilla.org/xpcom/version-comparator;1"]
      .getService(CI.nsIVersionComparator),

  appInfo : CC["@mozilla.org/xre/app-info;1"].getService(CI.nsIXULAppInfo),

  // These need to be set externally. Right now they're set from
  // RequestPolicyService._initVersionInfo().
  curVersion : "0.0",
  lastVersion : "0.0",
  lastAppVersion : "0.0",

  // This is initialized by calling Util.initCurAppVersion().
  curAppVersion : "0.0",

  initCurAppVersion : function() {
    this.curAppVersion = this.appInfo.version;
  },

  compareVersions : function(v1, v2) {
    return this._versionComparator.compare(v1, v2);
  },

  isFirefox : function() {
    return this.appInfo.ID == FIREFOX_ID;
  },

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
  wrapFunction : function(aOwnerObject, aFunctionName, aBeforeFunction = null,
                          aAfterFunction = null) {
    initWrapperFunction(aOwnerObject, aFunctionName);

    var fnMetadata = aOwnerObject.rpcontinuedWrappedFunctions[aFunctionName];
    fnMetadata.before = aBeforeFunction;
    fnMetadata.after = aAfterFunction;
  },

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
  unwrapFunction : function(aOwnerObject, aFunctionName) {
    this.wrapFunction(aOwnerObject, aFunctionName, null, null);
  }
}

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
