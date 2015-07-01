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

// This file has to be called only once. It handles the default preferences [1],
// so it has to be called quite early at the extension startup.
//
// Note that this script may *only* be loaded from the main process!
// Also note that if possible this script shouldn't import any other of RP's
// modules, e.g. to prevent import() loops.
//
// [1] https://developer.mozilla.org/en-US/Add-ons/How_to_convert_an_overlay_extension_to_restartless#Step_4.3A_Manually_handle_default_preferences

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");



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
      "chrome://rpcontinued/content/lib/default-preferences.js",
      defaultPrefScriptScope);
} catch (e) {}
