/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

import {createListenersMap} from "lib/utils/listener-factories";

type ManagementEventName =
    "onDisabled" |
    "onEnabled" |
    "onInstalled" |
    "onUninstalled";
const MANAGEMENT_EVENT_NAMES: ManagementEventName[] = [
  "onDisabled",
  "onEnabled",
  "onInstalled",
  "onUninstalled",
];

type AddonFilter = (addon: browser.management.ExtensionInfo) => boolean;

export class FilteredManagement {
  private filter: AddonFilter;
  private evntLsnrsMap =
      createListenersMap(MANAGEMENT_EVENT_NAMES).listenersMap;

  public get onDisabled() { return this.evntLsnrsMap.onDisabled.interface; }
  public get onEnabled() { return this.evntLsnrsMap.onEnabled.interface; }
  public get onInstalled() { return this.evntLsnrsMap.onInstalled.interface; }
  public get onUninstalled() {
    return this.evntLsnrsMap.onUninstalled.interface;
  }

  constructor(filter: AddonFilter) {
    this.filter = filter;
    MANAGEMENT_EVENT_NAMES.forEach((eventName) => {
      browser.management[eventName].
          addListener(this.onManagementEvent.bind(this, eventName));
    });
  }

  public getAll() {
    return browser.management.getAll().
        then((addons) => addons.filter(this.filter));
  }

  private onManagementEvent(
      aEventName: ManagementEventName,
      aExtensionInfo: browser.management.ExtensionInfo,
  ) {
    if (!this.filter(aExtensionInfo)) return;
    this.evntLsnrsMap[aEventName].emit(aExtensionInfo);
  }
}
