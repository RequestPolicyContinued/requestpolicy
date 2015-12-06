/* global window, $, common, $id */

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {Info} = importModule("lib/utils/info");
  var {rpPrefBranch} = importModule("lib/prefs");
  var {SUBSCRIPTION_ADDED_TOPIC, SUBSCRIPTION_REMOVED_TOPIC} =
      importModule("lib/subscription");
  var {rpService} = importModule("main/requestpolicy-service");

  //============================================================================

  var PAGE_STRINGS = [
    "welcomeToRequestPolicy",
    "forMostUsersDefaultsAreIdeal",
    "youCanConfigureRequestPolicyToBeMoreStrict",
    "teachMeHowToUseRequestPolicy",
    "returnToBrowsing",
    "configureRequestPolicy",
    "defaultPolicy",
    "defaultPolicyDefinition",
    "allowRequestsByDefault",
    "blockRequestsByDefault",
    "allowRequestsToTheSameDomain",
    "subscriptionPolicies",
    "subscriptionPoliciesDefinition",
    "yesUseSubscriptions",
    "noDoNotUseSubscriptions"
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  function showConfigure() {
    $("#welcome").css("display", "none");
    $("#configure").css("display", "block");
  }

  function handleDefaultPolicyChange() {
    rpPrefBranch.setBoolPref("defaultPolicy.allow",
        $id("defaultallow").checked);
    Services.prefs.savePrefFile(null);
    setAllowSameDomainBlockDisplay();
    handleSubscriptionsChange();
  }

  function handleAllowSameDomainChange() {
    rpPrefBranch.setBoolPref("defaultPolicy.allowSameDomain",
        $id("allowsamedomain").checked);
    Services.prefs.savePrefFile(null);
  }

  function setAllowSameDomainBlockDisplay() {
    if ($id("defaultallow").checked) {
      $("#allowsamedomainblock").css("display", "none");
    } else {
      $("#allowsamedomainblock").css("display", "block");
    }
  }

  function handleSubscriptionsChange() {
    var enableSubs = $id("enablesubs").checked;
    var enableAllowSubs = enableSubs && $id("defaultdeny").checked;
    var enableDenySubs = enableSubs && $id("defaultallow").checked;
    var subs = {
      "allow_embedded": {},
      "allow_extensions": {},
      "allow_functionality": {},
      "allow_mozilla": {},
      "allow_sameorg": {},
      "deny_trackers": {}
    };
    var userSubs = rpService.getSubscriptions();
    for (var subName in subs) {
      var subInfo = {};
      subInfo.official = {};
      subInfo.official[subName] = true;
      if (enableAllowSubs && subName.startsWith("allow_") ||
          enableDenySubs && subName.startsWith("deny_")) {
        userSubs.addSubscription("official", subName);
        Services.obs.notifyObservers(null, SUBSCRIPTION_ADDED_TOPIC,
            JSON.stringify(subInfo));
      } else {
        userSubs.removeSubscription("official", subName);
        Services.obs.notifyObservers(null, SUBSCRIPTION_REMOVED_TOPIC,
            JSON.stringify(subInfo));
      }
    }
  }

  /*
  function getArguments(args) {
    let urlQuery = document.location.search || "";
    if (urlQuery.length > 1) {
      urlQuery = decodeURIComponent(urlQuery.substr(1));
    }
    let queryArgs = split("&");
    for (let i in queryArgs) {
      let tmp = queryArgs.split("=");
      if (args.hasOwnProperty(tmp)) {
        args[tmp[0]] = tmp[1];
      }
    }
    return args;
  }*/

  window.onload = function() {
    if (Info.isRPUpgrade) {
      // Skip the welcome screen.
      showConfigure();
    }

    // Populate the form values based on the user's current settings.

    let defaultAllow = rpPrefBranch.getBoolPref("defaultPolicy.allow");
    $id("defaultallow").checked = defaultAllow;
    $id("defaultdeny").checked = !defaultAllow;
    if (!defaultAllow) {
      $("#allowsamedomainblock").css("display", "block");
    }

    $id("allowsamedomain").checked =
        rpPrefBranch.getBoolPref("defaultPolicy.allowSameDomain");

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

}());
