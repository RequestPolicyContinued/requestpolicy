Components.utils.import("resource://requestpolicy/Logger.jsm");
Components.utils.import("resource://requestpolicy/Subscription.jsm");

var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
    .getService(Components.interfaces.nsIRequestPolicy);
var rpServiceJSObject = rpService.wrappedJSObject;

var observerService = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);


/*
 Based on the user's current default policy (allow or deny), swaps out which
 subscriptions are enabled. That is, each subscription are either intended to be
 used with a default allow or a default policy policy. So, if this has changed
 then calling this function will disable/enable the correct subscriptions.
 */
// TODO: rename this function.
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
