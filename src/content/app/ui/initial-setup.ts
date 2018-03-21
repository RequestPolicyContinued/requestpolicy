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

declare const LegacyApi: any;

import { VersionInfoService } from "app/services/version-info-service";
import { Storage } from "app/storage/storage.module";
import { Module } from "lib/classes/module";
import { Log } from "models/log";
import {NotificationID, Notifications} from "models/notifications";

export class InitialSetup extends Module {
  protected get startupPreconditions() {
    return [
      this.storage.whenReady,
      this.versionInfo.whenReady,
    ];
  }

  private onNotificationsTabOpenedListener =
      this.onNotificationsTabOpened.bind(this);

  constructor(
      log: Log,
      private storage: Storage,
      private versionInfo: VersionInfoService,
  ) {
    super("app.ui.initialSetup", log);
  }

  public async startupSelf() {
    return this.maybeShowSetupTab();
  }

  private onNotificationsTabOpened(aId: NotificationID) {
    if (aId !== NotificationID.InitialSetup) return;
    Notifications.onTabOpened.removeListener(
        this.onNotificationsTabOpenedListener,
    );
    this.storage.set({welcomeWindowShown: true}).
        catch(this.log.onError("onNotificationsTabOpened"));
  }

  private maybeShowSetupTab() {
    if (this.storage.get("welcomeWindowShown")) return;

    if (this.versionInfo.isRPUpgrade) {
      // If the use has just upgraded from an 0.x version, set the
      // default-policy preferences based on the old preferences.
      this.storage.set({"defaultPolicy.allow": false}).
          catch(this.log.onError("set defaultPolicy.allow"));
      if (LegacyApi.prefs.isSet("uriIdentificationLevel")) {
        const identLevel = this.storage.get("uriIdentificationLevel");
        this.storage.set({
          "defaultPolicy.allowSameDomain": identLevel === 1,
        }).catch(this.log.onError("set defaultPolicy.allowSameDomain"));
      }
    }

    Notifications.onTabOpened.addListener(
        this.onNotificationsTabOpenedListener,
    );
    Notifications.add(NotificationID.InitialSetup);
  }
}
