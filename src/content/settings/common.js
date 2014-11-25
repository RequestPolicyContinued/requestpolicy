Components.utils.import("chrome://requestpolicy/content/lib/domain-util.jsm");
Components.utils.import("chrome://requestpolicy/content/lib/Logger.jsm");
Components.utils.import("chrome://requestpolicy/content/lib/Subscription.jsm");
Components.utils.import("chrome://requestpolicy/content/lib/Util.jsm");
Components.utils.import("chrome://requestpolicy/content/lib/PolicyManager.jsm");

var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
    .getService().wrappedJSObject;

var observerService = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);

var stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService);
strbundle = stringBundleService.createBundle(
    "chrome://requestpolicy/locale/requestpolicy.properties");

const COMMON_STRINGS = [
  'preferences',
  'managePolicies',
  'about',
  'help',
  'basic',
  'advanced'
];


function _(msg, args) {
  if (args) {
    args = Array.prototype.slice.call(arguments, 1);
    return strbundle.formatStringFromName(msg, args, args.length);
  } else {
    return strbundle.GetStringFromName(msg);
  }
}

common = {};

/*
 Based on the user's current default policy (allow or deny), swaps out which
 subscriptions are enabled. That is, each subscription are either intended to be
 used with a default allow or a default policy policy. So, if this has changed
 then calling this function will disable/enable the correct subscriptions.
 */
// TODO: rename this function.
common.switchSubscriptionPolicies = function () {
  var subscriptions = new UserSubscriptions();

  var newDefaultPolicy = rpService._defaultAllow ? 'allow' : 'deny';
  var oldDefaultPolicy = rpService._defaultAllow ? 'deny' : 'allow';

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
};

common.getOldRulesAsNewRules = function (addHostWildcard) {
  var origins = common.getPrefObj('allowedOrigins');
  var destinations = common.getPrefObj('allowedDestinations');
  var originsToDestinations = common.getPrefObj('allowedOriginsToDestinations');
  var rules = [];

  function isHostname(host) {
    return !DomainUtil.isValidUri(host) && !DomainUtil.isIPAddress(host);
  }

  for (var origin in origins) {
    var entry = {};
    entry['o'] = {};
    if (DomainUtil.isValidUri(origin)) {
      var uriObj = DomainUtil.getUriObject(origin);
      entry['o']['h'] = uriObj.host;
      entry['o']['s'] = uriObj.scheme;
      if (uriObj.port != -1) {
        entry['o']['port'] = uriObj.port;
      }
    } else {
      entry['o']['h'] = origin.split('/')[0];
    }
    if (entry['o']['h'] && addHostWildcard && isHostname(entry['o']['h'])) {
      entry['o']['h'] = '*.' + entry['o']['h']
    }
    rules.push(entry);
  }

  for (var dest in destinations) {
    entry = {};
    entry['d'] = {};
    if (DomainUtil.isValidUri(dest)) {
      var uriObj = DomainUtil.getUriObject(dest);
      entry['d']['h'] = uriObj.host;
      entry['d']['s'] = uriObj.scheme;
      if (uriObj.port != -1) {
        entry['d']['port'] = uriObj.port;
      }
    } else {
      entry['d']['h'] = dest.split('/')[0];
    }
    if (entry['d']['h'] && addHostWildcard && isHostname(entry['d']['h'])) {
      entry['d']['h'] = '*.' + entry['d']['h']
    }
    rules.push(entry);
  }

  for (var originToDest in originsToDestinations) {
    var parts = originToDest.split('|');
    var origin = parts[0];
    var dest = parts[1];
    entry = {};
    entry['o'] = {};
    entry['d'] = {};

    if (DomainUtil.isValidUri(origin)) {
      var uriObj = DomainUtil.getUriObject(origin);
      entry['o']['h'] = uriObj.host;
      entry['o']['s'] = uriObj.scheme;
      if (uriObj.port != -1) {
        entry['o']['port'] = uriObj.port;
      }
    } else {
      entry['o']['h'] = origin.split('/')[0];
    }
    if (entry['o']['h'] && addHostWildcard && isHostname(entry['o']['h'])) {
      entry['o']['h'] = '*.' + entry['o']['h']
    }

    if (DomainUtil.isValidUri(dest)) {
      var uriObj = DomainUtil.getUriObject(dest);
      entry['d']['h'] = uriObj.host;
      entry['d']['s'] = uriObj.scheme;
      if (uriObj.port != -1) {
        entry['d']['port'] = uriObj.port;
      }
    } else {
      entry['d']['h'] = dest.split('/')[0];
    }
    if (entry['d']['h'] && addHostWildcard && isHostname(entry['d']['h'])) {
      entry['d']['h'] = '*.' + entry['d']['h']
    }

    rules.push(entry);
  }

  return rules;
};

common.getPrefObj = function (pref) {
  try {
    var value = rpService.prefs
        .getComplexValue(pref, Components.interfaces.nsISupportsString).data;
  } catch (e) {
    value = '';
  }
  return common.prefStringToObj(value);
};

common.prefStringToObj = function (prefString) {
  var prefObj = {};
  var prefArray = prefString.split(" ");
  if (prefArray[0] != "") {
    for (var i in prefArray) {
      prefObj[prefArray[i]] = true;
    }
  }
  return prefObj;
};

common.clearPref = function (pref) {
  try {
    if (rpService.prefs.prefHasUserValue(pref)) {
      rpService.prefs.clearUserPref(pref);
    }
  } catch (e) {
    Logger.dump('Clearing pref failed: ' + e.toString());
  }
  rpService._prefService.savePrefFile(null);
};

common.addAllowRules = function (rules) {
  for (var i in rules) {
    var ruleData = rules[i];
    rpService.addAllowRule(ruleData, true);
  }
  rpService.storeRules();
};

common.localize = function(stringNames) {
  stringNames.forEach(function(name) {
    $('[data-string="' + name + '"]').each(function () {
      $(this).text(_(name));
    });
  });
};


common.Observer = function(functionToCall, aTopic) {
  this.topic = aTopic;
  this.observe = functionToCall;
  this.register();
}
common.Observer.prototype.register = function() {
  var observerService = Components.classes["@mozilla.org/observer-service;1"].
      getService(Components.interfaces.nsIObserverService);
  observerService.addObserver(this, this.topic, false);
};
common.Observer.prototype.unregister = function() {
  var observerService = Components.classes["@mozilla.org/observer-service;1"].
      getService(Components.interfaces.nsIObserverService);
  observerService.removeObserver(this, this.topic);
};

common.PrefsChangedObserver = function(functionToCall)
{
  common.Observer.call(this, functionToCall, "requestpolicy-prefs-changed");
}
common.PrefsChangedObserver.prototype = Object.create(common.Observer.prototype);
common.PrefsChangedObserver.prototype.constructor = common.PrefsChangedObserver;

$(function() {
  common.localize(COMMON_STRINGS);
});
