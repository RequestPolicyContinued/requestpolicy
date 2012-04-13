Components.utils.import("resource://requestpolicy/Subscription.jsm");

var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
  .getService(Components.interfaces.nsIRequestPolicy);
var rpServiceJSObject = rpService.wrappedJSObject;

var observerService = Components.classes["@mozilla.org/observer-service;1"]
  .getService(Components.interfaces.nsIObserverService);


function updateDisplay() {
  var defaultallow = rpService.prefs.getBoolPref('defaultPolicy.allow');
  if (defaultallow) {
    document.getElementById('defaultallow').checked = true;
    document.getElementById('defaultdenysetting').hidden = true;
  } else {
    document.getElementById('defaultdeny').checked = true;
    document.getElementById('defaultdenysetting').hidden = false;
  }

  var allowsamedomain = rpService.prefs.getBoolPref('defaultPolicy.allowSameDomain');
  document.getElementById('allowsamedomain').checked = allowsamedomain;
}


function switchSubscriptionPolicies() {
  var subscriptions = new UserSubscriptions();

  var newDefaultPolicy = rpServiceJSObject._defaultAllow ? 'allow' : 'deny';
  var oldDefaultPolicy = rpServiceJSObject._defaultAllow ? 'deny' : 'allow';

  var oldSubInfo = subscriptions.getSubscriptionInfo(oldDefaultPolicy);
  for (var listName in oldSubInfo) {
    for (var subName in oldSubInfo[listName]) {
      if (subName.indexOf('allow_') != 0 && subName.indexOf('deny_') != 0) {
        continue;
      }
      var subInfo = {};
      subInfo[listName] = {};
      subInfo[listName][subName] = true;
      observerService.notifyObservers(null, SUBSCRIPTION_REMOVED_TOPIC,
                                      JSON.stringify(subInfo));
    }
  }

  var newSubInfo = subscriptions.getSubscriptionInfo(newDefaultPolicy);
  for (var listName in newSubInfo) {
    for (var subName in newSubInfo[listName]) {
        if (subName.indexOf('allow_') != 0 && subName.indexOf('deny_') != 0) {
        continue;
      }
      var subInfo = {};
      subInfo[listName] = {};
      subInfo[listName][subName] = true;
      observerService.notifyObservers(null, SUBSCRIPTION_ADDED_TOPIC,
                                      JSON.stringify(subInfo));
    }
  }
}


function showManageSubscriptionsLink() {
  document.getElementById('subscriptionschanged').style.display = 'block';
}


function onload() {
  updateDisplay();

  document.getElementById('defaultallow').addEventListener('change',
    function(event) {
      var allow = event.target.checked;
      rpService.prefs.setBoolPref('defaultPolicy.allow', allow);
      rpServiceJSObject._prefService.savePrefFile(null);
      // Reload all subscriptions because it's likely that different
      // subscriptions will now be active.
      switchSubscriptionPolicies();
      updateDisplay();
      showManageSubscriptionsLink();
    }
  );
  document.getElementById('defaultdeny').addEventListener('change',
    function(event) {
      var deny = event.target.checked;
      rpService.prefs.setBoolPref('defaultPolicy.allow', !deny);
      rpServiceJSObject._prefService.savePrefFile(null);
      // Reload all subscriptions because it's likely that different
      // subscriptions will now be active.
      switchSubscriptionPolicies();
      updateDisplay();
      showManageSubscriptionsLink();
    }
  );
  document.getElementById('allowsamedomain').addEventListener('change',
    function(event) {
      var allowSameDomain = event.target.checked;
      rpService.prefs.setBoolPref('defaultPolicy.allowSameDomain',
            allowSameDomain);
      rpServiceJSObject._prefService.savePrefFile(null);
    }
  );
}
