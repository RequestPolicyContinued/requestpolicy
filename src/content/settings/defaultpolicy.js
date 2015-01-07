var PAGE_STRINGS = [
  'yourPolicy',
  'defaultPolicy',
  'subscriptions',
  'allowRequestsByDefault',
  'blockRequestsByDefault',
  'defaultPolicyDefinition',
  'learnMore',
  'allowRequestsToTheSameDomain',
  'differentSubscriptionsAreAvailable',
  'manageSubscriptions'
];

$(function () {
  common.localize(PAGE_STRINGS);
});

Cu.import("resource://gre/modules/Services.jsm");


function updateDisplay() {
  var defaultallow = rpPrefBranch.getBoolPref('defaultPolicy.allow');
  if (defaultallow) {
    $id('defaultallow').checked = true;
    $id('defaultdenysetting').hidden = true;
  } else {
    $id('defaultdeny').checked = true;
    $id('defaultdenysetting').hidden = false;
  }

  var allowsamedomain = rpPrefBranch.getBoolPref('defaultPolicy.allowSameDomain');
  $id('allowsamedomain').checked = allowsamedomain;
}

function showManageSubscriptionsLink() {
  $id('subscriptionschanged').style.display = 'block';
}

function onload() {
  updateDisplay();

  $id('defaultallow').addEventListener('change',
      function (event) {
        var allow = event.target.checked;
        rpPrefBranch.setBoolPref('defaultPolicy.allow', allow);
        Services.prefs.savePrefFile(null);
        // Reload all subscriptions because it's likely that different
        // subscriptions will now be active.
        common.switchSubscriptionPolicies();
        updateDisplay();
        showManageSubscriptionsLink();
      }
  );
  $id('defaultdeny').addEventListener('change',
      function (event) {
        var deny = event.target.checked;
        rpPrefBranch.setBoolPref('defaultPolicy.allow', !deny);
        Services.prefs.savePrefFile(null);
        // Reload all subscriptions because it's likely that different
        // subscriptions will now be active.
        common.switchSubscriptionPolicies();
        updateDisplay();
        showManageSubscriptionsLink();
      }
  );
  $id('allowsamedomain').addEventListener('change',
      function (event) {
        var allowSameDomain = event.target.checked;
        rpPrefBranch.setBoolPref('defaultPolicy.allowSameDomain',
            allowSameDomain);
        Services.prefs.savePrefFile(null);
      }
  );

  // call updateDisplay() every time a preference gets changed
  WinEnv.obMan.observePrefChanges(updateDisplay);
}
