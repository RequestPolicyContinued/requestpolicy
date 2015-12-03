/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

/* global Components */
const {utils: Cu} = Components;

/* exported Info */
this.EXPORTED_SYMBOLS = ["Info"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {rpPrefBranch} = importModule("lib/prefs");
let {C} = importModule("lib/utils/constants");
let {ProcessEnvironment} = importModule("lib/environment");

let AddonManager = null;
if (ProcessEnvironment.isMainProcess) {
  // FIXME: Re-enable (W126) when JSHint issue #2775 is fixed.
  /* jshint -W126 */
  ({AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm", {}));
  /* jshint +W126 */
}

//==============================================================================
// Info
//==============================================================================

var Info = (function() {
  let self = {};

  // bad smell...
  // get/set last/current RP version
  if (ProcessEnvironment.isMainProcess) {
    self.lastRPVersion = rpPrefBranch.getCharPref("lastVersion");

    self.curRPVersion = "0.0";
    // curRPVersion needs to be set asynchronously
    AddonManager.getAddonByID(C.EXTENSION_ID, function(addon) {
      rpPrefBranch.setCharPref("lastVersion", addon.version);
      self.curRPVersion = addon.version;
      if (self.lastRPVersion !== self.curRPVersion) {
        Services.prefs.savePrefFile(null);
      }
    });
  }

  // bad smell...
  // get/set last/current app (e.g. firefox) version
  if (ProcessEnvironment.isMainProcess) {
    self.lastAppVersion = rpPrefBranch.getCharPref("lastAppVersion");

    let curAppVersion = Services.appinfo.version;
    self.curAppVersion = curAppVersion;
    rpPrefBranch.setCharPref("lastAppVersion", curAppVersion);

    if (self.lastAppVersion !== self.curAppVersion) {
      Services.prefs.savePrefFile(null);
    }
  }

  let appID = Services.appinfo.ID;
  self.isFirefox = appID === C.FIREFOX_ID;
  self.isSeamonkey = appID === C.SEAMONKEY_ID;
  self.isAustralis = self.isFirefox &&
      Services.vc.compare(Services.appinfo.platformVersion, "29") >= 0;

  return self;
}());
