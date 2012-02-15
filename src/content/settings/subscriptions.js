Components.utils.import("resource://requestpolicy/Logger.jsm");
Components.utils.import("resource://requestpolicy/Subscription.jsm");

var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
      .getService(Components.interfaces.nsIRequestPolicy);

var rpServiceJSObject = rpService.wrappedJSObject;

var observerService = Components.classes["@mozilla.org/observer-service;1"]
      .getService(Components.interfaces.nsIObserverService);


function updateDisplay() {
  var userSubs = rpServiceJSObject._subscriptions;
  var subsInfo = userSubs.getSubscriptionInfo();
  for (var subName in subsInfo['official']) {
    var el = document.getElementById('sub-' + subName);
    if (!el) {
      throw 'Unable to find element with id: sub-' + subName;
      continue;
    }
    el.checked = true;
  }
}

function onload() {
  updateDisplay();
  var userSubs = rpServiceJSObject._subscriptions;
  var subsInfo = userSubs.getSubscriptionInfo();

  function handleSubscriptionChange(event) {
    var subName = event.target.name;
    var enabled = event.target.checked;
    var subInfo = {};
    subInfo['official'] = {};
    subInfo['official'][subName] = true;
    if (enabled) {
      userSubs.addSubscription('official', subName);
      observerService.notifyObservers(null, SUBSCRIPTION_ADDED_TOPIC,
            JSON.stringify(subInfo));
    } else {
      userSubs.removeSubscription('official', subName);
      observerService.notifyObservers(null, SUBSCRIPTION_REMOVED_TOPIC,
            JSON.stringify(subInfo));
    }
  }

  var available = {
    'embedded' : {},
    'extensions' : {},
    'functionality' : {},
    'mozilla' : {},
    'sameorg' : {},
    'trackers' : {}
  };
  for (var subName in available) {
    var el = document.getElementById('sub-' + subName);
    if (!el) {
      Logger.dump('Skipping unexpected official subName: ' + subName);
      continue;
    }
    el.addEventListener('change', handleSubscriptionChange);
  }
}
