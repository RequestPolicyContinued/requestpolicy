/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

"use strict";

/* global Components */
const {utils: Cu} = Components;

/* exported PrefManager */
/* exported EXPORTED_SYMBOLS */
var EXPORTED_SYMBOLS = ["PrefManager"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {RPService2: {console}} = importModule("main/rp-service-2");
let {C} = importModule("lib/utils/constants");
let {Environment, ProcessEnvironment} = importModule("lib/environment");

// Import when the default prefs have been set.
let Prefs;

//==============================================================================
// PrefManager
//==============================================================================

var PrefManager = (function() {
  let self = {};

  // TODO: move to bootstrap.js
  function handleUninstallOrDisable() {
    var resetLinkPrefetch = Prefs.get("prefetch.link." +
                                      "restoreDefaultOnUninstall");
    var resetDNSPrefetch = Prefs.get("prefetch.dns.restoreDefaultOnUninstall");
    var resetPreConnections = Prefs.get("prefetch.preconnections." +
                                        "restoreDefaultOnUninstall");

    if (resetLinkPrefetch) {
      if (Prefs.isSet("root/ network.prefetch-next")) {
        Prefs.reset("root/ network.prefetch-next");
      }
    }
    if (resetDNSPrefetch) {
      if (Prefs.isSet("root/ network.dns.disablePrefetch")) {
        Prefs.reset("root/ network.dns.disablePrefetch");
      }
      if (Prefs.isSet("root/ network.dns.disablePrefetchFromHTTPS")) {
        Prefs.reset("root/ network.dns.disablePrefetchFromHTTPS");
      }
    }
    if (resetPreConnections) {
      if (Prefs.isSet("root/ network.http.speculative-parallel-limit")) {
        Prefs.reset("root/ network.http.speculative-parallel-limit");
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
    // Import `Prefs`
    // --------------
    /* jshint -W126 */ // JSHint issue #2775
    ({Prefs} = importModule("models/prefs"));
    /* jshint +W126 */

    // ================================
    // prefetching
    // --------------------
    // Disable link prefetch.
    if (Prefs.get("prefetch.link.disableOnStartup")) {
      if (Prefs.get("root/ network.prefetch-next") === true) {
        Prefs.set("root/ network.prefetch-next", false);
        console.info("Disabled link prefetch.");
      }
    }
    // Disable DNS prefetch.
    if (Prefs.get("prefetch.dns.disableOnStartup")) {
      // network.dns.disablePrefetch only exists starting in Firefox 3.1 (and it
      // doesn't have a default value, at least in 3.1b2, but if and when it
      // does have a default it will be false).
      if (!Prefs.isSet("root/ network.dns.disablePrefetch") ||
          Prefs.get("root/ network.dns.disablePrefetch") === false) {
        Prefs.set("root/ network.dns.disablePrefetch", true);
        console.info("Disabled DNS prefetch.");
      }
      // If no user-defined value exists, the default is "true".  So do not
      // set the pref if there's no user-defined value yet.
      if (Prefs.isSet("root/ network.dns.disablePrefetchFromHTTPS") &&
          Prefs.get("root/ network.dns.disablePrefetchFromHTTPS") === false) {
        Prefs.set("root/ network.dns.disablePrefetchFromHTTPS", true);
        console.info("Disabled DNS prefetch from HTTPS.");
      }
    }
    // Disable Speculative pre-connections.
    if (Prefs.get("prefetch.preconnections.disableOnStartup")) {
      if (!Prefs.isSet("root/ network.http.speculative-parallel-limit") ||
          Prefs.get("root/ network.http.speculative-parallel-limit") !== 0) {
        Prefs.set("root/ network.http.speculative-parallel-limit", 0);
        console.info("Disabled Speculative pre-connections.");
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
    for (let prefName of deletePrefs) {
      if (Prefs.isSet(prefName)) {
        Prefs.reset(prefName);
      }
    }

    Services.prefs.savePrefFile(null);
  };

  function maybeHandleUninstallOrDisable(data, reason) {
    if (reason === C.ADDON_DISABLE || reason === C.ADDON_UNINSTALL) {
      // TODO: Handle uninstallation in bootstrap.js, not here, RP might be
      //       disabled when being uninstalled.
      handleUninstallOrDisable();
    }
  }
  ProcessEnvironment.addShutdownFunction(Environment.LEVELS.BACKEND,
                                         maybeHandleUninstallOrDisable);

  return self;
}());
