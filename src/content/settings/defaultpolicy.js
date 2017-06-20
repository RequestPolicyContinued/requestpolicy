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

"use strict";

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
    "yourPolicy",
    "defaultPolicy",
    "subscriptions",
    "allowRequestsByDefault",
    "blockRequestsByDefault",
    "defaultPolicyDefinition",
    "learnMore",
    "allowRequestsToTheSameDomain",
    "differentSubscriptionsAreAvailable",
    "manageSubscriptions"
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  function updateDisplay() {
    var defaultallow = Prefs.get("defaultPolicy.allow");
    if (defaultallow) {
      $id("defaultallow").checked = true;
      $id("defaultdenysetting").hidden = true;
    } else {
      $id("defaultdeny").checked = true;
      $id("defaultdenysetting").hidden = false;
    }

    var allowsamedomain = Prefs.get("defaultPolicy.allowSameDomain");
    $id("allowsamedomain").checked = allowsamedomain;
  }

  function showManageSubscriptionsLink() {
    $id("subscriptionschanged").style.display = "block";
  }

  window.onload = function() {
    updateDisplay();

    elManager.addListener(
        $id("defaultallow"), "change",
        function(event) {
          var allow = event.target.checked;
          Prefs.set("defaultPolicy.allow", allow);
          Services.prefs.savePrefFile(null);
          updateDisplay();
          showManageSubscriptionsLink();
        });

    elManager.addListener(
        $id("defaultdeny"), "change",
        function(event) {
          var deny = event.target.checked;
          Prefs.set("defaultPolicy.allow", !deny);
          Services.prefs.savePrefFile(null);
          updateDisplay();
          showManageSubscriptionsLink();
        });

    elManager.addListener(
        $id("allowsamedomain"), "change",
        function(event) {
          var allowSameDomain = event.target.checked;
          Prefs.set("defaultPolicy.allowSameDomain",
              allowSameDomain);
          Services.prefs.savePrefFile(null);
        });

    // call updateDisplay() every time a preference gets changed
    WinEnv.prefObs.addListener("", updateDisplay);
  };

}());
