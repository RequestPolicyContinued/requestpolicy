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

import {Log} from "content/models/log";
import {Storage} from "content/models/storage";
import {PolicyManager} from "content/lib/policy-manager";
import {UserSubscriptions, SUBSCRIPTION_UPDATED_TOPIC, SUBSCRIPTION_ADDED_TOPIC,
     SUBSCRIPTION_REMOVED_TOPIC} from "content/lib/subscription";
import {Environment, MainEnvironment} from "content/lib/environment";
import * as WindowUtils from "content/lib/utils/window-utils";
import {Info} from "content/lib/info";

// =============================================================================
// rpService
// =============================================================================

export const rpService = (function() {
  let self = {};

  // ---------------------------------------------------------------------------
  // Internal Data
  // ---------------------------------------------------------------------------

  let subscriptions = null;

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  function loadConfigAndRules() {
    subscriptions = new UserSubscriptions();
    PolicyManager.loadUserRules();

    let failures = PolicyManager.loadSubscriptionRules(
        subscriptions.getSubscriptionInfo());
    // TODO: check a preference that indicates the last time we checked for
    // updates. Don't do it if we've done it too recently.
    // TODO: Maybe we should probably ship snapshot versions of the official
    // rulesets so that they can be available immediately after installation.
    let serials = {};
    for (let listName in failures) {
      serials[listName] = {};
      for (let subName in failures[listName]) {
        serials[listName][subName] = -1;
      }
    }
    const loadedSubs = PolicyManager.getSubscriptionRulesets();
    for (let listName in loadedSubs) {
      for (let subName in loadedSubs[listName]) {
        if (!serials[listName]) {
          serials[listName] = {};
        }
        let rawRuleset = loadedSubs[listName][subName].rawRuleset;
        serials[listName][subName] = rawRuleset._metadata.serial;
      }
    }
    function updateCompleted(result) {
      Log.info("Subscription updates completed: " + result);
    }
    subscriptions.update(updateCompleted, serials);
  }

  // TODO: move to window manager
  function maybeShowSetupTab() {
    if (!Storage.get("welcomeWindowShown")) {
      const url = "about:requestpolicy?setup";

      let win = WindowUtils.getMostRecentBrowserWindow();
      if (win === null) {
        return;
      }
      let tabbrowser = win.getBrowser();
      if (typeof tabbrowser.addTab !== "function") {
        return;
      }

      if (Info.isRPUpgrade) {
        // If the use has just upgraded from an 0.x version, set the
        // default-policy preferences based on the old preferences.
        Storage.set({"defaultPolicy.allow": false});
        if (LegacyApi.prefs.isSet("uriIdentificationLevel")) {
          let identLevel = Storage.get("uriIdentificationLevel");
          Storage.set({
            "defaultPolicy.allowSameDomain": identLevel === 1,
          });
        }
      }

      tabbrowser.selectedTab = tabbrowser.addTab(url);

      Storage.set({"welcomeWindowShown": true});
    }
  }

  // ---------------------------------------------------------------------------
  // startup and shutdown functions
  // ---------------------------------------------------------------------------

  // prepare back-end
  MainEnvironment.addStartupFunction(Environment.LEVELS.BACKEND,
                                        loadConfigAndRules);

  function registerObservers() {
    MainEnvironment.obMan.observe([
      "sessionstore-windows-restored",
      SUBSCRIPTION_UPDATED_TOPIC,
      SUBSCRIPTION_ADDED_TOPIC,
      SUBSCRIPTION_REMOVED_TOPIC,

      // support for old browsers (Firefox <20)
      // TODO: support per-window temporary rules
      //       see https://github.com/RequestPolicyContinued/requestpolicy/issues/533#issuecomment-68851396
      "private-browsing",
    ], self.observe);
  }
  MainEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        registerObservers);

  MainEnvironment.addStartupFunction(
      Environment.LEVELS.UI,
      function() {
        // In case of the app's startup and if they fail now, they
        // will be successful when they are called by the
        // "sessionstore-windows-restored" observer.
        maybeShowSetupTab();
      });

  self.getSubscriptions = function() {
    return subscriptions;
  };

  // ---------------------------------------------------------------------------
  // nsIObserver interface
  // ---------------------------------------------------------------------------

  self.observe = function(subject, topic, data) {
    switch (topic) {
      // FIXME: The subscription logic should reside in the
      // subscription module.

      case SUBSCRIPTION_UPDATED_TOPIC: {
        Log.log("XXX updated: " + data);
        // TODO: check if the subscription is enabled. The user might have
        // disabled it between the time the update started and when it
        // completed.
        let subInfo = JSON.parse(data);
        PolicyManager.loadSubscriptionRules(subInfo);
        break;
      }

      case SUBSCRIPTION_ADDED_TOPIC: {
        Log.log("XXX added: " + data);
        let subInfo = JSON.parse(data);
        let failures = PolicyManager.loadSubscriptionRules(subInfo);
        let failed = Object.getOwnPropertyNames(failures).length > 0;
        if (failed) {
          let serials = {};
          for (let listName in subInfo) {
            if (!serials[listName]) {
              serials[listName] = {};
            }
            for (let subName in subInfo[listName]) {
              serials[listName][subName] = -1;
            }
          }
          let updateCompleted = function(result) {
            Log.info("Subscription update completed: " + result);
          };
          subscriptions.update(updateCompleted, serials);
        }
        break;
      }

      case SUBSCRIPTION_REMOVED_TOPIC: {
        Log.log("YYY: " + data);
        let subInfo = JSON.parse(data);
        PolicyManager.unloadSubscriptionRules(subInfo);
        break;
      }

      case "sessionstore-windows-restored":
        maybeShowSetupTab();
        break;

      // support for old browsers (Firefox <20)
      case "private-browsing":
        if (data === "exit") {
          PolicyManager.revokeTemporaryRules();
        }
        break;

      default:
        console.error("unknown topic observed: " + topic);
    }
  };

  return self;
})();
