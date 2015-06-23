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

let EXPORTED_SYMBOLS = ["PrefManager"];

let globalScope = this;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/devtools/Console.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/utils/constants",
  "lib/environment"
], globalScope);

XPCOMUtils.defineLazyGetter(globalScope, "rpPrefBranch", function() {
  return Services.prefs.getBranch("extensions.requestpolicy.")
      .QueryInterface(Ci.nsIPrefBranch2);
});
XPCOMUtils.defineLazyGetter(globalScope, "rootPrefBranch", function() {
  return Services.prefs.getBranch("").QueryInterface(Ci.nsIPrefBranch2);
});





let PrefManager = (function() {
  let self = {};


  // TODO: move to bootstrap.js
  function handleUninstallOrDisable() {
    var resetLinkPrefetch = rpPrefBranch.getBoolPref(
        "prefetch.link.restoreDefaultOnUninstall");
    var resetDNSPrefetch = rpPrefBranch.getBoolPref(
        "prefetch.dns.restoreDefaultOnUninstall");

    if (resetLinkPrefetch) {
      if (rootPrefBranch.prefHasUserValue("network.prefetch-next")) {
        rootPrefBranch.clearUserPref("network.prefetch-next");
      }
    }
    if (resetDNSPrefetch) {
      if (rootPrefBranch.prefHasUserValue("network.dns.disablePrefetch")) {
        rootPrefBranch.clearUserPref("network.dns.disablePrefetch");
      }
    }
    Services.prefs.savePrefFile(null);
  }


  self.init = function() {
    // ================================
    // manually handle RP's default preferences
    // ----------------------------------------
    // The following script needs to be called because bootsrapped addons have
    // to handle their default preferences manually, see Mozilla Bug 564675:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=564675
    // The scope of that script doesn't need to be remembered.
    Services.scriptloader.loadSubScript(
        "chrome://rpcontinued/content/main/default-pref-handler.js",
        {});


    // ================================
    // Link/DNS prefetching
    // --------------------
    // Disable link prefetch.
    if (rpPrefBranch.getBoolPref("prefetch.link.disableOnStartup")) {
      if (rootPrefBranch.getBoolPref("network.prefetch-next")) {
        rootPrefBranch.setBoolPref("network.prefetch-next", false);
        console.info("Disabled link prefetch.");
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
        console.info("Disabled DNS prefetch.");
      }
    }


    // ================================
    // Clean up old, unused prefs (removed in 0.2.0).
    // ----------------------------------------------
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
  };


  function eventuallyHandleUninstallOrDisable(data, reason) {
    if (reason == C.ADDON_DISABLE || reason == C.ADDON_UNINSTALL) {
      // TODO: Handle uninstallation in bootstrap.js, not here, RP might be
      //       disabled when being uninstalled.
      handleUninstallOrDisable();
    }
  }
  ProcessEnvironment.addShutdownFunction(Environment.LEVELS.BACKEND,
                                         eventuallyHandleUninstallOrDisable);

  return self;
}());
