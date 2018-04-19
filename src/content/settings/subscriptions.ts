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

import { UserSubscriptionsInfo } from "lib/subscription";
import {BackgroundPage} from "main";
import {elManager, WinEnv} from "./common";

declare const Services: any;

(() => {
  const {
    SUBSCRIPTION_ADDED_TOPIC,
    SUBSCRIPTION_REMOVED_TOPIC,
    log,
    rp,
  } = (browser.extension.getBackgroundPage() as any) as typeof BackgroundPage;

  // ===========================================================================

  function getInputElement(subName: any) {
    const elements = document.body.querySelectorAll(`input[name=${subName}]`);
    if (elements.length <= 0) {
      return null;
    }
    return elements[0];
  }

  function getAllSubscriptionElements() {
    const divs = document.getElementsByClassName("subscription");
    const elements = [];
    for (let i = 0, len = divs.length; i < len; ++i) {
      const div = divs[i];
      elements.push({
        div,
        id: div.id,
        input: getInputElement(div.id),
      });
    }
    return elements;
  }

  function updateDisplay() {
    const userSubs = rp.policy.subscriptions.getSubscriptions();
    const subsInfo = userSubs.getSubscriptionInfo();
    const allSubElements = getAllSubscriptionElements();
    for (let i = 0, len = allSubElements.length; i < len; ++i) {
      const element = allSubElements[i];
      (element.input as any).checked = element.id in subsInfo.official;
    }
  }

  function handleSubscriptionCheckboxChange(event: any) {
    const userSubs = rp.policy.subscriptions.getSubscriptions();

    const subName = event.target.name;
    const enabled = event.target.checked;
    const subInfo: UserSubscriptionsInfo = {};
    subInfo.official = {};
    subInfo.official[subName] = true;
    if (enabled) {
      userSubs.addSubscription("official", subName);
      Services.obs.notifyObservers(
          null, SUBSCRIPTION_ADDED_TOPIC,
          JSON.stringify(subInfo),
      );
    } else {
      userSubs.removeSubscription("official", subName);
      Services.obs.notifyObservers(
          null, SUBSCRIPTION_REMOVED_TOPIC,
          JSON.stringify(subInfo),
      );
    }
  }

  window.onload = () => {
    updateDisplay();

    const available = {
      allow_embedded: {},
      allow_extensions: {},
      allow_functionality: {},
      allow_mozilla: {},
      allow_sameorg: {},
      deny_trackers: {},
    };
    // tslint:disable-next-line:forin
    for (const subName in available) {
      const el = getInputElement(subName);
      if (!el) {
        log.log(`Skipping unexpected official subName: ${subName}`);
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
