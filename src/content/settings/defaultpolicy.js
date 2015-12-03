/* global window, $, common, WinEnv, elManager, $id */

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {rpPrefBranch} = importModule("lib/prefs");

  //============================================================================

  var PAGE_STRINGS = [
    "yourPolicy",
    "defaultPolicy",
    "subscriptions",
    "allowRequestsByDefault",
    "blockRequestsByDefault",
    "defaultPolicyDefinition",
    "learnMore",
    "allowRequestsToTheSameDomain",
    "differentSubscriptionsAreAvailable",
    "manageSubscriptions"
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  function updateDisplay() {
    var defaultallow = rpPrefBranch.getBoolPref("defaultPolicy.allow");
    if (defaultallow) {
      $id("defaultallow").checked = true;
      $id("defaultdenysetting").hidden = true;
    } else {
      $id("defaultdeny").checked = true;
      $id("defaultdenysetting").hidden = false;
    }

    var allowsamedomain = rpPrefBranch.getBoolPref(
        "defaultPolicy.allowSameDomain");
    $id("allowsamedomain").checked = allowsamedomain;
  }

  function showManageSubscriptionsLink() {
    $id("subscriptionschanged").style.display = "block";
  }

  window.onload = function() {
    updateDisplay();

    elManager.addListener(
        $id("defaultallow"), "change",
        function(event) {
          var allow = event.target.checked;
          rpPrefBranch.setBoolPref("defaultPolicy.allow", allow);
          Services.prefs.savePrefFile(null);
          // Reload all subscriptions because it's likely that different
          // subscriptions will now be active.
          common.switchSubscriptionPolicies();
          updateDisplay();
          showManageSubscriptionsLink();
        });

    elManager.addListener(
        $id("defaultdeny"), "change",
        function(event) {
          var deny = event.target.checked;
          rpPrefBranch.setBoolPref("defaultPolicy.allow", !deny);
          Services.prefs.savePrefFile(null);
          // Reload all subscriptions because it's likely that different
          // subscriptions will now be active.
          common.switchSubscriptionPolicies();
          updateDisplay();
          showManageSubscriptionsLink();
        });

    elManager.addListener(
        $id("allowsamedomain"), "change",
        function(event) {
          var allowSameDomain = event.target.checked;
          rpPrefBranch.setBoolPref("defaultPolicy.allowSameDomain",
              allowSameDomain);
          Services.prefs.savePrefFile(null);
        });

    // call updateDisplay() every time a preference gets changed
    WinEnv.obMan.observePrefChanges(updateDisplay);
  };

}());
