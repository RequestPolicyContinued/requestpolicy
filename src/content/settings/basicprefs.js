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
