/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2012 Justin Samuel
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

import {WinEnv, elManager, $id} from "./common";

(function() {
  var {
    LegacyApi,
    ManagerForPrefObservers,
    rp,
  } = browser.extension.getBackgroundPage();

  // ===========================================================================

  function updateDisplay() {
    // Link prefetch.
    $id("pref-linkPrefetch").checked =
        LegacyApi.prefs.get("root/ network.prefetch-next");

    $id("pref-prefetch.link.disableOnStartup").checked =
        rp.storage.get("prefetch.link.disableOnStartup");

    $id("pref-prefetch.link.restoreDefaultOnUninstall").checked =
        rp.storage.get("prefetch.link.restoreDefaultOnUninstall");

    // DNS prefetch.
    $id("pref-dnsPrefetch").checked =
        !LegacyApi.prefs.get("root/ network.dns.disablePrefetch");

    $id("pref-prefetch.dns.disableOnStartup").checked =
        rp.storage.get("prefetch.dns.disableOnStartup");

    $id("pref-prefetch.dns.restoreDefaultOnUninstall").checked =
        rp.storage.get("prefetch.dns.restoreDefaultOnUninstall");

    // Speculative pre-connections.
    $id("pref-speculativePreConnections").checked =
        LegacyApi.prefs.
            get("root/ network.http.speculative-parallel-limit") !== 0;

    $id("pref-prefetch.preconnections.disableOnStartup").checked =
        rp.storage.get("prefetch.preconnections.disableOnStartup");

    $id("pref-prefetch.preconnections.restoreDefaultOnUninstall").checked =
        rp.storage.get("prefetch.preconnections.restoreDefaultOnUninstall");

    // TODO: Create a class which acts as an API for preferences and which
    // ensures that the returned value is always a valid value for "string"
    // preferences.
    var sorting = rp.storage.get("menu.sorting");

    if (sorting === $id("sortByNumRequests").value) {
      $id("sortByNumRequests").checked = true;
      $id("sortByDestName").checked = false;
      $id("noSorting").checked = false;
    } else if (sorting === $id("noSorting").value) {
      $id("sortByNumRequests").checked = false;
      $id("sortByDestName").checked = false;
      $id("noSorting").checked = true;
    } else {
      $id("sortByNumRequests").checked = false;
      $id("sortByDestName").checked = true;
      $id("noSorting").checked = false;
    }

    $id("menu.info.showNumRequests").checked =
        rp.storage.get("menu.info.showNumRequests");
  }

  window.onload = function() {
    updateDisplay();

    // Link prefetch.
    elManager.addListener($id("pref-linkPrefetch"), "change", function(event) {
      LegacyApi.prefs.set("root/ network.prefetch-next", event.target.checked);
      LegacyApi.prefs.save();
    });

    elManager.addListener(
        $id("pref-prefetch.link.disableOnStartup"), "change",
        function(event) {
          rp.storage.set({
            "prefetch.link.disableOnStartup": event.target.checked,
          });
        }
    );

    elManager.addListener(
        $id("pref-prefetch.link.restoreDefaultOnUninstall"), "change",
        function(event) {
          rp.storage.set({
            "prefetch.link.restoreDefaultOnUninstall": event.target.checked,
          });
        }
    );

    // DNS prefetch.
    elManager.addListener($id("pref-dnsPrefetch"), "change", function(event) {
      LegacyApi.prefs.set(
          "root/ network.dns.disablePrefetch",
          !event.target.checked
      );
      LegacyApi.prefs.save();
    });

    elManager.addListener(
        $id("pref-prefetch.dns.disableOnStartup"), "change",
        function(event) {
          rp.storage.set({
            "prefetch.dns.disableOnStartup": event.target.checked,
          });
        }
    );

    elManager.addListener(
        $id("pref-prefetch.dns.restoreDefaultOnUninstall"), "change",
        function(event) {
          rp.storage.set({
            "prefetch.dns.restoreDefaultOnUninstall": event.target.checked,
          });
        }
    );

    // Speculative pre-connections.
    elManager.addListener(
        $id("pref-speculativePreConnections"), "change",
        function(event) {
          LegacyApi.prefs.set(
              "root/ network.http.speculative-parallel-limit",
              event.target.checked ? 6 : 0
          );
          LegacyApi.prefs.save();
        }
    );

    elManager.addListener(
        $id("pref-prefetch.preconnections.disableOnStartup"), "change",
        function(event) {
          rp.storage.set({
            "prefetch.preconnections.disableOnStartup": event.target.checked,
          });
        }
    );

    elManager.addListener(
        $id("pref-prefetch.preconnections.restoreDefaultOnUninstall"), "change",
        function(event) {
          rp.storage.set({
            "prefetch.preconnections.restoreDefaultOnUninstall":
                event.target.checked,
          });
        }
    );

    var sortingListener = function(event) {
      rp.storage.set({"menu.sorting": event.target.value});
    };
    elManager.addListener($id("sortByNumRequests"), "change", sortingListener);
    elManager.addListener($id("sortByDestName"), "change", sortingListener);
    elManager.addListener($id("noSorting"), "change", sortingListener);

    elManager.addListener(
        $id("menu.info.showNumRequests"), "change",
        function(event) {
          rp.storage.set({
            "menu.info.showNumRequests": event.target.checked,
          });
        }
    );

    // call updateDisplay() every time a preference gets changed
    ManagerForPrefObservers.get(WinEnv).addListeners([
      "",
      "root/ network.prefetch-next",
      "root/ network.dns.disablePrefetch",
      "root/ network.http.speculative-parallel-limit",
    ], updateDisplay);
  };
})();
