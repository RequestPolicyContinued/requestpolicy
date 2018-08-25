/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2018 Martin Kimmerle
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
import { JSMs, XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

export class PrivateBrowsingService extends Module
    implements App.services.IPrivateBrowsingService {
  constructor(
      parentLog: Common.ILog,
      private privateBrowsingUtils: JSMs.PrivateBrowsingUtils,
      private cachedSettings: App.storage.ICachedSettings,
  ) {
    super("app.services.privateBrowsing", parentLog);
  }

  public isWindowPrivate(aWindow: XPCOM.nsIDOMWindow) {
    return this.privateBrowsingUtils.isWindowPrivate(aWindow);
  }

  /**
   * Should it be possible to add permanent rules in that window?
   */
  public mayPermanentRulesBeAdded(aWindow: XPCOM.nsIDOMWindow): boolean {
    return this.isWindowPrivate(aWindow) === false ||
        this.cachedSettings.get("privateBrowsingPermanentWhitelisting");
  }
}
