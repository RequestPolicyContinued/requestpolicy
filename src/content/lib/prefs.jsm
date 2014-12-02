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

let EXPORTED_SYMBOLS = ['prefs', 'prefsRoot', 'Prefs'];

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules(["logger"], this);


let DefaultPrefInit = (function() {
  function getGenericPref(branch, prefName) {
    switch (branch.getPrefType(prefName)) {
      case 32:
        // PREF_STRING
        return getUCharPref(prefName, branch);

      case 64:
        // PREF_INT
        return branch.getIntPref(prefName);

      case 128:
        // PREF_BOOL
        return branch.getBoolPref(prefName);

      case 0:
      default:
        // PREF_INVALID
        return undefined;
    }
  }

  function setGenericPref(branch, prefName, prefValue) {
    switch (typeof prefValue) {
      case "string":
        setUCharPref(prefName, prefValue, branch);
        return;
      case "number":
        branch.setIntPref(prefName, prefValue);
        return;
      case "boolean":
        branch.setBoolPref(prefName, prefValue);
        return;
    }
  }

  function setDefaultPref(prefName, prefValue) {
    var defaultBranch = Services.prefs.getDefaultBranch(null);
    setGenericPref(defaultBranch, prefName, prefValue);
  }

  function getUCharPref(prefName, branch) {  // Unicode getCharPref
    branch = branch || Services.prefs;
    return branch.getComplexValue(prefName, Ci.nsISupportsString).data;
  }

  function setUCharPref(prefName, text, branch) { // Unicode setCharPref
    var string = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
    string.data = text;
    branch = branch || Services.prefs;
    branch.setComplexValue(prefName, Ci.nsISupportsString, string);
  }

  let initialized = false;

  let self = {
    init: function() {
      if (!initialized) {
        initialized = true;
        try {
          // this is necessary for restartless extensions:
          // ( See https://developer.mozilla.org/en-US/Add-ons/
          //   How_to_convert_an_overlay_extension_to_restartless
          //   #Step_4.3A_Manually_handle_default_preferences )
          Services.scriptloader.loadSubScript(
              "chrome://requestpolicy/content/lib/default-preferences.js",
              {pref: setDefaultPref, setGenericPref: setGenericPref,
                  setUCharPref: setUCharPref});
        } catch (e) {
        }
      }
    }
  };
  return self;
}());


let Prefs = (function() {
  let self = {};


  let defaultAllow = true;
  let defaultAllowSameDomain = true;
  let blockingDisabled = false;


  function updateLoggingSettings() {
    Logger.enabled = self.prefs.getBoolPref("log");
    Logger.level = self.prefs.getIntPref("log.level");
    Logger.types = self.prefs.getIntPref("log.types");
  }

  /**
   * Take necessary actions when preferences are updated.
   *
   * @paramString{} prefName NAme of the preference that was updated.
   */
  function prefChanged(prefName) {
    switch (prefName) {
      case "log" :
      case "log.level" :
      case "log.types" :
        updateLoggingSettings();
        break;
      case "defaultPolicy.allow" :
        defaultAllow = self.prefs.getBoolPref("defaultPolicy.allow");
        break;
      case "defaultPolicy.allowSameDomain" :
        defaultAllowSameDomain = self.prefs.getBoolPref(
            "defaultPolicy.allowSameDomain");
        break;
      default :
        break;
    }
    Services.obs.notifyObservers(null, "requestpolicy-prefs-changed", null);
  }

  function syncFromPrefs() {
    // Load the logging preferences before the others.
    updateLoggingSettings();

    defaultAllow = self.prefs.getBoolPref("defaultPolicy.allow");
    defaultAllowSameDomain = self.prefs.getBoolPref("defaultPolicy.allowSameDomain");
    blockingDisabled = self.prefs.getBoolPref("startWithAllowAllEnabled");

    // Disable link prefetch.
    if (self.prefs.getBoolPref("prefetch.link.disableOnStartup")) {
      if (self.prefsRoot.getBoolPref("network.prefetch-next")) {
        self.prefsRoot.setBoolPref("network.prefetch-next", false);
        Logger.info(Logger.TYPE_INTERNAL, "Disabled link prefetch.");
      }
    }
    // Disable DNS prefetch.
    if (self.prefs.getBoolPref("prefetch.dns.disableOnStartup")) {
      // network.dns.disablePrefetch only exists starting in Firefox 3.1 (and it
      // doesn't have a default value, at least in 3.1b2, but if and when it
      // does have a default it will be false).
      if (!self.prefsRoot.prefHasUserValue("network.dns.disablePrefetch") ||
          !self.prefsRoot.getBoolPref("network.dns.disablePrefetch")) {
        self.prefsRoot.setBoolPref("network.dns.disablePrefetch", true);
        Logger.info(Logger.TYPE_INTERNAL, "Disabled DNS prefetch.");
      }
    }

    // Clean up old, unused prefs (removed in 0.2.0).
    let deletePrefs = [
      "temporarilyAllowedOrigins",
      "temporarilyAllowedDestinations",
      "temporarilyAllowedOriginsToDestinations"
    ];
    for (var i = 0; i < deletePrefs.length; i++) {
      if (self.prefs.prefHasUserValue(deletePrefs[i])) {
        self.prefs.clearUserPref(deletePrefs[i]);
      }
    }
    Services.prefs.savePrefFile(null);
  }

  let prefObserver = {
    observe: function(subject, topic, data) {
      switch (topic) {
        case "nsPref:changed":
          prefChanged(data);
          break;
        default:
          break;
      }
    }
  };

  function init() {
    // the DefaultPrefInit is needed in restartless addons. see:
    // https://developer.mozilla.org/en-US/Add-ons/
    // How_to_convert_an_overlay_extension_to_restartless
    // #Step_4.3A_Manually_handle_default_preferences
    DefaultPrefInit.init();

    self.prefs = Services.prefs.getBranch("extensions.requestpolicy.")
        .QueryInterface(Ci.nsIPrefBranch2);
    self.prefs.addObserver("", prefObserver, false);

    self.prefsRoot = Services.prefs.getBranch("")
        .QueryInterface(Ci.nsIPrefBranch2);
    self.prefsRoot.addObserver("network.prefetch-next", prefObserver, false);
    self.prefsRoot.addObserver("network.dns.disablePrefetch", prefObserver,
        false);

    syncFromPrefs();
  }

  self.prefs = null;
  self.prefsRoot = null;
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
    self.prefs.setBoolPref('startWithAllowAllEnabled', disabled);
    self.save();
  };
  self.isPrefetchEnabled = function() {
    // network.dns.disablePrefetch only exists starting in Firefox 3.1
    try {
      return self.prefsRoot.getBoolPref("network.prefetch-next")
          || !self.prefsRoot.getBoolPref("network.dns.disablePrefetch");
    } catch (e) {
      return self.prefsRoot.getBoolPref("network.prefetch-next");
    }
  };


  function isPrefEmpty(pref) {
    try {
      let value = self.prefs.getComplexValue(pref, Ci.nsISupportsString).data;
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


  init();

  return self;
}());
