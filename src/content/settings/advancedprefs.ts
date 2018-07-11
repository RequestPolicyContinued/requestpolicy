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
    ManagerForPrefObservers,
    rp,
  } = (browser.extension.getBackgroundPage() as any) as typeof BackgroundPage;
  const cachedSettings = rp.storage.cachedSettings!;

  // ===========================================================================

  function updateDisplay() {
    // browser settings
    $id("pref-browserSettings.disableNetworkPrediction").checked =
        cachedSettings.get("browserSettings.disableNetworkPrediction");

    // TODO: Create a class which acts as an API for preferences and which
    // ensures that the returned value is always a valid value for "string"
    // preferences.
    const sorting = cachedSettings.get("menu.sorting");

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
        cachedSettings.get("menu.info.showNumRequests");
  }

  window.onload = () => {
    updateDisplay();

    // prefetching
    elManager.addListener(
        $id("pref-browserSettings.disableNetworkPrediction"),
        "change",
        (event: any) => {
          cachedSettings.set({
            "browserSettings.disableNetworkPrediction": event.target.checked,
          });
        },
    );

    const sortingListener = (event: any) => {
      cachedSettings.set({"menu.sorting": event.target.value});
    };
    elManager.addListener($id("sortByNumRequests"), "change", sortingListener);
    elManager.addListener($id("sortByDestName"), "change", sortingListener);
    elManager.addListener($id("noSorting"), "change", sortingListener);

    elManager.addListener(
        $id("menu.info.showNumRequests"), "change",
        (event: any) => {
          cachedSettings.set({
            "menu.info.showNumRequests": event.target.checked,
          });
        },
    );

    // call updateDisplay() every time a preference gets changed
    ManagerForPrefObservers.get(WinEnv).addListeners([
      "",
    ], updateDisplay);
  };
})();
