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

/* global window, $, common, WinEnv, elManager, $id */

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {Prefs} = importModule("models/prefs");

  //============================================================================

  var PAGE_STRINGS = [
    "basic",
    "advanced",
    "advancedPreferences",
    "linkPrefetching",
    "dnsPrefetching",
    "speculativePreConnections",
    "enabled",
    "disableOnStartup",
    "restoreDefaultOnUninstall",
    "menuPreferences",
    "menuSorting",
    "sortByNumRequests",
    "sortByDestName",
    "noSorting",
    "hint",
    "menuSortingHint",
    "menuIndicatedInformation",
    "menuIndicateNumRequests"
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  function updateDisplay() {
    // Link prefetch.
    $id("pref-linkPrefetch").checked =
        Prefs.get("root/ network.prefetch-next");

    $id("pref-prefetch.link.disableOnStartup").checked =
        Prefs.get("prefetch.link.disableOnStartup");

    $id("pref-prefetch.link.restoreDefaultOnUninstall").checked =
        Prefs.get("prefetch.link.restoreDefaultOnUninstall");

    // DNS prefetch.
    $id("pref-dnsPrefetch").checked =
        !Prefs.get("root/ network.dns.disablePrefetch");

    $id("pref-prefetch.dns.disableOnStartup").checked =
        Prefs.get("prefetch.dns.disableOnStartup");

    $id("pref-prefetch.dns.restoreDefaultOnUninstall").checked =
        Prefs.get("prefetch.dns.restoreDefaultOnUninstall");

    // Speculative pre-connections.
    $id("pref-speculativePreConnections").checked =
        Prefs.get("root/ network.http.speculative-parallel-limit") !== 0;

    $id("pref-prefetch.preconnections.disableOnStartup").checked =
        Prefs.get("prefetch.preconnections.disableOnStartup");

    $id("pref-prefetch.preconnections.restoreDefaultOnUninstall").checked =
        Prefs.get("prefetch.preconnections.restoreDefaultOnUninstall");

    // TODO: Create a class which acts as an API for preferences and which ensures
    // that the returned value is always a valid value for "string" preferences.
    var sorting = Prefs.get("menu.sorting");

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
        Prefs.get("menu.info.showNumRequests");
  }

  window.onload = function() {
    updateDisplay();

    // Link prefetch.
    elManager.addListener($id("pref-linkPrefetch"), "change", function(event) {
      Prefs.set("root/ network.prefetch-next", event.target.checked);
      Services.prefs.savePrefFile(null);
    });

    elManager.addListener(
        $id("pref-prefetch.link.disableOnStartup"), "change",
        function(event) {
          Prefs.set("prefetch.link.disableOnStartup",
                                   event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    elManager.addListener(
        $id("pref-prefetch.link.restoreDefaultOnUninstall"), "change",
        function(event) {
          Prefs.set("prefetch.link.restoreDefaultOnUninstall",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    // DNS prefetch.
    elManager.addListener($id("pref-dnsPrefetch"), "change", function(event) {
      Prefs.set("root/ network.dns.disablePrefetch",
          !event.target.checked);
      Services.prefs.savePrefFile(null);
    });

    elManager.addListener(
        $id("pref-prefetch.dns.disableOnStartup"), "change",
        function(event) {
          Prefs.set("prefetch.dns.disableOnStartup",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    elManager.addListener(
        $id("pref-prefetch.dns.restoreDefaultOnUninstall"), "change",
        function(event) {
          Prefs.set("prefetch.dns.restoreDefaultOnUninstall",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    // Speculative pre-connections.
    elManager.addListener($id("pref-speculativePreConnections"), "change",
        function(event) {
      Prefs.set("root/ network.http.speculative-parallel-limit",
          event.target.checked ? 6 : 0);
      Services.prefs.savePrefFile(null);
    });

    elManager.addListener(
        $id("pref-prefetch.preconnections.disableOnStartup"), "change",
        function(event) {
          Prefs.set("prefetch.preconnections.disableOnStartup",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    elManager.addListener(
        $id("pref-prefetch.preconnections.restoreDefaultOnUninstall"), "change",
        function(event) {
          Prefs.set("prefetch.preconnections.restoreDefaultOnUninstall",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    var sortingListener = function(event) {
      Prefs.set("menu.sorting", event.target.value);
      Services.prefs.savePrefFile(null);
    };
    elManager.addListener($id("sortByNumRequests"), "change", sortingListener);
    elManager.addListener($id("sortByDestName"), "change", sortingListener);
    elManager.addListener($id("noSorting"), "change", sortingListener);

    elManager.addListener(
        $id("menu.info.showNumRequests"), "change",
        function(event) {
          Prefs.set("menu.info.showNumRequests",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    // call updateDisplay() every time a preference gets changed
    WinEnv.prefObs.addListeners([
      "",
      "root/ network.prefetch-next",
      "root/ network.dns.disablePrefetch",
      "root/ network.http.speculative-parallel-limit",
    ], updateDisplay);
  };

}());
