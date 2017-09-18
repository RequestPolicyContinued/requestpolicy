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

import {common, WinEnv, elManager, $id} from "./common";

(function() {
  var {
    ManagerForPrefObservers,
    Storage,
  } = browser.extension.getBackgroundPage();

  // ===========================================================================

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
    "manageSubscriptions",
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  function updateDisplay() {
    var defaultallow = Storage.get("defaultPolicy.allow");
    if (defaultallow) {
      $id("defaultallow").checked = true;
      $id("defaultdenysetting").hidden = true;
    } else {
      $id("defaultdeny").checked = true;
      $id("defaultdenysetting").hidden = false;
    }

    var allowsamedomain = Storage.get("defaultPolicy.allowSameDomain");
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
          Storage.set({"defaultPolicy.allow": allow});
          updateDisplay();
          showManageSubscriptionsLink();
        });

    elManager.addListener(
        $id("defaultdeny"), "change",
        function(event) {
          var deny = event.target.checked;
          Storage.set({"defaultPolicy.allow": !deny});
          updateDisplay();
          showManageSubscriptionsLink();
        });

    elManager.addListener(
        $id("allowsamedomain"), "change",
        function(event) {
          var allowSameDomain = event.target.checked;
          Storage.set({
            "defaultPolicy.allowSameDomain": allowSameDomain,
          });
        });

    // call updateDisplay() every time a preference gets changed
    ManagerForPrefObservers.get(WinEnv).addListener("", updateDisplay);
  };
})();
