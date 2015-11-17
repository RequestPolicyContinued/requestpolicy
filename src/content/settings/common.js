
const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/utils/constants",
  "lib/utils/strings",
  "lib/utils/info",
  "lib/utils",
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

/**
 * Get a string representation of an endpoint (origin or dest) specification.
 *
 * The following list shows a mapping of the possible endpoint specs
 * to the corresponding string representation. Each endpoint spec contains at
 * least one of the parts "scheme", "host" and "port". The list shows the
 * strings by example: scheme "http"; host "www.example.com"; port "80".
 *
 * - s__: `scheme "http"`
 * - _h_: `www.example.com`
 * - __p: `*://*:80`
 * - sh_: `http://www.example.com`
 * - s_p: `http://*:80`
 * - _hp: `*://www.example.com:80`
 * - shp: `http://www.example.com:80`
 *
 * TODO: remove code duplication with menu.js
 */
common.ruleDataPartToDisplayString = function (ruleDataPart) {
  if (ruleDataPart["s"] && !ruleDataPart["h"] && !ruleDataPart["port"]) {
    // Special case: Only a scheme is specified.
    //               The result string will be `scheme "..."`.
    // Background info: The string could be `http:*`, but this could however
    //                  be confused with `*://http:*`. The string `http://*`
    //                  wouldn't be correct for all cases, since there are
    //                  URIs _without_ a host.
    return "scheme \"" + ruleDataPart["s"] + "\"";
  }
  var str = "";
  if (ruleDataPart["s"] || ruleDataPart["port"]) {
    str += ruleDataPart["s"] || "*";
    str += "://";
  }
  str += ruleDataPart["h"] || "*";
  if (ruleDataPart["port"]) {
    str += ":" + ruleDataPart["port"];
  }
  // TODO: path
  return str;
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
    var value = rpPrefBranch.getComplexValue(pref, Ci.nsISupportsString).data;
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
