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
    ManagerForPrefObservers,
    rp,
  } = browser.extension.getBackgroundPage();
  const {cachedSettings} = rp.storage;

  // ===========================================================================

  function updateDisplay() {
    var indicate = cachedSettings.get("indicateBlockedObjects");
    $id("pref-indicateBlockedObjects").checked = indicate;
    $id("indicateBlockedImages-details").hidden = !indicate;

    $id("pref-dontIndicateBlacklistedObjects").checked =
        !cachedSettings.get("indicateBlacklistedObjects");

    $id("pref-autoReload").checked =
        cachedSettings.get("autoReload");

    $id("pref-privateBrowsingPermanentWhitelisting").checked =
        cachedSettings.get("privateBrowsingPermanentWhitelisting");

    // if (cachedSettings.get("defaultPolicy.allow")) {
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
          cachedSettings.set({
            "indicateBlockedObjects": event.target.checked,
          });
          updateDisplay();
        }
    );

    elManager.addListener(
        $id("pref-dontIndicateBlacklistedObjects"), "change",
        function(event) {
          cachedSettings.set({
            "indicateBlacklistedObjects": !event.target.checked,
          });
          updateDisplay();
        }
    );

    elManager.addListener($id("pref-autoReload"), "change", function(event) {
      cachedSettings.set({"autoReload": event.target.checked});
      updateDisplay();
    });

    elManager.addListener(
        $id("pref-privateBrowsingPermanentWhitelisting"), "change",
        function(event) {
          cachedSettings.set({
            "privateBrowsingPermanentWhitelisting": event.target.checked,
          });
          updateDisplay();
        }
    );

    // call updateDisplay() every time a preference gets changed
    ManagerForPrefObservers.get(WinEnv).addListener("", updateDisplay);
  };
})();
