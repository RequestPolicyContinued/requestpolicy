/* global window, $, common, WinEnv, elManager, $id */

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {rpPrefBranch, rootPrefBranch} = importModule("lib/prefs");

  //============================================================================

  var PAGE_STRINGS = [
    "basic",
    "advanced",
    "advancedPreferences",
    "linkPrefetching",
    "dnsPrefetching",
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
        rootPrefBranch.getBoolPref("network.prefetch-next");

    $id("pref-prefetch.link.disableOnStartup").checked =
        rpPrefBranch.getBoolPref("prefetch.link.disableOnStartup");

    $id("pref-prefetch.link.restoreDefaultOnUninstall").checked =
        rpPrefBranch.getBoolPref("prefetch.link.restoreDefaultOnUninstall");

    // DNS prefetch.
    $id("pref-dnsPrefetch").checked =
        !rootPrefBranch.getBoolPref("network.dns.disablePrefetch");

    $id("pref-prefetch.dns.disableOnStartup").checked =
        rpPrefBranch.getBoolPref("prefetch.dns.disableOnStartup");

    $id("pref-prefetch.dns.restoreDefaultOnUninstall").checked =
        rpPrefBranch.getBoolPref("prefetch.dns.restoreDefaultOnUninstall");

    // TODO: Create a class which acts as an API for preferences and which ensures
    // that the returned value is always a valid value for "string" preferences.
    var sorting = rpPrefBranch.getCharPref("menu.sorting");

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
        rpPrefBranch.getBoolPref("menu.info.showNumRequests");
  }

  window.onload = function() {
    updateDisplay();

    // Link prefetch.
    elManager.addListener($id("pref-linkPrefetch"), "change", function(event) {
      rootPrefBranch.setBoolPref("network.prefetch-next", event.target.checked);
      Services.prefs.savePrefFile(null);
    });

    elManager.addListener(
        $id("pref-prefetch.link.disableOnStartup"), "change",
        function(event) {
          rpPrefBranch.setBoolPref("prefetch.link.disableOnStartup",
                                   event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    elManager.addListener(
        $id("pref-prefetch.link.restoreDefaultOnUninstall"), "change",
        function(event) {
          rpPrefBranch.setBoolPref("prefetch.link.restoreDefaultOnUninstall",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    // DNS prefetch.
    elManager.addListener($id("pref-dnsPrefetch"), "change", function(event) {
      rootPrefBranch.setBoolPref("network.dns.disablePrefetch",
          !event.target.checked);
      Services.prefs.savePrefFile(null);
    });

    elManager.addListener(
        $id("pref-prefetch.dns.disableOnStartup"), "change",
        function(event) {
          rpPrefBranch.setBoolPref("prefetch.dns.disableOnStartup",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    elManager.addListener(
        $id("pref-prefetch.dns.restoreDefaultOnUninstall"), "change",
        function(event) {
          rpPrefBranch.setBoolPref("prefetch.dns.restoreDefaultOnUninstall",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    var sortingListener = function(event) {
      rpPrefBranch.setCharPref("menu.sorting", event.target.value);
      Services.prefs.savePrefFile(null);
    };
    elManager.addListener($id("sortByNumRequests"), "change", sortingListener);
    elManager.addListener($id("sortByDestName"), "change", sortingListener);
    elManager.addListener($id("noSorting"), "change", sortingListener);

    elManager.addListener(
        $id("menu.info.showNumRequests"), "change",
        function(event) {
          rpPrefBranch.setBoolPref("menu.info.showNumRequests",
              event.target.checked);
          Services.prefs.savePrefFile(null);
        });

    // call updateDisplay() every time a preference gets changed
    WinEnv.obMan.observePrefChanges(updateDisplay);
  };

}());
