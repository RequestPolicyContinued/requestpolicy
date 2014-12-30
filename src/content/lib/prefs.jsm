/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ['rpPrefBranch', 'rootPrefBranch', 'Prefs'];

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
let {isMainProcess} = ScriptLoader.importModule("utils/process-info");

let prefManagerScope = {};


if (isMainProcess) {
  // if it's the main process (the chrome process). We will get here on startup.
  // initialize preferences:
  let uri = "chrome://requestpolicy/content/lib/pref-manager.js";
  Services.scriptloader.loadSubScript(uri, prefManagerScope);
}

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
   * @paramString{} prefName name of the preference that was updated.
   */
  function prefChanged(prefName) {
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
    Services.obs.notifyObservers(null, "requestpolicy-prefs-changed", null);
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

  let prefObserver = {
    observe: function(subject, topic, data) {
      if (topic == "nsPref:changed") {
        prefChanged(data);
      }
    }
  };

  rpPrefBranch.addObserver("", prefObserver, false);
  rootPrefBranch.addObserver("network.prefetch-next", prefObserver, false);
  rootPrefBranch.addObserver("network.dns.disablePrefetch", prefObserver, false);

  init();

  return self;
}());
