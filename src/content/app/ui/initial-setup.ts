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
import { NotificationID } from "app/ui/notifications/notifications-set";
import { API } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

export class InitialSetup extends Module implements App.ui.IInitialSetup {
  protected get startupPreconditions() {
    return [
      this.cachedSettings.whenReady,
      this.versionInfo.whenReady,
    ];
  }

  private onNotificationsTabOpenedListener =
      this.onNotificationsTabOpened.bind(this);

  constructor(
      log: Common.ILog,
      private cachedSettings: App.storage.ICachedSettings,
      private versionInfo: App.services.IVersionInfoService,
      private notifications: App.ui.INotifications,
      private xpcApi: {
        rpPrefBranch: API.ILegacyApi["rpPrefBranch"],
      },
  ) {
    super("app.ui.initialSetup", log);
  }

  public startupSelf() {
    this.maybeShowSetupTab();
    return MaybePromise.resolve(undefined);
  }

  private onNotificationsTabOpened(aId: NotificationID) {
    if (aId !== NotificationID.InitialSetup) return;
    this.notifications.notifications.onTabOpened.removeListener(
        this.onNotificationsTabOpenedListener,
    );
    this.cachedSettings.set({welcomeWindowShown: true}).
        catch(this.log.onError("onNotificationsTabOpened"));
  }

  private maybeShowSetupTab() {
    if (this.cachedSettings.get("welcomeWindowShown")) return;

    if (this.versionInfo.isRPUpgrade) {
      // If the use has just upgraded from an 0.x version, set the
      // default-policy preferences based on the old preferences.
      this.cachedSettings.set({"defaultPolicy.allow": false}).
          catch(this.log.onError("set defaultPolicy.allow"));
      if (this.xpcApi.rpPrefBranch.isSet("uriIdentificationLevel")) {
        const identLevel = this.cachedSettings.get("uriIdentificationLevel");
        this.cachedSettings.set({
          "defaultPolicy.allowSameDomain": identLevel === 1,
        }).catch(this.log.onError("set defaultPolicy.allowSameDomain"));
      }
    }

    this.notifications.notifications.onTabOpened.addListener(
        this.onNotificationsTabOpenedListener,
    );
    this.notifications.notifications.add(NotificationID.InitialSetup);
  }
}
