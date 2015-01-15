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


  // not needed yet
  //function getInvertedRPBoolPref(aPrefName) {
  //  return !rpPrefBranch.getBoolPref(aPrefName);
  //}
  //function setInvertedRPBoolPref(aPrefName, aValue) {
  //  rpPrefBranch.setBoolPref(aPrefName, !aValue);
  //}

  /**
   * Define a list of pref aliases that will be available through
   * `Prefs.getter_function_name()` and `Prefs.setter_function_name()`.
   * Those functions will be added to `self` subsequently.
   */
  let prefAliases = {
    "defaultPolicy.allow": {
      getter: {name: "isDefaultAllow", fn: rpPrefBranch.getBoolPref}
    },
    "defaultPolicy.allowSameDomain": {
      getter: {name: "isDefaultAllowSameDomain", fn: rpPrefBranch.getBoolPref}
    },
    "startWithAllowAllEnabled": {
      getter: {name: "isBlockingDisabled", fn: rpPrefBranch.getBoolPref},
      setter: {name: "setBlockingDisabled", fn: rpPrefBranch.setBoolPref}
    }
  };

  /**
   * Dynamically create functions like `isDefaultAllow` or
   * `setBlockingDisabled`.
   */
  {
    for (let prefID in prefAliases) {
      let pref = prefAliases[prefID];

      if (pref.hasOwnProperty("getter")) {
        let getterName = pref.getter.name;
        let getPref = pref.getter.fn;

        // define the pref's getter function to `self`
        self[getterName] = function() {
          return getPref(prefID);
        };
      }

      if (pref.hasOwnProperty("setter")) {
        let setterName = pref.setter.name;
        let setPref = pref.setter.fn;

        // define the pref's getter function to `self`
        self[setterName] = function(aValue) {
          // set the pref and save it
          setPref(prefID, aValue);
          self.save();
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



  function observePref(subject, topic, data) {
    if (topic == "nsPref:changed") {
      // Send an observer notification that a pref that affects RP has been
      // changed.
      // TODO: also send the pref's name and its branch
      Services.obs.notifyObservers(null, "requestpolicy-prefs-changed", null);
    }
  };

  function registerPrefObserver() {
    // observe everything on RP's pref branch
    ProcessEnvironment.obMan.observeRPPref({"": observePref});

    // observe what is needed else
    ProcessEnvironment.obMan.observeRootPref({
      "network.prefetch-next": observePref,
      "network.dns.disablePrefetch": observePref
    });
  }
  ProcessEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        registerPrefObserver);

  return self;
}());
