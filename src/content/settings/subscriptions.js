/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2012 Justin Samuel
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

import {common, WinEnv, elManager} from "./common";

(function() {
  var {
    Log: log,
    SUBSCRIPTION_ADDED_TOPIC,
    SUBSCRIPTION_REMOVED_TOPIC,
    rpService,
  } = browser.extension.getBackgroundPage();

  // ===========================================================================

  var PAGE_STRINGS = [
    "yourPolicy",
    "defaultPolicy",
    "subscriptions",
    "subscriptionPolicies",
    "subscriptionPoliciesDefinition",
    "learnMoreAboutSubscriptions",
    "usability",
    "privacy",
    "browser",
    "subscriptionDenyTrackersDescription",
    "subscriptionAllowSameOrgDescription",
    "subscriptionAllowFunctionalityDescription",
    "subscriptionAllowEmbeddedDescription",
    "subscriptionAllowMozillaDescription",
    "subscriptionAllowExtensionsDescription",
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  function getInputElement(subName) {
    var elements = document.body.querySelectorAll(
        "input[name=" + subName + "]");
    if (elements.length <= 0) {
      return null;
    }
    return elements[0];
  }

  function getAllSubscriptionElements() {
    var divs = document.getElementsByClassName("subscription");
    var elements = [];
    for (var i = 0, len = divs.length; i < len; ++i) {
      var div = divs[i];
      elements.push({
          id: div.id,
          div: div,
          input: getInputElement(div.id)});
    }
    return elements;
  }

  function updateDisplay() {
    var userSubs = rpService.getSubscriptions();
    var subsInfo = userSubs.getSubscriptionInfo();
    var allSubElements = getAllSubscriptionElements();
    for (var i = 0, len = allSubElements.length; i < len; ++i) {
      var element = allSubElements[i];
      element.input.checked = element.id in subsInfo.official;
    }
  }

  function handleSubscriptionCheckboxChange(event) {
    var userSubs = rpService.getSubscriptions();

    var subName = event.target.name;
    var enabled = event.target.checked;
    var subInfo = {};
    subInfo.official = {};
    subInfo.official[subName] = true;
    if (enabled) {
      userSubs.addSubscription("official", subName);
      Services.obs.notifyObservers(null, SUBSCRIPTION_ADDED_TOPIC,
            JSON.stringify(subInfo));
    } else {
      userSubs.removeSubscription("official", subName);
      Services.obs.notifyObservers(null, SUBSCRIPTION_REMOVED_TOPIC,
            JSON.stringify(subInfo));
    }
  }

  window.onload = function() {
    updateDisplay();

    var available = {
      "allow_embedded": {},
      "allow_extensions": {},
      "allow_functionality": {},
      "allow_mozilla": {},
      "allow_sameorg": {},
      "deny_trackers": {},
    };
    for (var subName in available) {
      var el = getInputElement(subName);
      if (!el) {
        log.log("Skipping unexpected official subName: " + subName);
        continue;
      }
      elManager.addListener(el, "change", handleSubscriptionCheckboxChange);
    }

    // call updateDisplay() every time a subscription is added or removed
    WinEnv.obMan.observe([
      SUBSCRIPTION_ADDED_TOPIC,
      SUBSCRIPTION_REMOVED_TOPIC,
    ], updateDisplay);
  };
})();
