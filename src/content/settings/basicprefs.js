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
    "webPages",
    "indicateBlockedImages",
    "dontIndicateBlacklisted",
    "autoReload",
    "menu",
    "allowAddingNonTemporaryRulesInPBM"
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  function updateDisplay() {
    var indicate = Prefs.get("indicateBlockedObjects");
    $id("pref-indicateBlockedObjects").checked = indicate;
    $id("indicateBlockedImages-details").hidden = !indicate;

    $id("pref-dontIndicateBlacklistedObjects").checked =
        !Prefs.get("indicateBlacklistedObjects");

    $id("pref-autoReload").checked =
        Prefs.get("autoReload");

    $id("pref-privateBrowsingPermanentWhitelisting").checked =
        Prefs.get("privateBrowsingPermanentWhitelisting");

    // if (Prefs.get("defaultPolicy.allow")) {
    //   var word = "allow";
    // } else {
    //   var word = "block";
    // }
    // $id("defaultpolicyword").innerHTML = word;
  }

  window.onload = function() {
    updateDisplay();

    elManager.addListener(
        $id("pref-indicateBlockedObjects"), "change",
        function(event) {
          Prefs.set("indicateBlockedObjects",
              event.target.checked);
          Services.prefs.savePrefFile(null);
          updateDisplay();
        });

    elManager.addListener(
        $id("pref-dontIndicateBlacklistedObjects"), "change",
        function(event) {
          Prefs.set("indicateBlacklistedObjects",
                                   !event.target.checked);
          Services.prefs.savePrefFile(null);
          updateDisplay();
        });

    elManager.addListener($id("pref-autoReload"), "change", function(event) {
      Prefs.set("autoReload", event.target.checked);
      Services.prefs.savePrefFile(null);
      updateDisplay();
    });

    elManager.addListener(
        $id("pref-privateBrowsingPermanentWhitelisting"), "change",
        function(event) {
          Prefs.set("privateBrowsingPermanentWhitelisting",
                                   event.target.checked);
          Services.prefs.savePrefFile(null);
          updateDisplay();
        });

    // call updateDisplay() every time a preference gets changed
    WinEnv.prefObs.addListener("", updateDisplay);
  };

}());
