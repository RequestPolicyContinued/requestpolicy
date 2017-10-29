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

import {Event} from "./event";

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
  private events = Event.createMultiple(MANAGEMENT_EVENT_NAMES).events;

  public get onDisabled() { return this.events.onDisabled.eventTarget; }
  public get onEnabled() { return this.events.onEnabled.eventTarget; }
  public get onInstalled() { return this.events.onInstalled.eventTarget; }
  public get onUninstalled() { return this.events.onUninstalled.eventTarget; }

  constructor(filter: AddonFilter) {
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
    this.events[aEventName].emit(aExtensionInfo);
  }
}
