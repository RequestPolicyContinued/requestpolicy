PAGE_STRINGS = [
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

var prefsChangedObserver = null;


function updateDisplay() {
  var defaultallow = Prefs.prefs.getBoolPref('defaultPolicy.allow');
  if (defaultallow) {
    document.getElementById('defaultallow').checked = true;
    document.getElementById('defaultdenysetting').hidden = true;
  } else {
    document.getElementById('defaultdeny').checked = true;
    document.getElementById('defaultdenysetting').hidden = false;
  }

  var allowsamedomain = Prefs.prefs.getBoolPref('defaultPolicy.allowSameDomain');
  document.getElementById('allowsamedomain').checked = allowsamedomain;
}

function showManageSubscriptionsLink() {
  document.getElementById('subscriptionschanged').style.display = 'block';
}

function onload() {
  updateDisplay();

  document.getElementById('defaultallow').addEventListener('change',
      function (event) {
        var allow = event.target.checked;
        Prefs.prefs.setBoolPref('defaultPolicy.allow', allow);
        Services.prefs.savePrefFile(null);
        // Reload all subscriptions because it's likely that different
        // subscriptions will now be active.
        common.switchSubscriptionPolicies();
        updateDisplay();
        showManageSubscriptionsLink();
      }
  );
  document.getElementById('defaultdeny').addEventListener('change',
      function (event) {
        var deny = event.target.checked;
        Prefs.prefs.setBoolPref('defaultPolicy.allow', !deny);
        Services.prefs.savePrefFile(null);
        // Reload all subscriptions because it's likely that different
        // subscriptions will now be active.
        common.switchSubscriptionPolicies();
        updateDisplay();
        showManageSubscriptionsLink();
      }
  );
  document.getElementById('allowsamedomain').addEventListener('change',
      function (event) {
        var allowSameDomain = event.target.checked;
        Prefs.prefs.setBoolPref('defaultPolicy.allowSameDomain',
            allowSameDomain);
        Services.prefs.savePrefFile(null);
      }
  );

  // call updateDisplay() every time a preference gets changed
  ObserverManager.observePrefChanges(updateDisplay);
}
