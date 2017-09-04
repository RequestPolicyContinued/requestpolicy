/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

"use strict";

/* global Components */
/* exported startup, shutdown, install, uninstall */

//==============================================================================
// utilities, constants
//==============================================================================

const {utils: Cu} = Components;
const BOOTSTRAP = "chrome://rpcontinued/content/bootstrap/bootstrap.jsm";

function reasonConstantToString(c) {
  switch (c) {
    case 1: return "APP_STARTUP";
    case 2: return "APP_SHUTDOWN";
    case 3: return "ADDON_ENABLE";
    case 4: return "ADDON_DISABLE";
    case 5: return "ADDON_INSTALL";
    case 6: return "ADDON_UNINSTALL";
    case 7: return "ADDON_UPGRADE";
    case 8: return "ADDON_DOWNGRADE";
    default: return "";
  }
}

//==============================================================================
// bootstrap functions
//==============================================================================

let commonjsEnv;

function startup(data, reason) {
  const {FakeWebExt} = Cu.import(BOOTSTRAP, {});
  const {getGlobals} = FakeWebExt;
  let {console, Services} = getGlobals();

  console.debug("starting up");

  // Before anything else, handle default preferences.
  //
  // The following script needs to be called because bootsrapped addons have
  // to handle their default preferences manually, see Mozilla Bug 564675:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=564675
  // The scope of that script doesn't need to be remembered.
  Services.scriptloader.loadSubScript(
      "chrome://rpcontinued/content/bootstrap/misc/" +
      "handle-default-preferences.js",
      getGlobals());
  Services.prefs.savePrefFile(null);

  const {Api, createCommonjsEnv} = FakeWebExt;
  FakeWebExt.startup();
  commonjsEnv = createCommonjsEnv();
  commonjsEnv.load("main", [
    ["browser", Api.browser],
    ["LegacyApi", Api.LegacyApi],
    ["_setBackgroundPage", Api._setBackgroundPage],
  ]);
}

function shutdown(data, reason) {
  let reasonString = reasonConstantToString(reason);
  if (reasonString === "APP_SHUTDOWN") {
    return;
  }

  const {FakeWebExt} = Cu.import(BOOTSTRAP, {});
  let {getGlobals} = FakeWebExt;
  let {console} = getGlobals();
  console.debug("shutting down");

  commonjsEnv.unload(reasonString);
  commonjsEnv = undefined;
  FakeWebExt.shutdown();

  Cu.unload(BOOTSTRAP);
}

function install(data, reason) {
  // note: the addon might be not activated when this function gets called

  // HACK WARNING: The Addon Manager does not properly clear all addon
  //               related caches on update; in order to fully update
  //               images and locales, their caches are flushed.
  // Note: Due to Bug 1144248 this has to be done in the
  //       `install` function.
  let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
  Services.obs.notifyObservers(null, "chrome-flush-caches", null);
}

function uninstall(data, reason) {
  // note: the addon might be not activated when this function gets called
}
