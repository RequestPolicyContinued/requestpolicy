/* global window, $, common, $id */

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {Info} = importModule("lib/utils/info");
  var {rpPrefBranch} = importModule("lib/prefs");
  var {Logger} = importModule("lib/logger");
  var {PolicyManager} = importModule("lib/policy-manager");
  var {SUBSCRIPTION_ADDED_TOPIC, SUBSCRIPTION_REMOVED_TOPIC} =
      importModule("lib/subscription");
  var {rpService} = importModule("main/requestpolicy-service");
  var {OldRules} = importModule("lib/old-rules");

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
    // To retrieve the last RP version, `Info` needs to be used,
    // because the pref "extensions.requestpolicy.lastVersion" has
    // already been updated.
    var lastRPVersion = Info.lastRPVersion;

    // Populate the form values based on the user's current settings.
    // If the use has just upgrade from an 0.x version, populate based on the old
    // preferences and also do a rule import based on the old strictness settings.
    // Note: using version 1.0.0a8 instead of 1.0 as that was the last version
    // before this setup window was added.
    if (lastRPVersion &&
        Services.vc.compare(lastRPVersion, "0.0") > 0 &&
        Services.vc.compare(lastRPVersion, "1.0.0a8") <= 0) {
      var identLevel;
      if (rpPrefBranch.prefHasUserValue("uriIdentificationLevel")) {
        identLevel = rpPrefBranch.getIntPref("uriIdentificationLevel");
      } else {
        identLevel = 1;
      }

      $id("defaultdeny").checked = true;
      handleDefaultPolicyChange();

      $id("allowsamedomain").checked = identLevel === 1;
      handleAllowSameDomainChange();

      // If the user doesn't have any new-style rules, automatically do an import
      // of the old rules. We check for new-style rules just in case the user has
      // opened the setup window again after initial upgrade.
      var ruleCount;
      try {
        ruleCount = PolicyManager.getUserRuleCount();
      } catch (e) {
        Logger.warning(Logger.TYPE_INTERNAL,
            "Unable to get new rule count: " + e);
        ruleCount = -1;
      }
      Logger.dump("Rule count: " + ruleCount);
      if (ruleCount <= 0) {
        Logger.dump("Performing rule import.");
        var oldRules = new OldRules();
        var rules = oldRules.getAsNewRules();
        PolicyManager.addAllowRules(rules);
      }

      // Skip the welcome screen.
      showConfigure();

    } else {
      var defaultAllow = rpPrefBranch.getBoolPref("defaultPolicy.allow");
      $id("defaultallow").checked = !!defaultAllow;
      $id("defaultdeny").checked = !defaultAllow;
      if (!defaultAllow) {
        $("#allowsamedomainblock").css("display", "block");
      }

      $id("allowsamedomain").checked =
          rpPrefBranch.getBoolPref("defaultPolicy.allowSameDomain");
      // Subscriptions are only simple here if we assume the user won't open the
      // setup window again after changing their individual subscriptions through
      // the preferences. So, let's assume that as the worst case is that the setup
      // page shows such a setup-page-revisiting user the subscriptions as being
      // enabled when they really aren't.
    }

    $("#showconfigure").click(showConfigure);
    $("input[name=defaultpolicy]").change(handleDefaultPolicyChange);
    $("input[name=subscriptions]").change(handleSubscriptionsChange);
    $("#allowsamedomain").change(handleAllowSameDomainChange);
  };

}());
