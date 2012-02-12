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

var EXPORTED_SYMBOLS = ["PolicyManager"];

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


function CheckRequestResult() {
  this.matchedAllowRules = [];
  this.matchedDenyRules = [];
}
CheckRequestResult.prototype = {
  matchedAllowRules : null, 
  matchedDenyRules : null,
  
  isAllowed : function() {
    return this.matchedAllowRules.length > 0;
  },
  isDenied : function () {
    return this.matchedDenyRules.length > 0;
  }
};


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
  
  loadPolicies : function(config) {
    if (!config) {
      config = {};
    }
    
    // The |config| will be some configuration info that includes which
    // subscriptions the user has, which are enabled, how often they are
    // checked for updates, what thier update and info URLs are, etc.
    // The code that creates a PolicyManager would normally read a config
    // file like requestpolicy/config.json, parse the JSON, change or add
    // anything that they might want to alter about the config, then pass
    // the object in here as the argument.
    // TODO: we won't actually hard code this (overriding the argument that
    // was passed in), this is just here for development purposes. 
    // var config = {
    //   "subscriptions" : {
    //     "foo" : {
    //       "name" : "The Foo RP whitelist and blacklist.",
    //       "updateUrls" : {
    //         "http://foo.com/rp.json" : {},
    //       },
    //       "infoUrls" : {
    //         "About" : "http://foo.com/about.html", 
    //       }
    //     }
    //   },
    // };
    
    // TODO: read the active subscriptions from a preference.
    //var activeSubscriptionsPrefValue = "foo|||http://foo/rp.json@@@bar|||@@@";
    //var subscriptions = activeSubscriptionsPrefValue.split();

    // We don't allow any subscriptions that are named "user" and would
    // therefore 
    if ("user" in config) {
      // TODO: log something, this subscription is being ignored.
      delete config["user"];
    }
    
    // Read each subscription from a file.
    var rawPolicy;
    for (var name in config["subscriptions"]) {
      try {
        dprint("PolicyManager::loadPolicies loading subscription policy: " +
               name);
        rawPolicy = requestpolicy.mod.PolicyStorage
              .loadRawPolicyFromFile('sub-' + name + ".json");
      } catch (e) {
        warn("Unable to load policy from file: " + e);
        continue;
      }
      this._subscriptionPolicies[name] = {"rawPolicy" : rawPolicy,
                                          "policy" : rawPolicy.toPolicy(name)};
      this._subscriptionPolicies[name]["policy"].userPolicy = false;
      this._subscriptionPolicies[name].policy.print();
    }

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
    // TODO: make sure they're never stored.
    this.resetTemporaryPolicies();
  },

  _assertRuleType: function(ruleType) {
    if (ruleType != requestpolicy.mod.RULE_TYPE_ALLOW && 
        ruleType != requestpolicy.mod.RULE_TYPE_DENY) {
      throw "Invalid rule type: " + ruleType;
    }
  },

  addRule : function(ruleType, ruleData, noStore) {
    dprint("PolicyManager::addRule " + ruleType + " "
           + requestpolicy.mod.Policy.rawRuleToCanonicalString(ruleData));
    //this._userPolicies["user"].policy.print();
    
    this. _assertRuleType(ruleType);
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
    
    this. _assertRuleType(ruleType);
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

  // TODO: rename this to temporaryRulesExist or invert it to
  // isTemporaryPolicyEmpty()
  temporaryPoliciesExist : function() {
    return this._userPolicies["temp"].rawPolicy.getAllowRuleCount() ||
           this._userPolicies["temp"].rawPolicy.getDenyRuleCount();
  },

  // TODO: rename this to resetTemporaryPolicy
  resetTemporaryPolicies : function() {
    var rawPolicy = new requestpolicy.mod.RawPolicy();
    this._userPolicies["temp"] = {"rawPolicy" : rawPolicy,
                                  "policy" : rawPolicy.toPolicy("temp")};
    this._userPolicies["temp"]["policy"].userPolicy = true;
  },

  checkRequestAgainstUserPolicies : function(origin, dest) {
    return this._checkRequest(origin, dest, this._userPolicies);
  },

  checkRequestAgainstSubscriptionPolicies : function(origin, dest) {
    return this._checkRequest(origin, dest, this._subscriptionPolicies);
  },

  _checkRequest : function(origin, dest, policies) {
    if (!(origin instanceof CI.nsIURI)) {
      throw "Origin must be an nsIURI.";
    }
    if (!(dest instanceof CI.nsIURI)) {
      throw "Destination must be an nsIURI.";
    }
    var result = new CheckRequestResult();
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
