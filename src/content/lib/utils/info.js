/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

import {C} from "lib/utils/constants";
import {JSUtils} from "lib/utils/javascript";

// =============================================================================
// Info
// =============================================================================

export var Info = (function() {
  let self = {};

  // bad smell...
  // get/set last/current RP version
  {
    self.lastRPVersion = LegacyApi.prefs.get("lastVersion");

    self.curRPVersion = "0.0";
    // curRPVersion needs to be set asynchronously
    browser.management.getSelf().then(addon => {
      LegacyApi.prefs.set("lastVersion", addon.version);
      self.curRPVersion = addon.version;
      if (self.lastRPVersion !== self.curRPVersion) {
        LegacyApi.prefs.save();
      }
      return;
    }).catch(e => {
      console.error("Error setting lastRPVersion. Details:");
      console.dir(e);
    });

    JSUtils.defineLazyGetter(self, "isRPUpgrade", function() {
      // Compare with version 1.0.0a8 since that version introduced
      // the "welcome window".
      return self.lastRPVersion &&
          Services.vc.compare(self.lastRPVersion, "1.0.0a8") <= 0;
    });
  }

  // bad smell...
  // get/set last/current app (e.g. firefox) version
  {
    self.lastAppVersion = LegacyApi.prefs.get("lastAppVersion");

    let curAppVersion = Services.appinfo.version;
    self.curAppVersion = curAppVersion;
    LegacyApi.prefs.set("lastAppVersion", curAppVersion);

    if (self.lastAppVersion !== self.curAppVersion) {
      LegacyApi.prefs.save();
    }
  }

  let {ID: appID, name: appName, platformVersion} = Services.appinfo;
  self.isFirefox = appID === C.FIREFOX_ID;
  self.isSeamonkey = appID === C.SEAMONKEY_ID;
  self.isGecko = appName !== "Pale Moon";
  self.isAustralis = self.isFirefox &&
      Services.vc.compare(platformVersion, "29") >= 0;

  self.isGeckoVersionAtLeast = function(aMinVersion) {
    return self.isGecko &&
        Services.vc.compare(platformVersion, aMinVersion) >= 0;
  };

  return self;
}());
