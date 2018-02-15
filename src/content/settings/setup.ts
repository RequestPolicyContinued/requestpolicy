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

import * as JQuery from "jquery";
import { UserSubscriptionsInfo } from "lib/subscription";
import {BackgroundPage} from "main";
import {$id} from "./common";

declare const Services: any;
declare const $: typeof JQuery;

(() => {
  const {
    VersionInfos,
    SUBSCRIPTION_ADDED_TOPIC,
    SUBSCRIPTION_REMOVED_TOPIC,
    rp,
  } = (browser.extension.getBackgroundPage() as any) as typeof BackgroundPage;

  // ===========================================================================

  function showConfigure() {
    $("#welcome").css("display", "none");
    $("#configure").css("display", "block");
  }

  function handleDefaultPolicyChange() {
    rp.storage.set({
      "defaultPolicy.allow": $id("defaultallow").checked,
    });
    setAllowSameDomainBlockDisplay();
  }

  function handleAllowSameDomainChange() {
    rp.storage.set({
      "defaultPolicy.allowSameDomain": $id("allowsamedomain").checked,
    });
  }

  function setAllowSameDomainBlockDisplay() {
    if ($id("defaultallow").checked) {
      $("#allowsamedomainblock").css("display", "none");
    } else {
      $("#allowsamedomainblock").css("display", "block");
    }
  }

  function handleSubscriptionsChange() {
    const enableSubs = $id("enablesubs").checked;
    const subs = {
      allow_embedded: {},
      allow_extensions: {},
      allow_functionality: {},
      allow_mozilla: {},
      allow_sameorg: {},
      deny_trackers: {},
    };
    const userSubs = rp.policy.subscriptions.getSubscriptions();
    // tslint:disable-next-line:forin
    for (const subName in subs) {
      const subInfo: UserSubscriptionsInfo = {};
      subInfo.official = {};
      subInfo.official[subName] = true;
      // FIXME: Add a pref to disable subscriptions globally (#713)
      if (enableSubs) {
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
  }

  /*
  function getArguments(args) {
    var urlQuery = document.location.search || "";
    if (urlQuery.length > 1) {
      urlQuery = decodeURIComponent(urlQuery.substr(1));
    }
    var queryArgs = split("&");
    for (var i in queryArgs) {
      var tmp = queryArgs.split("=");
      if (args.hasOwnProperty(tmp)) {
        args[tmp[0]] = tmp[1];
      }
    }
    return args;
  }*/

  window.onload = () => {
    if (VersionInfos.isRPUpgrade) {
      // Skip the welcome screen.
      showConfigure();
    }

    // Populate the form values based on the user's current settings.

    const defaultAllow = rp.storage.get("defaultPolicy.allow");
    $id("defaultallow").checked = defaultAllow;
    $id("defaultdeny").checked = !defaultAllow;
    if (!defaultAllow) {
      $("#allowsamedomainblock").css("display", "block");
    }

    $id("allowsamedomain").checked =
        rp.storage.get("defaultPolicy.allowSameDomain");

    // FIXME: Add a pref to disable subscriptions globally;  issue #713
    // Subscriptions are only simple here if we assume the user
    // won't open the setup window again after changing their
    // individual subscriptions through the preferences.
    // So, let's assume that as the worst case is that the setup
    // page shows such a setup-page-revisiting user the subscriptions
    // as being enabled when they really aren't.

    $("#showconfigure").click(showConfigure);
    $("input[name=defaultpolicy]").change(handleDefaultPolicyChange);
    $("input[name=subscriptions]").change(handleSubscriptionsChange);
    $("#allowsamedomain").change(handleAllowSameDomainChange);
  };
})();
