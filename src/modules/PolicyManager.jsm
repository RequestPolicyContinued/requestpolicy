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
  this._policies = {};
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
        rawPolicy = requestpolicy.mod.PolicyStorage
              .loadRawPolicyFromFile(name + ".json");
      } catch (e) {
        warn("Unable to load policy from file: " + e);
        continue;
      }
      this._policies[name] = {"rawPolicy" : rawPolicy,
                              "policy" : rawPolicy.toPolicy(name)};     
    }

    // Read the user policy from a file.
    try {
      rawPolicy = requestpolicy.mod.PolicyStorage
            .loadRawPolicyFromFile("user.json");
    } catch (e) {
      // TODO: log a message about missing user.json policy file.
      // There's no user policy. This is either because RP has just been
      // installed, the file has been deleted, or something is wrong. For now,
      // we'll assume this is a new install.
      rawPolicy = new requestpolicy.mod.RawPolicy();
    }
    this._policies["user"] = {"rawPolicy" : rawPolicy,
                              "policy" : rawPolicy.toPolicy("user")};
    
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
    this._policies["user"].policy.print();
    
    this. _assertRuleType(ruleType);
    // TODO: check rule format validity
    this._policies["user"].rawPolicy.addRule(ruleType, ruleData,
          this._policies["user"].policy);
          
    // TODO: only save if we actually added a rule. This will require
    // modifying |RawPolicy.addRule()| to indicate whether a rule
    // was added.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
        requestpolicy.mod.PolicyStorage.saveRawPolicyToFile(
              this._policies["user"].rawPolicy, "user.json");
    }
          
    this._policies["user"].policy.print();
  },
  
  addTemporaryRule : function(ruleType, ruleData) {
    dprint("PolicyManager::addTemporaryRule " + ruleType + " "
           + requestpolicy.mod.Policy.rawRuleToCanonicalString(ruleData));
    this._policies["temp"].policy.print();
    
    this._assertRuleType(ruleType);
    // TODO: check rule format validity
    this._policies["temp"].rawPolicy.addRule(ruleType, ruleData,
          this._policies["temp"].policy);
          
    this._policies["temp"].policy.print();
  },

  removeRule : function(ruleType, ruleData, noStore) {
    dprint("PolicyManager::removeRule " + ruleType + " "
           + requestpolicy.mod.Policy.rawRuleToCanonicalString(ruleData));
    this._policies["user"].policy.print();
    this._policies["temp"].policy.print();
    
    this. _assertRuleType(ruleType);
    // TODO: check rule format validity
    // TODO: use noStore
    this._policies["user"].rawPolicy.removeRule(ruleType, ruleData,
          this._policies["user"].policy);
    this._policies["temp"].rawPolicy.removeRule(ruleType, ruleData,
          this._policies["temp"].policy);

    // TODO: only save if we actually removed a rule. This will require
    // modifying |RawPolicy.removeRule()| to indicate whether a rule
    // was removed.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
        requestpolicy.mod.PolicyStorage.saveRawPolicyToFile(
              this._policies["user"].rawPolicy, "user.json");
    }

    this._policies["user"].policy.print();
    this._policies["temp"].policy.print();
  },

  temporaryPoliciesExist : function() {
    return this._policies["temp"].rawPolicy.getAllowRuleCount() ||
           this._policies["temp"].rawPolicy.getDenyRuleCount();
  },

  resetTemporaryPolicies : function() {
    var rawPolicy = new requestpolicy.mod.RawPolicy();
    this._policies["temp"] = {"rawPolicy" : rawPolicy,
                              "policy" : rawPolicy.toPolicy("temp")};
  },

  checkRequest : function(origin, dest) {
    if (!(origin instanceof CI.nsIURI)) {
      throw "Origin must be an nsIURI.";
    }
    if (!(dest instanceof CI.nsIURI)) {
      throw "Destination must be an nsIURI.";
    }
    var result = new CheckRequestResult();
    for (var i in this._policies) {
      var policy = this._policies[i].policy;
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





















