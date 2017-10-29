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

import {IEventTarget} from "content/lib/classes/event";
import {Event} from "content/lib/classes/event";
import * as WindowUtils from "content/lib/utils/window-utils";

export enum NotificationID {
  InitialSetup,
  MultipleRPInstallations,
}

const URI_MAP = new Map([
  [
    NotificationID.InitialSetup,
    "about:requestpolicy?setup",
  ],
  [
    NotificationID.MultipleRPInstallations,
    "chrome://rpcontinued/content/multiple-installations.html",
  ],
]);

class NotificationsClass extends Set {
  public onAdded: IEventTarget;
  public onDeleted: IEventTarget;
  public onTabOpened: IEventTarget;
  private events = Event.createMultiple([
    "onAdded",
    "onDeleted",
    "onTabOpened",
  ]).events;

  constructor() {
    super();
    this.onAdded = this.events.onAdded.eventTarget;
    this.onDeleted = this.events.onDeleted.eventTarget;
    this.onTabOpened = this.events.onTabOpened.eventTarget;
  }

  public add(aID: NotificationID): this {
    if (this.has(aID)) return this;
    super.add(aID);
    this.events.onAdded.emit(aID);
    return this;
  }
  public delete(aID: NotificationID): boolean {
    if (!this.has(aID)) return false;
    this.delete(aID);
    this.events.onDeleted.emit(aID);
    return true;
  }

  public openTab(aID: NotificationID): void {
    const win = WindowUtils.getMostRecentBrowserWindow();
    const tabbrowser = win.getBrowser();
    tabbrowser.selectedTab = tabbrowser.addTab(URI_MAP.get(aID));
    this.events.onTabOpened.emit(aID);
  }
}

export const Notifications = new NotificationsClass();
