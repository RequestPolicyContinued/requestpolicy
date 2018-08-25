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

import { App } from "app/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";
import { NotificationID, NotificationsSet } from "./notifications-set";

export class Notifications extends Module implements App.ui.INotifications {
  public readonly notifications = new NotificationsSet(this.windowService);
  public readonly IDs = NotificationID;

  protected get startupPreconditions() {
    return [
      this.windowService.whenReady,
      this.windowService.pWindowsAvailable,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      private windowService: App.services.IWindowService,
  ) {
    super(`app.ui.notifications`, parentLog);
  }

  protected startupSelf() {
    const showNotification = (id: NotificationID) => {
      this.notifications.openTab(id);
    };
    this.notifications.forEach(showNotification);
    this.notifications.onAdded.addListener(showNotification);

    return Promise.resolve();
  }
}
