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

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules(["lib/environment"], this);



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


  function getRPBoolPref(aPrefName) {
    return rpPrefBranch.getBoolPref(aPrefName);
  }
  function setRPBoolPref(aPrefName, aValue) {
    rpPrefBranch.setBoolPref(aPrefName, aValue);
  }
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
  let rpPrefAliases = {
    "bool": {
      "defaultPolicy.allow": "DefaultAllow",
      "defaultPolicy.allowSameDomain": "DefaultAllowSameDomain",

      // As an example, this will become `isBlockingDisabled()` and
      // `setBlockingDisabled()`:
      "startWithAllowAllEnabled": "BlockingDisabled"
    }
  };

  /**
   * Dynamically create functions like `isDefaultAllow` or
   * `setBlockingDisabled`.
   */
  {
    for (let prefID in rpPrefAliases.bool) {
      let prefName = rpPrefAliases.bool[prefID];

      // define the pref's getter function to `self`
      self["is"+prefName] = getRPBoolPref.bind(this, prefID);

      // define the pref's getter function to `self`
      self["set"+prefName] = setRPBoolPref.bind(this, prefID);
    }
  }

  self.isPrefetchEnabled = function() {
    return rootPrefBranch.getBoolPref("network.prefetch-next")
        || !rootPrefBranch.getBoolPref("network.dns.disablePrefetch");
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
    ProcessEnvironment.obMan.observeRPPref([""], observePref);

    // observe what is needed else
    ProcessEnvironment.obMan.observeRootPref([
      "network.prefetch-next",
      "network.dns.disablePrefetch"
    ], observePref);
  }
  ProcessEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        registerPrefObserver);

  return self;
}());
