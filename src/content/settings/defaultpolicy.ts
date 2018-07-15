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
    const defaultallow = cachedSettings.get("defaultPolicy.allow");
    if (defaultallow) {
      $id("defaultallow").checked = true;
      $id("defaultdenysetting").hidden = true;
    } else {
      $id("defaultdeny").checked = true;
      $id("defaultdenysetting").hidden = false;
    }

    const allowsamedomain = cachedSettings.get("defaultPolicy.allowSameDomain");
    $id("allowsamedomain").checked = allowsamedomain;

    const allowTopLevel = cachedSettings.get("defaultPolicy.allowTopLevel");
    $id("allowtoplevel").checked = allowTopLevel;
  }

  function showManageSubscriptionsLink() {
    $id("subscriptionschanged").style.display = "block";
  }

  window.onload = () => {
    updateDisplay();

    elManager.addListener(
        $id("defaultallow"), "change",
        (event: any) => {
          const allow = event.target.checked;
          cachedSettings.set({
            "defaultPolicy.allow": allow,
          }).catch(log.onError(`set "defaultPolicy.allow"`));
          updateDisplay();
          showManageSubscriptionsLink();
        },
    );

    elManager.addListener(
        $id("defaultdeny"), "change",
        (event: any) => {
          const deny = event.target.checked;
          cachedSettings.set({
            "defaultPolicy.allow": !deny,
          }).catch(log.onError(`set "defaultPolicy.allow"`));
          updateDisplay();
          showManageSubscriptionsLink();
        },
    );

    elManager.addListener(
        $id("allowsamedomain"), "change",
        (event: any) => {
          const allowSameDomain = event.target.checked;
          cachedSettings.set({
            "defaultPolicy.allowSameDomain": allowSameDomain,
          }).catch(log.onError(`set allowSameDomain`));
        },
    );

    elManager.addListener(
        $id("allowtoplevel"), "change",
        (event: any) => {
          const allowTopLevel = event.target.checked;
          cachedSettings.set({
            "defaultPolicy.allowTopLevel": allowTopLevel,
          }).catch(log.onError(`set allowTopLevel`));
        },
    );

    // call updateDisplay() every time a preference gets changed
    ManagerForPrefObservers.get(WinEnv).addListener("", updateDisplay);
  };
})();
