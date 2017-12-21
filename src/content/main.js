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

// import the logger first! It needs to get logging prefs from storage (async).
import {Logger} from "content/lib/logger";

import {Environment, MainEnvironment} from "content/lib/environment";
import {PrefManager} from "content/main/pref-manager";
import {C} from "content/lib/utils/constants";

import "content/main/requestpolicy-service";
import "content/main/content-policy";
import "content/main/window-manager";
import "content/main/about-uri";

import {KeyboardShortcuts} from "content/controllers/keyboard-shortcuts";
import {OldRulesController} from "content/controllers/old-rules";

import {RequestProcessor} from "content/lib/request-processor";
import {Storage} from "content/models/storage";
import {PolicyManager} from "content/lib/policy-manager";
import {OldRules} from "content/lib/old-rules";
import {RuleUtils} from "content/lib/utils/rules";
import {ManagerForPrefObservers} from "content/lib/manager-for-pref-observer";
import {DomainUtil} from "content/lib/utils/domains";
import {Info} from "content/lib/utils/info";
import {SUBSCRIPTION_ADDED_TOPIC, SUBSCRIPTION_REMOVED_TOPIC}
    from "content/lib/subscription";
import {rpService} from "content/main/requestpolicy-service";
import {WindowUtils} from "content/lib/utils/windows";

// @if BUILD_ALIAS='ui-testing'
import "content/ui-testing/services";
// @endif

let controllers = [
  KeyboardShortcuts,
  OldRulesController,
];

// =============================================================================

/* global _setBackgroundPage */
_setBackgroundPage({
  C,
  DomainUtil,
  Environment,
  Info,
  Logger,
  MainEnvironment,
  ManagerForPrefObservers,
  OldRules,
  PolicyManager,
  LegacyApi,
  Storage,
  RequestProcessor,
  rpService,
  RuleUtils,
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
  WindowUtils,
});

// =============================================================================

function logSevereError(aMessage, aError) {
  console.error("[SEVERE] " + aMessage + " - Details:");
  console.dir(aError);
}

const shutdownMessage = C.MM_PREFIX + "shutdown";

// =============================================================================
// shutdown
// =============================================================================

function shutdown(aShutdownArgs) {
  controllers.reverse().forEach(function(controller) {
    if (typeof controller.shutdown === "function") {
      controller.shutdown.apply(null);
    }
  });

  MainEnvironment.shutdown(aShutdownArgs);
}

function broadcastShutdownMessage() {
  Services.mm.broadcastAsyncMessage(shutdownMessage);
}

// Very important: The shutdown message must be sent *after*
//     calling `removeDelayedFrameScript`, which is done in
//     the LEVELS.INTERFACE level.
MainEnvironment.addShutdownFunction(
    Environment.LEVELS.BACKEND,
    broadcastShutdownMessage);

let unloadSubject = require("@loader/unload");
let observerService = Cc["@mozilla.org/observer-service;1"].
                      getService(Ci.nsIObserverService);

let observer = {
  observe: function(subject, topic, reason) {
    if (subject.wrappedJSObject === unloadSubject) {
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

observerService.addObserver(observer, "sdk:loader:destroy", false);

// =============================================================================
// start up
// =============================================================================

(function startup() {
  PrefManager.init();

  // TODO: Initialize the "models" first. Then initialize the other
  // controllers, which is currently "rpService", "ContentPolicy" etc.

  try {
    // Remark: startup() takes the arguments as an array!
    MainEnvironment.startup([null, null]);
  } catch (e) {
    logSevereError("startup() failed!", e);
  }

  controllers.forEach(function(controller) {
    if (typeof controller.startup === "function") {
      controller.startup.apply(null);
    }
  });
})();
