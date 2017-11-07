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

import {Log as log} from "content/models/log";
import {PolicyManager} from "content/lib/policy-manager";
import {UserSubscriptions, SUBSCRIPTION_UPDATED_TOPIC, SUBSCRIPTION_ADDED_TOPIC,
     SUBSCRIPTION_REMOVED_TOPIC} from "content/lib/subscription";
import {Level as EnvLevel, MainEnvironment} from "content/lib/environment";

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
      log.info("Subscription updates completed: " + result);
    }
    subscriptions.update(updateCompleted, serials);
  }

  // ---------------------------------------------------------------------------
  // startup and shutdown functions
  // ---------------------------------------------------------------------------

  // prepare back-end
  MainEnvironment.addStartupFunction(EnvLevel.BACKEND,
                                        loadConfigAndRules);

  function registerObservers() {
    MainEnvironment.obMan.observe([
      SUBSCRIPTION_UPDATED_TOPIC,
      SUBSCRIPTION_ADDED_TOPIC,
      SUBSCRIPTION_REMOVED_TOPIC,
    ], self.observe);
  }
  MainEnvironment.addStartupFunction(EnvLevel.INTERFACE,
                                        registerObservers);

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
        log.log("XXX updated: " + data);
        // TODO: check if the subscription is enabled. The user might have
        // disabled it between the time the update started and when it
        // completed.
        let subInfo = JSON.parse(data);
        PolicyManager.loadSubscriptionRules(subInfo);
        break;
      }

      case SUBSCRIPTION_ADDED_TOPIC: {
        log.log("XXX added: " + data);
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
            log.info("Subscription update completed: " + result);
          };
          subscriptions.update(updateCompleted, serials);
        }
        break;
      }

      case SUBSCRIPTION_REMOVED_TOPIC: {
        log.log("YYY: " + data);
        let subInfo = JSON.parse(data);
        PolicyManager.unloadSubscriptionRules(subInfo);
        break;
      }

      default:
        console.error("unknown topic observed: " + topic);
    }
  };

  return self;
})();
