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

// =============================================================================
// PrefManager
// =============================================================================

export const PrefManager = (function() {
  let self = {};

  self.init = function() {
    // ================================
    // prefetching
    // --------------------
    if (LegacyApi.prefs.get("prefetch.link.disableOnStartup") ||
        LegacyApi.prefs.get("prefetch.dns.disableOnStartup") ||
        LegacyApi.prefs.get("prefetch.preconnections.disableOnStartup")) {
      browser.privacy.network.networkPredictionEnabled.set({value: false});
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

  return self;
})();
