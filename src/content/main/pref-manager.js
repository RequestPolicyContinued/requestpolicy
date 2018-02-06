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

import {Level as EnvLevel, MainEnvironment} from "content/lib/environment";
import {Storage} from "content/models/storage";
import {Log} from "content/models/log";

const log = Log.instance;

// =============================================================================
// PrefManager
// =============================================================================

export const PrefManager = (function() {
  let self = {};

  // TODO: move to bootstrap.js
  function handleUninstallOrDisable() {
    const resetLinkPrefetch =
        Storage.get("prefetch.link.restoreDefaultOnUninstall");
    const resetDNSPrefetch =
        Storage.get("prefetch.dns.restoreDefaultOnUninstall");
    const resetPreConnections =
        Storage.get("prefetch.preconnections.restoreDefaultOnUninstall");

    if (resetLinkPrefetch) {
      if (LegacyApi.prefs.isSet("root/ network.prefetch-next")) {
        LegacyApi.prefs.reset("root/ network.prefetch-next");
      }
    }
    if (resetDNSPrefetch) {
      if (LegacyApi.prefs.isSet("root/ network.dns.disablePrefetch")) {
        LegacyApi.prefs.reset("root/ network.dns.disablePrefetch");
      }
      if (LegacyApi.prefs.isSet("root/ network.dns.disablePrefetchFromHTTPS")) {
        LegacyApi.prefs.reset("root/ network.dns.disablePrefetchFromHTTPS");
      }
    }
    if (resetPreConnections) {
      let prefName = "root/ network.http.speculative-parallel-limit";
      if (LegacyApi.prefs.isSet(prefName)) {
        LegacyApi.prefs.reset(prefName);
      }
    }
    LegacyApi.prefs.save();
  }

  self.init = function() {
    // ================================
    // prefetching
    // --------------------
    // Disable link prefetch.
    if (LegacyApi.prefs.get("prefetch.link.disableOnStartup")) {
      if (LegacyApi.prefs.get("root/ network.prefetch-next") === true) {
        LegacyApi.prefs.set("root/ network.prefetch-next", false);
        log.info("Disabled link prefetch.");
      }
    }
    // Disable DNS prefetch.
    if (LegacyApi.prefs.get("prefetch.dns.disableOnStartup")) {
      // network.dns.disablePrefetch only exists starting in Firefox 3.1 (and it
      // doesn't have a default value, at least in 3.1b2, but if and when it
      // does have a default it will be false).
      let prefName = "root/ network.dns.disablePrefetch";
      if (!LegacyApi.prefs.isSet(prefName) ||
          LegacyApi.prefs.get(prefName) === false) {
        LegacyApi.prefs.set(prefName, true);
        log.info("Disabled DNS prefetch.");
      }

      prefName = "root/ network.dns.disablePrefetchFromHTTPS";
      // If no user-defined value exists, the default is "true".  So do not
      // set the pref if there's no user-defined value yet.
      if (LegacyApi.prefs.isSet(prefName) &&
          LegacyApi.prefs.get(prefName) === false) {
        LegacyApi.prefs.set(prefName, true);
        log.info("Disabled DNS prefetch from HTTPS.");
      }
    }
    // Disable Speculative pre-connections.
    if (Storage.get("prefetch.preconnections.disableOnStartup")) {
      let prefName = "root/ network.http.speculative-parallel-limit";
      if (!LegacyApi.prefs.isSet(prefName) ||
          LegacyApi.prefs.get(prefName) !== 0) {
        LegacyApi.prefs.set(prefName, 0);
        log.info("Disabled Speculative pre-connections.");
      }
    }

    // ================================
    // Clean up old, unused prefs (removed in 0.2.0).
    // ----------------------------------------------
    let deletePrefs = [
      "temporarilyAllowedOrigins",
      "temporarilyAllowedDestinations",
      "temporarilyAllowedOriginsToDestinations",
    ];
    for (let prefName of deletePrefs) {
      if (LegacyApi.prefs.isSet(prefName)) {
        LegacyApi.prefs.reset(prefName);
      }
    }

    LegacyApi.prefs.save();
  };

  function maybeHandleUninstallOrDisable(data, reason) {
    if (reason === "ADDON_DISABLE" || reason === "ADDON_UNINSTALL") {
      // TODO: Handle uninstallation in bootstrap.js, not here, RP might be
      //       disabled when being uninstalled.
      handleUninstallOrDisable();
    }
  }
  MainEnvironment.addShutdownFunction(EnvLevel.BACKEND,
                                      maybeHandleUninstallOrDisable);

  return self;
})();
