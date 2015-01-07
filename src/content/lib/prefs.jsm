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

  self.isDefaultAllow = function() {
    return defaultAllow;
  };
  self.isDefaultAllowSameDomain = function() {
    return defaultAllowSameDomain;
  };
  self.isBlockingDisabled = function() {
    return blockingDisabled;
  };
  self.setBlockingDisabled = function(disabled) {
    blockingDisabled = disabled;
    rootPrefBranch.setBoolPref('startWithAllowAllEnabled', disabled);
    self.save();
  };
  self.isPrefetchEnabled = function() {
    // network.dns.disablePrefetch only exists starting in Firefox 3.1
    try {
      return rootPrefBranch.getBoolPref("network.prefetch-next")
          || !rootPrefBranch.getBoolPref("network.dns.disablePrefetch");
    } catch (e) {
      return rootPrefBranch.getBoolPref("network.prefetch-next");
    }
  };


  /**
   * Take necessary actions when preferences are updated.
   *
   * @param {String} prefName name of the preference that was updated.
   */
  function updateCachedPref(prefName) {
    switch (prefName) {
      case "defaultPolicy.allow" :
        defaultAllow = rpPrefBranch.getBoolPref("defaultPolicy.allow");
        break;
      case "defaultPolicy.allowSameDomain" :
        defaultAllowSameDomain = rpPrefBranch.getBoolPref(
            "defaultPolicy.allowSameDomain");
        break;
      default:
        break;
    }
  }

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

  function init() {
    defaultAllow = rpPrefBranch.getBoolPref("defaultPolicy.allow");
    defaultAllowSameDomain = rpPrefBranch.getBoolPref("defaultPolicy.allowSameDomain");
    blockingDisabled = rpPrefBranch.getBoolPref("startWithAllowAllEnabled");
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

  init();

  ProcessEnvironment.enqueueStartupFunction(function() {
    ProcessEnvironment.obMan.observeRPPref({
      "": function() {
        observePref.apply(null, arguments);
      }
    });
    ProcessEnvironment.obMan.observeRootPref({
      "network.prefetch-next": observePref,
      "network.dns.disablePrefetch": observePref
    });
  });

  return self;
}());
