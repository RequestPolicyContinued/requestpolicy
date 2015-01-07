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
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ['rpPrefBranch', 'rootPrefBranch', 'Prefs'];

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules(["lib/process-environment"], this);



let rpPrefBranch = Services.prefs.getBranch("extensions.requestpolicy.")
    .QueryInterface(Ci.nsIPrefBranch2);
let rootPrefBranch = Services.prefs.getBranch("")
    .QueryInterface(Ci.nsIPrefBranch2);



let Prefs = (function() {
  let self = {};

  let defaultAllow = true;
  let defaultAllowSameDomain = true;
  let blockingDisabled = false;



  self.save = function() {
    Services.prefs.savePrefFile(null);
  };



  /**
   * Define a list of preferences that will be available through
   * `Prefs.getter_function_name()` and `Prefs.setter_function_name()`.
   * Those functions will be created subsequently.
   */
  let cachedPrefList = {
    "defaultPolicy.allow": {
      getter: {name: "isDefaultAllow", fn: rpPrefBranch.getBoolPref}
    },
    "defaultPolicy.allowSameDomain": {
      getter: {name: "isDefaultAllowSameDomain", fn: rpPrefBranch.getBoolPref}
    },
    "startWithAllowAllEnabled": {
      getter: {name: "isBlockingDisabled", fn: rpPrefBranch.getBoolPref},
      setter: {name: "setBlockingDisabled", fn: rootPrefBranch.setBoolPref}
    }
  };
  let cachedPrefs = {};


  /**
   * Dynamically create functions like `isDefaultAllow` or
   * `setBlockingDisabled`. Also add `update()` functions to elements of
   * `cachedPrefList` that have a `getter`.
   */
  {
    for (let prefID in cachedPrefList) {
      let pref = cachedPrefList[prefID];

      if (pref.hasOwnProperty("getter")) {
        let getterName = pref.getter.name;

        // define the pref's getter function to `self`
        self[getterName] = function() {
          return cachedPrefs[getterName];
        };

        // define the pref's update() function to `cachedPrefList`
        pref.update = function() {
          cachedPrefs[prefID] = pref.getter.fn(prefID);
        };

        // initially call update()
        pref.update();
      }

      if (pref.hasOwnProperty("setter")) {
        let setterName = pref.setter.name;

        // define the pref's getter function to `self`
        self[setterName] = function(aValue) {
          // set the pref and save it
          pref.setter.fn(prefID, aValue);
          self.save();

          // update the cached value
          if (typeof pref.update !== 'undefined') {
            pref.update();
          }
        };
      }
    }
  }

  self.isPrefetchEnabled = function() {
    // network.dns.disablePrefetch only exists starting in Firefox 3.1
    try {
      return rootPrefBranch.getBoolPref("network.prefetch-next")
          || !rootPrefBranch.getBoolPref("network.dns.disablePrefetch");
    } catch (e) {
      return rootPrefBranch.getBoolPref("network.prefetch-next");
    }
  };

  function isPrefEmpty(pref) {
    try {
      let value = rpPrefBranch.getComplexValue(pref, Ci.nsISupportsString).data;
      return value == '';
    } catch (e) {
      return true;
    }
  }

  self.oldRulesExist = function() {
    return !(isPrefEmpty('allowedOrigins') &&
             isPrefEmpty('allowedDestinations') &&
             isPrefEmpty('allowedOriginsToDestinations'));
  };


  /**
   * This function updates all cached prefs.
   */
  function updateCachedPref(prefID) {
    // first check if this pref is cached
    if (!cachedPrefList.hasOwnProperty(prefID)) {
      return;
    }

    let pref = cachedPrefList[prefID];

    // check if this pref has an update() function
    if (typeof pref.update === 'function') {
      pref.update();
    }
  }

  let observePref = function(subject, topic, data) {
    if (topic == "nsPref:changed") {
      updateCachedPref(data);

      // Send an observer notification that a pref that affects RP has been
      // changed.
      // TODO: also send the pref's name and its branch
      Services.obs.notifyObservers(null, "requestpolicy-prefs-changed", null);
    }
  };

  ProcessEnvironment.enqueueStartupFunction(function() {
    ProcessEnvironment.obMan.observeRPPref({
      "": observePref
    });
    ProcessEnvironment.obMan.observeRootPref({
      "network.prefetch-next": observePref,
      "network.dns.disablePrefetch": observePref
    });
  });

  return self;
}());
