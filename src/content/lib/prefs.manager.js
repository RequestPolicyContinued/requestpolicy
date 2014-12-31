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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

const MMID = "requestpolicy@requestpolicy.com";

let EXPORTED_SYMBOLS = [];

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules(["logger"], this);



let prefInitFunctions = {
  getGenericPref: function(branch, prefName) {
    switch (branch.getPrefType(prefName)) {
      case 32:
        // PREF_STRING
        return this.getUCharPref(prefName, branch);

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
  },

  setGenericPref: function(branch, prefName, prefValue) {
    switch (typeof prefValue) {
      case "string":
        this.setUCharPref(prefName, prefValue, branch);
        return;
      case "number":
        branch.setIntPref(prefName, prefValue);
        return;
      case "boolean":
        branch.setBoolPref(prefName, prefValue);
        return;
    }
  },

  setDefaultPref: function(prefName, prefValue) {
    var defaultBranch = Services.prefs.getDefaultBranch(null);
    this.setGenericPref(defaultBranch, prefName, prefValue);
  },

  getUCharPref: function(prefName, branch) {  // Unicode getCharPref
    branch = branch || Services.prefs;
    return branch.getComplexValue(prefName, Ci.nsISupportsString).data;
  },

  setUCharPref: function(prefName, text, branch) { // Unicode setCharPref
    var string = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
    string.data = text;
    branch = branch || Services.prefs;
    branch.setComplexValue(prefName, Ci.nsISupportsString, string);
  }
};

let defaultPrefScriptScope = {
  pref: prefInitFunctions.setDefaultPref,
  setGenericPref: prefInitFunctions.setGenericPref,
  setUCharPref: prefInitFunctions.setUCharPref
};


//
// Load default preferences (if necessary)
//

try {
  // this is necessary for restartless extensions:
  // ( See https://developer.mozilla.org/en-US/Add-ons/
  //   How_to_convert_an_overlay_extension_to_restartless
  //   #Step_4.3A_Manually_handle_default_preferences )
  Services.scriptloader.loadSubScript(
      "chrome://requestpolicy/content/lib/default-preferences.js",
      defaultPrefScriptScope);
} catch (e) {}


//
// Do what else to do on startup.
//

var rpPrefBranch = Services.prefs.getBranch("extensions.requestpolicy.")
    .QueryInterface(Ci.nsIPrefBranch2);
var rootPrefBranch = Services.prefs.getBranch("")
    .QueryInterface(Ci.nsIPrefBranch2);

// Disable link prefetch.
if (rpPrefBranch.getBoolPref("prefetch.link.disableOnStartup")) {
  if (rootPrefBranch.getBoolPref("network.prefetch-next")) {
    rootPrefBranch.setBoolPref("network.prefetch-next", false);
    Logger.info(Logger.TYPE_INTERNAL, "Disabled link prefetch.");
  }
}
// Disable DNS prefetch.
if (rpPrefBranch.getBoolPref("prefetch.dns.disableOnStartup")) {
  // network.dns.disablePrefetch only exists starting in Firefox 3.1 (and it
  // doesn't have a default value, at least in 3.1b2, but if and when it
  // does have a default it will be false).
  if (!rootPrefBranch.prefHasUserValue("network.dns.disablePrefetch") ||
      !rootPrefBranch.getBoolPref("network.dns.disablePrefetch")) {
    rootPrefBranch.setBoolPref("network.dns.disablePrefetch", true);
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
  if (rpPrefBranch.prefHasUserValue(deletePrefs[i])) {
    rpPrefBranch.clearUserPref(deletePrefs[i]);
  }
}
Services.prefs.savePrefFile(null);


function setPref(aPrefBranch, aPrefName, aDataType, aValue) {
  let functionName;
  switch (aDataType) {
    case Services.prefs.PREF_BOOL:
      functionName = "setBoolPref";
      break;
    case Services.prefs.PREF_INT:
      functionName = "setIntPref";
      break;
    case Services.prefs.PREF_STRING:
    default:
      functionName = "setCharPref";
      break;
  }
  aPrefBranch[functionName](aPrefName, aValue);
}

let globalMM = Cc["@mozilla.org/globalmessagemanager;1"]
    .getService(Ci.nsIMessageListenerManager);

globalMM.addMessageListener(MMID + ":setPref", function(message) {
    let {name, dataType, value} = message.data;
    setPref(rpPrefBranch, name, dataType, value);
  });
globalMM.addMessageListener(MMID + ":setRootPref", function(message) {
    let {name, dataType, value} = message.data;
    setPref(rootPrefBranch, name, dataType, value);
  });
