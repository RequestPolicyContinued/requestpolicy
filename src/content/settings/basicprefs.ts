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

import { BackgroundPage } from "main";
import {$id, elManager, WinEnv} from "./common";

(() => {
  const {
    log,
    ManagerForPrefObservers,
    rp,
  } = (browser.extension.getBackgroundPage() as any) as typeof BackgroundPage;
  const cachedSettings = rp.storage.cachedSettings!;

  // ===========================================================================

  function updateDisplay() {
    const indicate = cachedSettings.get("indicateBlockedObjects");
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

  function handleBlockedObjectsIndicationChange() {
    cachedSettings.set({
      indicateBlockedObjects: $id("pref-indicateBlockedObjects").checked,
    }).catch(log.onError("handleBlockedObjectsIndicationChange"));
    updateDisplay();
  }

  function handleBlacklistedObjectsIndicationChange() {
    cachedSettings.set({
      indicateBlacklistedObjects:
          !$id("pref-dontIndicateBlacklistedObjects").checked,
    }).catch(log.onError("handleBlacklistedObjectsIndicationChange"));
    updateDisplay();
  }

  function handleAutoReloadChange() {
    cachedSettings.set({
      autoReload: $id("pref-autoReload").checked,
    }).catch(log.onError("handleAutoReloadChange"));
    updateDisplay();
  }

  function handlePrivateBrowsingPermanentWhitelistingChange() {
    cachedSettings.set({
      privateBrowsingPermanentWhitelisting:
          $id("pref-privateBrowsingPermanentWhitelisting").checked,
    }).catch(log.onError("handlePrivateBrowsingPermanentWhitelistingChange"));
    updateDisplay();
  }

  window.onload = () => {
    updateDisplay();

    elManager.addListener(
        $id("pref-indicateBlockedObjects"), "change",
        handleBlockedObjectsIndicationChange,
    );
    elManager.addListener(
        $id("pref-dontIndicateBlacklistedObjects"), "change",
        handleBlacklistedObjectsIndicationChange,
    );
    elManager.addListener(
        $id("pref-autoReload"), "change",
        handleAutoReloadChange,
    );
    elManager.addListener(
        $id("pref-privateBrowsingPermanentWhitelisting"), "change",
        handlePrivateBrowsingPermanentWhitelistingChange,
    );

    // call updateDisplay() every time a preference gets changed
    ManagerForPrefObservers.get(WinEnv).addListener("", updateDisplay);
  };
})();
