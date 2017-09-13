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

import {Environment, MainEnvironment} from "lib/environment";
import {PrefManager} from "main/pref-manager";
import {Logger} from "lib/logger";
import {C} from "lib/utils/constants";

import "main/requestpolicy-service";
import "main/content-policy";
import "main/window-manager";
import "main/about-uri";

import {KeyboardShortcuts} from "controllers/keyboard-shortcuts";
import {OldRulesController} from "controllers/old-rules";

import {RequestProcessor} from "lib/request-processor";
import {Prefs} from "models/prefs";
import {PolicyManager} from "lib/policy-manager";
import {OldRules} from "lib/old-rules";
import {RuleUtils} from "lib/utils/rules";
import {ManagerForPrefObservers} from "lib/manager-for-pref-observer";
import {DomainUtil} from "lib/utils/domains";
import {StringUtils} from "lib/utils/strings";
import {Info} from "lib/utils/info";
import {SUBSCRIPTION_ADDED_TOPIC, SUBSCRIPTION_REMOVED_TOPIC}
    from "lib/subscription";
import {rpService} from "main/requestpolicy-service";
import {WindowUtils} from "lib/utils/windows";

let modules = [
  Logger,
];

let controllers = [
  KeyboardShortcuts,
  OldRulesController,
];

//==============================================================================

/* global _setBackgroundPage */
_setBackgroundPage({
  DomainUtil,
  Environment,
  Info,
  Logger,
  MainEnvironment,
  ManagerForPrefObservers,
  OldRules,
  PolicyManager,
  Prefs,
  RequestProcessor,
  rpService,
  RuleUtils,
  StringUtils,
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
  WindowUtils,
});

//==============================================================================

/**
 * If any Exception gets here, it will be a severe error.
 * The Logger can't be used, as it might not be available.
 */
function logSevereError(aMessage, aError) {
  Logger.error("[SEVERE] " + aMessage, aError);
}

const shutdownMessage = C.MM_PREFIX + "shutdown";

//==============================================================================
// shutdown
//==============================================================================

function shutdown(aShutdownArgs) {
  controllers.reverse().forEach(function(controller) {
    if (typeof controller.shutdown === "function") {
      controller.shutdown.apply(null);
    }
  });

  MainEnvironment.shutdown(aShutdownArgs);
}

function broadcastShutdownMessage() {
  let globalMM = Cc["@mozilla.org/globalmessagemanager;1"]
      .getService(Ci.nsIMessageBroadcaster);
  globalMM.broadcastAsyncMessage(shutdownMessage);
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
  }
};

observerService.addObserver(observer, "sdk:loader:destroy", false);

//==============================================================================
// start up
//==============================================================================

(function startup() {
  PrefManager.init();

  modules.forEach(m => {
    if (typeof m.bootstrap === "function") {
      m.bootstrap.apply(null);
    }
  });

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
}());
