/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
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

import { App } from "app/interfaces";
import { log } from "app/log";
import { Common } from "common/interfaces";
import { C } from "data/constants";
import { FilteredManagement } from "lib/classes/filtered-management";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

// The other extension IDs of RequestPolicy.
const ADDON_IDS = Object.freeze(new Set([
  // Detect the "original" add-on (v0.5; released on AMO).
  "requestpolicy@requestpolicy.com",
  // Detect "RPC Legacy" (v0.5; AMO version).
  "rpcontinued@requestpolicy.org",
  C.AMO ? // In the AMO version the non-AMO version needs to be detected.
        "rpcontinued@non-amo.requestpolicy.org" :
        // In the non-AMO version the AMO version needs to be detected.
        "rpcontinued@amo.requestpolicy.org",
]));

function isRP(aAddon: browser.management.ExtensionInfo)  {
  return ADDON_IDS.has(aAddon.id);
}

export class OtherRPInstallations extends Module {
  private rpManagement = new FilteredManagement(isRP);

  constructor(
      parentLog: Common.ILog,
      private notifications: App.ui.INotifications,
  ) {
    super(`app.runtime.otherRPInstalls`, parentLog);
  }

  protected startupSelf() {
    const pDone = this.rpManagement.getAll().then((addons) => {
      const enabledAddons = addons.filter((addon) => addon.enabled);
      if (enabledAddons.length === 0) return;
      this.addNotification();
    }).catch((e) => {
      log.error("Error getting the list of addons! Details:", e);
    });
    const maybeAddNotification = this.maybeAddNotification.bind(this);
    browser.management.onEnabled.addListener(maybeAddNotification);
    browser.management.onInstalled.addListener(maybeAddNotification);
    return MaybePromise.resolve(pDone);
  }

  private addNotification() {
    this.notifications.notifications.add(
      this.notifications.IDs.MultipleRPInstallations,
    );
  }

  private maybeAddNotification(aAddon: browser.management.ExtensionInfo) {
    if (!isRP(aAddon)) return;
    this.addNotification();
  }
}
