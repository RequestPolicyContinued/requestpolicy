/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

var EXPORTED_SYMBOLS = ["PolicyManager", "CheckRequestResult", "Destination",
  "REQUEST_TYPE_NORMAL",
  "REQUEST_TYPE_REDIRECT",
  "REQUEST_REASON_USER_POLICY",
  "REQUEST_REASON_SUBSCRIPTION_POLICY",
  "REQUEST_REASON_DEFAULT_POLICY",
  "REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES",
  "REQUEST_REASON_DEFAULT_SAME_DOMAIN",
  "REQUEST_REASON_COMPATIBILITY"
];

const CI = Components.interfaces;
const CC = Components.classes;

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/Logger.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Policy.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/PolicyStorage.jsm",
    requestpolicy.mod);


function dprint(msg) {
  if (typeof print == "function") {
    print(msg);
  } else {
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_POLICY, msg);
  }
}

function warn(msg) {
  requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_POLICY, msg);
}


// XXX: Subscriptions need an option to be "blacklist-only" so that users
// can subscribe to one as blacklist-only and know that a malicious or
// insecure-http-retrieved update can't result in any whitelisting the
// user didn't want.

// XXX: Maybe how we deal with users wanting to override (ignore) a specific
// rule of a specific list is to add a section to their user config which has
// the ignored rules. Then whenever a rule matches, we check the ignored rules
// list to see if it was an ignored rule before using the rule. That is, this
// would probably be more startup time efficient than going through the lists
// at load time and having to remove them, then having to remove them again
// after an update.


const REQUEST_TYPE_NORMAL = 1;
const REQUEST_TYPE_REDIRECT = 2;
const REQUEST_REASON_USER_POLICY         = 1;
const REQUEST_REASON_SUBSCRIPTION_POLICY = 2;
const REQUEST_REASON_DEFAULT_POLICY      = 3;
const REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES = 4; // if there are allow _and_ deny rules for the same request
const REQUEST_REASON_DEFAULT_SAME_DOMAIN = 5;
const REQUEST_REASON_COMPATIBILITY       = 6;
// TODO: add more types


/**
 * CheckRequestResult objects are used to hand over the result of a check
 * whether a request is allowed or not. Sometimes only the boolean value of
 * isAllowed is needed; in that case the other arguments may be unused.
 */
function CheckRequestResult(isAllowed, requestType, resultReason) {
  this.matchedAllowRules = [];
  this.matchedDenyRules = [];

  this.isAllowed = isAllowed;
  this.requestType = requestType;
  this.resultReason = resultReason;
}
CheckRequestResult.prototype = {
  matchedAllowRules : null,
  matchedDenyRules : null,

  isAllowed : undefined,  // whether the request will be or has been allowed
  requestType : undefined,
  resultReason : undefined,

  allowRulesExist : function() {
    return this.matchedAllowRules.length > 0;
  },
  denyRulesExist : function () {
    return this.matchedDenyRules.length > 0;
  },

  isDefaultPolicyUsed : function () {
    // returns whether the default policy has been or will be used for this request.
    return (this.resultReason == REQUEST_REASON_DEFAULT_POLICY ||
            this.resultReason == REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES ||
            this.resultReason == REQUEST_REASON_DEFAULT_SAME_DOMAIN);
  }
};



/**
 * Destination objects are used to hand over not only "destination" strings, like
 * "example.com", but also properties which might be useful to display more
 * information on the GUI.
 */
function Destination(dest, properties) {
  this.dest = dest;

  if (properties != undefined) {
    this.properties = properties;
  } else {
    this.properties = [];
  }
}
Destination.prototype = {
  dest : null,
  properties : null
};

/**
 * @static
 */
Destination.existsInArray = function (destString, dests) {
  // check if the Array of Destination objects (dests) contains the destination string.
  if (destString instanceof Destination) {
    destString = destString.dest;
  }
  for (var i in dests) {
    if (dests[i].dest == destString) {
      return true;
    }
  }
  return false;
}

/**
 * compare functions used to sort an Array of Destination objects.
 *
 * @static
 */
Destination.sortByNumRequestsCompareFunction = function (a, b) {
  return Destination.compareFunction(a, b, "sortByNumRequests");
}
Destination.compareFunction = function (a, b, sortType) {
  var a_default = (a.properties.numDefaultPolicyRequests > 0);
  var b_default = (b.properties.numDefaultPolicyRequests > 0);

  if (a_default !== b_default) {
    if (a_default === true) {
      // default-policy destinations first.
      return -1;
    } else {
      return 1
    }
  }

  if (sortType == "sortByNumRequests") {
    if (a.properties.numRequests > b.properties.numRequests) {
      return -1;
    }
    if (a.properties.numRequests < b.properties.numRequests) {
      return 1;
    }
  }


  if (a.dest > b.dest) {
    return 1;
  }
  if (a.dest < b.dest) {
    return -1;
  }
  return 0;
}



/**
 * Provides a simplified interface to handling multiple
 * policies, checking requests against multiple policies, etc.
 */
function PolicyManager() {
  this._userPolicies = {};
  this._subscriptionPolicies = {};
}
PolicyManager.prototype = {

  //_policies : null,

  getUserPolicyRuleCount : function() {
    return this._userPolicies["user"]["rawPolicy"].getAllowRuleCount() +
        this._userPolicies["user"]["rawPolicy"].getDenyRuleCount();
  },

  loadUserPolicies : function() {
    // Read the user policy from a file.
    try {
      dprint("PolicyManager::loadPolicies loading user policy");
      rawPolicy = requestpolicy.mod.PolicyStorage
        .loadRawPolicyFromFile("user.json");
    } catch (e) {
      // TODO: log a message about missing user.json policy file.
      // There's no user policy. This is either because RP has just been
      // installed, the file has been deleted, or something is wrong. For now,
      // we'll assume this is a new install.
      rawPolicy = new requestpolicy.mod.RawPolicy();
    }
    this._userPolicies["user"] = {"rawPolicy" : rawPolicy,
      "policy" : rawPolicy.toPolicy("user")};
    this._userPolicies["user"]["policy"].userPolicy = true;
    this._userPolicies["user"].policy.print();
    // Temporary rules. These are never stored.
    this.resetTemporaryPolicy();
  },

  loadSubscriptionPolicies : function(subscriptionInfo) {
    var failures = {};

    // Read each subscription from a file.
    var rawPolicy;
    for (var listName in subscriptionInfo) {
      for (var subName in subscriptionInfo[listName]) {
        try {
          dprint("PolicyManager::loadSubscriptionPolicies: " +
                 listName + ' / ' + subName);
          rawPolicy = requestpolicy.mod.PolicyStorage
                .loadRawPolicyFromFile(subName + ".json", listName);
        } catch (e) {
          warn("Unable to load policy from file: " + e);
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
          continue;
        }
        if (!this._subscriptionPolicies[listName]) {
          this._subscriptionPolicies[listName] = {};
        }
        var list = this._subscriptionPolicies[listName];
        list[subName] = {"rawPolicy" : rawPolicy,
                         "policy" : rawPolicy.toPolicy(subName)};
        list[subName]["policy"].userPolicy = false;
        list[subName].policy.print();
      }
    }

    return failures;
  },

  unloadSubscriptionPolicies : function(subscriptionInfo) {
    var failures = {};

    for (var listName in subscriptionInfo) {
      for (var subName in subscriptionInfo[listName]) {
        dprint("PolicyManager::unloadSubscriptionPolicies: " +
                 listName + ' / ' + subName);
        if (!this._subscriptionPolicies[listName] ||
            !this._subscriptionPolicies[listName][subName]) {
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
          continue;
        }
        var list = this._subscriptionPolicies[listName];
        delete list[subName];
      }
    }

    return failures;
  },

  _assertRuleType: function(ruleType) {
    if (ruleType != requestpolicy.mod.RULE_TYPE_ALLOW &&
        ruleType != requestpolicy.mod.RULE_TYPE_DENY) {
      throw "Invalid rule type: " + ruleType;
    }
  },

  ruleExists : function(ruleType, ruleData) {
    this._assertRuleType(ruleType);
    for (var name in this._userPolicies) {
      if (this._userPolicies[name].rawPolicy.ruleExists(ruleType, ruleData)) {
        return true;
      }
    }
    for (var listName in this._subscriptionPolicies) {
      var policies = this._subscriptionPolicies[listName];
      for (var name in policies) {
        if (policies[name].rawPolicy.ruleExists(ruleType, ruleData)) {
          return true;
        }
      }
    }
    return false;
  },

  addRule : function(ruleType, ruleData, noStore) {
    dprint("PolicyManager::addRule " + ruleType + " "
           + requestpolicy.mod.Policy.rawRuleToCanonicalString(ruleData));
    //this._userPolicies["user"].policy.print();

    this._assertRuleType(ruleType);
    // TODO: check rule format validity
    this._userPolicies["user"].rawPolicy.addRule(ruleType, ruleData,
          this._userPolicies["user"].policy);

    // TODO: only save if we actually added a rule. This will require
    // modifying |RawPolicy.addRule()| to indicate whether a rule
    // was added.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
        requestpolicy.mod.PolicyStorage.saveRawPolicyToFile(
              this._userPolicies["user"].rawPolicy, "user.json");
    }

    //this._userPolicies["user"].policy.print();
  },

  storeRules : function() {
    requestpolicy.mod.PolicyStorage.saveRawPolicyToFile(
        this._userPolicies["user"].rawPolicy, "user.json");
  },

  addTemporaryRule : function(ruleType, ruleData) {
    dprint("PolicyManager::addTemporaryRule " + ruleType + " "
           + requestpolicy.mod.Policy.rawRuleToCanonicalString(ruleData));
    //this._userPolicies["temp"].policy.print();

    this._assertRuleType(ruleType);
    // TODO: check rule format validity
    this._userPolicies["temp"].rawPolicy.addRule(ruleType, ruleData,
          this._userPolicies["temp"].policy);

    //this._userPolicies["temp"].policy.print();
  },

  removeRule : function(ruleType, ruleData, noStore) {
    dprint("PolicyManager::removeRule " + ruleType + " "
           + requestpolicy.mod.Policy.rawRuleToCanonicalString(ruleData));
    //this._userPolicies["user"].policy.print();
    //this._userPolicies["temp"].policy.print();

    this._assertRuleType(ruleType);
    // TODO: check rule format validity
    // TODO: use noStore
    this._userPolicies["user"].rawPolicy.removeRule(ruleType, ruleData,
          this._userPolicies["user"].policy);
    this._userPolicies["temp"].rawPolicy.removeRule(ruleType, ruleData,
          this._userPolicies["temp"].policy);

    // TODO: only save if we actually removed a rule. This will require
    // modifying |RawPolicy.removeRule()| to indicate whether a rule
    // was removed.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
        requestpolicy.mod.PolicyStorage.saveRawPolicyToFile(
              this._userPolicies["user"].rawPolicy, "user.json");
    }

    //this._userPolicies["user"].policy.print();
    //this._userPolicies["temp"].policy.print();
  },

  temporaryRulesExist : function() {
    return this._userPolicies["temp"].rawPolicy.getAllowRuleCount() ||
           this._userPolicies["temp"].rawPolicy.getDenyRuleCount();
  },

  resetTemporaryPolicy : function() {
    var rawPolicy = new requestpolicy.mod.RawPolicy();
    this._userPolicies["temp"] = {"rawPolicy" : rawPolicy,
                                  "policy" : rawPolicy.toPolicy("temp")};
    this._userPolicies["temp"]["policy"].userPolicy = true;
  },

  checkRequestAgainstUserPolicies : function(origin, dest) {
    return this._checkRequest(origin, dest, this._userPolicies);
  },

  checkRequestAgainstSubscriptionPolicies : function(origin, dest) {
    var result = new CheckRequestResult();
    for (var listName in this._subscriptionPolicies) {
      var policies = this._subscriptionPolicies[listName];
      this._checkRequest(origin, dest, policies, result);
    }
    return result;
  },

  _checkRequest : function(origin, dest, policies, result) {
    if (!(origin instanceof CI.nsIURI)) {
      throw "Origin must be an nsIURI.";
    }
    if (!(dest instanceof CI.nsIURI)) {
      throw "Destination must be an nsIURI.";
    }
    if (!result) {
      result = new CheckRequestResult();
    }
    for (var i in policies) {
      var policy = policies[i].policy;
      //policy.setPrintFunction(print);
      //policy.print();
      var tempAllow, tempDeny;
      // TODO wrap this in a try/catch.
      [tempAllow, tempDeny] = policy.check(origin, dest);
      // I'm not convinced I like appending these [policy, matchedRule] arrays,
      // but it works for now.
      for (var i in tempAllow) {
        result.matchedAllowRules.push([policy, tempAllow[i]]);
      }
      for (var i in tempDeny) {
        result.matchedDenyRules.push([policy, tempDeny[i]]);
      }
    }
    return result;
  }

};
