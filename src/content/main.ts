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

let allControllers: Array<{[key: string]: any}> = [];

// import the Log first! It needs to get logging prefs from storage (async).
import {LogController} from "controllers/log-controller";
import {Controllers} from "lib/classes/controllers";
{
  const controllers = [LogController];
  (new Controllers(controllers)).startup();
  allControllers = allControllers.concat(controllers);
}
import { Log } from "models/log";

const log = Log.instance;

import {C} from "data/constants";
import {
  COMMONJS_UNLOAD_SUBJECT,
} from "legacy/lib/commonjs-unload-subject";

import {Level as EnvLevel, MainEnvironment} from "lib/environment";

import {rp} from "app/app.background";
import "main/about-uri";
import "main/content-policy";
import "main/window-manager";

import {
  KeyboardShortcutController,
} from "controllers/keyboard-shortcut-controller";
import {
  NotificationsController,
} from "controllers/notification-controller";
import {
  OtherRPInstallationsController,
} from "controllers/other-rp-installations-controller";

// @if BUILD_ALIAS='ui-testing'
import "ui-testing/services";
// @endif

const controllersToBeStartedUp = [
  KeyboardShortcutController,

  OtherRPInstallationsController,

  NotificationsController,
];
allControllers = allControllers.concat(controllersToBeStartedUp);

// =============================================================================

import {BackgroundPage} from "models/background-page";

declare const _setBackgroundPage: (
  backgroundPage: {[name: string]: any},
) => void;
_setBackgroundPage(BackgroundPage);

export {BackgroundPage};

// =============================================================================

function logSevereError(aMessage: string, aError: any) {
  console.error("[SEVERE] " + aMessage + " - Details:");
  console.dir(aError);
}

const shutdownMessage = `${C.MM_PREFIX}shutdown`;

// =============================================================================
// shutdown
// =============================================================================

function shutdown(aShutdownArgs: any) {
  (new Controllers(allControllers)).shutdown();
  MainEnvironment.shutdown(aShutdownArgs);
  rp.shutdown().catch(log.onError("main shutdown"));
}

declare const Services: any;

function broadcastShutdownMessage() {
  Services.mm.broadcastAsyncMessage(shutdownMessage);
}

// Very important: The shutdown message must be sent *after*
//     calling `removeDelayedFrameScript`, which is done in
//     the LEVELS.INTERFACE level.
MainEnvironment.addShutdownFunction(
    EnvLevel.BACKEND,
    broadcastShutdownMessage);

const observer = {
  observe(subject: any, topic: any, reason: any) {
    if (subject.wrappedJSObject === COMMONJS_UNLOAD_SUBJECT) {
      try {
        // Remark: shutdown() takes the arguments as an array!
        //
        // The only function using the reason argument is the
        // maybeHandleUninstallOrDisable() function in
        // pref-manager.js
        shutdown([null, reason]);
      } catch (e) {
        logSevereError("shutdown() failed!", e);
      }
    }
  },
};

Services.obs.addObserver(observer, "sdk:loader:destroy", false);

// =============================================================================
// start up
// =============================================================================

(function startup() {
  rp.startup().catch(log.onError("main startup"));

  try {
    // Remark: startup() takes the arguments as an array!
    MainEnvironment.startup([null, null]);
  } catch (e) {
    logSevereError("startup() failed!", e);
  }

  (new Controllers(controllersToBeStartedUp)).startup();
})();
