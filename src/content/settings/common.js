
const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/utils/constants",
  "lib/utils/strings",
  "lib/prefs",
  "lib/utils/domains",
  "lib/logger",
  "lib/subscription",
  "lib/policy-manager",
  "main/requestpolicy-service",
  "lib/environment"
], this);

// create a new Environment for this window
var WinEnv = new Environment(ProcessEnvironment, "WinEnv");
// The Environment has to be shut down when the content window gets unloaded.
WinEnv.shutdownOnUnload(window);
// start up right now, as there won't be any startup functions
WinEnv.startup();
var elManager = WinEnv.elManager;


var $id = window.document.getElementById.bind(window.document);


var COMMON_STRINGS = [
  'preferences',
  'managePolicies',
  'about',
  'help',
  'basic',
  'advanced'
];


var $str = StringUtils.$str;

var common = {};

/*
 Based on the user's current default policy (allow or deny), swaps out which
 subscriptions are enabled. That is, each subscription are either intended to be
 used with a default allow or a default policy policy. So, if this has changed
 then calling this function will disable/enable the correct subscriptions.
 */
// TODO: rename this function.
common.switchSubscriptionPolicies = function () {
  var subscriptions = new UserSubscriptions();

  var newDefaultPolicy = Prefs.isDefaultAllow() ? 'allow' : 'deny';
  var oldDefaultPolicy = Prefs.isDefaultAllow() ? 'deny' : 'allow';

  var oldSubInfo = subscriptions.getSubscriptionInfo(oldDefaultPolicy);
  for (var listName in oldSubInfo) {
    for (var subName in oldSubInfo[listName]) {
      if (subName.indexOf('allow_') != 0 && subName.indexOf('deny_') != 0) {
        continue;
      }
      var subInfo = {};
      subInfo[listName] = {};
      subInfo[listName][subName] = true;
      Services.obs.notifyObservers(null, SUBSCRIPTION_REMOVED_TOPIC,
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
      Services.obs.notifyObservers(null, SUBSCRIPTION_ADDED_TOPIC,
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
    var value = prefs.getComplexValue(pref, Ci.nsISupportsString).data;
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
    if (rpPrefBranch.prefHasUserValue(pref)) {
      rpPrefBranch.clearUserPref(pref);
    }
  } catch (e) {
    Logger.dump('Clearing pref failed: ' + e.toString());
  }
  Services.prefs.savePrefFile(null);
};

common.addAllowRules = function (rules) {
  for (var i in rules) {
    var ruleData = rules[i];
    PolicyManager.addAllowRule(ruleData, true);
  }
  PolicyManager.storeRules();
};

common.localize = function(stringNames) {
  stringNames.forEach(function(name) {
    $('[data-string="' + name + '"]').each(function () {
      $(this).text($str(name));
    });
  });
};



$(function() {
  common.localize(COMMON_STRINGS);
});
