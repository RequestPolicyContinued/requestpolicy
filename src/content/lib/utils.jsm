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

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
//Cu.import("resource://gre/modules/devtools/Console.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/prefs",
  "lib/utils/constants",
  "lib/environment"
], this);

if (ProcessEnvironment.isMainProcess) {
  Cu.import("resource://gre/modules/AddonManager.jsm");
}





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




  self.info = {};

  // bad smell...
  // get/set last/current RP version
  if (ProcessEnvironment.isMainProcess) {
    self.info.lastRPVersion = rpPrefBranch.getCharPref("lastVersion");

    self.info.curRPVersion = "0.0";
    // curRPVersion needs to be set asynchronously
    AddonManager.getAddonByID(C.EXTENSION_ID, function(addon) {
      rpPrefBranch.setCharPref("lastVersion", addon.version);
      self.info.curRPVersion = addon.version;
      if (self.info.lastRPVersion != self.info.curRPVersion) {
        Services.prefs.savePrefFile(null);
      }
    });
  }

  // bad smell...
  // get/set last/current app (e.g. firefox) version
  if (ProcessEnvironment.isMainProcess) {
    self.info.lastAppVersion = rpPrefBranch.getCharPref("lastAppVersion");

    let curAppVersion = Services.appinfo.version;
    self.info.curAppVersion = curAppVersion;
    rpPrefBranch.setCharPref("lastAppVersion", curAppVersion);

    if (self.info.lastAppVersion != self.info.curAppVersion) {
      Services.prefs.savePrefFile(null);
    }
  }

  let appID = Services.appinfo.ID;
  self.info.isFirefox = appID === C.FIREFOX_ID;
  self.info.isSeamonkey = appID === C.SEAMONKEY_ID;
  self.info.isAustralis = self.info.isFirefox &&
      Services.vc.compare(Services.appinfo.platformVersion, '29') >= 0;



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

  return self;
}());
