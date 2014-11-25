/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
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

var EXPORTED_SYMBOLS = [
  "PolicyManager",
  "RULES_CHANGED_TOPIC"
];

const CI = Components.interfaces;
const CC = Components.classes;

const RULES_CHANGED_TOPIC = "requestpolicy-rules-changed";

if (!rp) {
  var rp = {mod : {}};
}

Components.utils.import("chrome://requestpolicy/content/lib/Logger.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/Ruleset.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/RulesetStorage.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/RequestResult.jsm", rp.mod);


function dprint(msg) {
  if (typeof print == "function") {
    print(msg);
  } else {
    rp.mod.Logger.info(rp.mod.Logger.TYPE_POLICY, msg);
  }
}

function warn(msg) {
  rp.mod.Logger.warning(rp.mod.Logger.TYPE_POLICY, msg);
}

function notifyRulesChanged() {
  var observerService = Components.classes["@mozilla.org/observer-service;1"].
      getService(Components.interfaces.nsIObserverService);
  observerService.notifyObservers(null, RULES_CHANGED_TOPIC, null);
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





/**
 * Provides a simplified interface to handling multiple
 * rulesets, checking requests against multiple rulesets, etc.
 */
function PolicyManager() {
  this._userRulesets = {};
  this._subscriptionRulesets = {};
}
PolicyManager.prototype = {

  //_rulesets : null,

  getUserRuleCount : function() {
    return this._userRulesets["user"]["rawRuleset"].getAllowRuleCount() +
        this._userRulesets["user"]["rawRuleset"].getDenyRuleCount();
  },

  loadUserRules : function() {
    // Read the user rules from a file.
    try {
      dprint("PolicyManager::loadUserRules loading user rules");
      rawRuleset = rp.mod.RulesetStorage.loadRawRulesetFromFile("user.json");
    } catch (e) {
      // TODO: log a message about missing user.json ruleset file.
      // There's no user ruleset. This is either because RP has just been
      // installed, the file has been deleted, or something is wrong. For now,
      // we'll assume this is a new install.
      rawRuleset = new rp.mod.RawRuleset();
    }
    this._userRulesets["user"] = {
      "rawRuleset" : rawRuleset,
      "ruleset" : rawRuleset.toRuleset("user")
    };
    this._userRulesets["user"]["ruleset"].userRuleset = true;
    this._userRulesets["user"].ruleset.print();
    // Temporary rules. These are never stored.
    this.revokeTemporaryRules();

    notifyRulesChanged();
  },

  loadSubscriptionRules : function(subscriptionInfo) {
    var failures = {};

    // Read each subscription from a file.
    var rawRuleset;
    for (var listName in subscriptionInfo) {
      for (var subName in subscriptionInfo[listName]) {
        try {
          dprint("PolicyManager::loadSubscriptionRules: " +
                 listName + ' / ' + subName);
          rawRuleset = rp.mod.RulesetStorage
              .loadRawRulesetFromFile(subName + ".json", listName);
        } catch (e) {
          warn("Unable to load ruleset from file: " + e);
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
          continue;
        }
        if (!this._subscriptionRulesets[listName]) {
          this._subscriptionRulesets[listName] = {};
        }
        var list = this._subscriptionRulesets[listName];
        list[subName] = {
          "rawRuleset" : rawRuleset,
          "ruleset" : rawRuleset.toRuleset(subName)
        };
        list[subName]["ruleset"].userRuleset = false;
        list[subName].ruleset.print();
      }
    }

    notifyRulesChanged();

    return failures;
  },

  unloadSubscriptionRules : function(subscriptionInfo) {
    var failures = {};

    for (var listName in subscriptionInfo) {
      for (var subName in subscriptionInfo[listName]) {
        dprint("PolicyManager::unloadSubscriptionRules: " +
                 listName + ' / ' + subName);
        if (!this._subscriptionRulesets[listName] ||
            !this._subscriptionRulesets[listName][subName]) {
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
          continue;
        }
        var list = this._subscriptionRulesets[listName];
        delete list[subName];
      }
    }

    notifyRulesChanged();

    return failures;
  },

  _assertRuleAction : function(ruleAction) {
    if (ruleAction != rp.mod.RULE_ACTION_ALLOW &&
        ruleAction != rp.mod.RULE_ACTION_DENY) {
      throw "Invalid rule type: " + ruleAction;
    }
  },

  ruleExists : function(ruleAction, ruleData) {
    this._assertRuleAction(ruleAction);
    for (var name in this._userRulesets) {
      if (this._userRulesets[name].rawRuleset.ruleExists(ruleAction, ruleData)) {
        return true;
      }
    }
    for (var listName in this._subscriptionRulesets) {
      var rulesets = this._subscriptionRulesets[listName];
      for (var name in rulesets) {
        if (rulesets[name].rawRuleset.ruleExists(ruleAction, ruleData)) {
          return true;
        }
      }
    }
    return false;
  },

  addRule : function(ruleAction, ruleData, noStore) {
    dprint("PolicyManager::addRule " + ruleAction + " "
           + rp.mod.Ruleset.rawRuleToCanonicalString(ruleData));
    //this._userRulesets["user"].ruleset.print();

    this._assertRuleAction(ruleAction);
    // TODO: check rule format validity
    this._userRulesets["user"].rawRuleset.addRule(ruleAction, ruleData,
          this._userRulesets["user"].ruleset);

    // TODO: only save if we actually added a rule. This will require
    // modifying |RawRuleset.addRule()| to indicate whether a rule
    // was added.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
        rp.mod.RulesetStorage.saveRawRulesetToFile(
            this._userRulesets["user"].rawRuleset, "user.json");
    }

    //this._userRulesets["user"].ruleset.print();

    notifyRulesChanged();
  },

  storeRules : function() {
    rp.mod.RulesetStorage.saveRawRulesetToFile(
        this._userRulesets["user"].rawRuleset, "user.json");
  },

  addTemporaryRule : function(ruleAction, ruleData) {
    dprint("PolicyManager::addTemporaryRule " + ruleAction + " "
           + rp.mod.Ruleset.rawRuleToCanonicalString(ruleData));
    //this._userRulesets["temp"].ruleset.print();

    this._assertRuleAction(ruleAction);
    // TODO: check rule format validity
    this._userRulesets["temp"].rawRuleset.addRule(ruleAction, ruleData,
          this._userRulesets["temp"].ruleset);

    //this._userRulesets["temp"].ruleset.print();

    notifyRulesChanged();
  },

  removeRule : function(ruleAction, ruleData, noStore) {
    dprint("PolicyManager::removeRule " + ruleAction + " "
           + rp.mod.Ruleset.rawRuleToCanonicalString(ruleData));
    //this._userRulesets["user"].ruleset.print();
    //this._userRulesets["temp"].ruleset.print();

    this._assertRuleAction(ruleAction);
    // TODO: check rule format validity
    // TODO: use noStore
    this._userRulesets["user"].rawRuleset.removeRule(ruleAction, ruleData,
          this._userRulesets["user"].ruleset);
    this._userRulesets["temp"].rawRuleset.removeRule(ruleAction, ruleData,
          this._userRulesets["temp"].ruleset);

    // TODO: only save if we actually removed a rule. This will require
    // modifying |RawRuleset.removeRule()| to indicate whether a rule
    // was removed.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
        rp.mod.RulesetStorage.saveRawRulesetToFile(
              this._userRulesets["user"].rawRuleset, "user.json");
    }

    //this._userRulesets["user"].ruleset.print();
    //this._userRulesets["temp"].ruleset.print();

    notifyRulesChanged();
  },

  temporaryRulesExist : function() {
    return this._userRulesets["temp"].rawRuleset.getAllowRuleCount() ||
           this._userRulesets["temp"].rawRuleset.getDenyRuleCount();
  },

  revokeTemporaryRules : function() {
    var rawRuleset = new rp.mod.RawRuleset();
    this._userRulesets["temp"] = {
      "rawRuleset" : rawRuleset,
      "ruleset" : rawRuleset.toRuleset("temp")
    };
    this._userRulesets["temp"]["ruleset"].userRuleset = true;

    notifyRulesChanged();
  },

  checkRequestAgainstUserRules : function(origin, dest) {
    return this._checkRequest(origin, dest, this._userRulesets);
  },

  checkRequestAgainstSubscriptionRules : function(origin, dest) {
    var result = new rp.mod.RequestResult();
    for (var listName in this._subscriptionRulesets) {
      var ruleset = this._subscriptionRulesets[listName];
      this._checkRequest(origin, dest, ruleset, result);
    }
    return result;
  },

  _checkRequest : function(origin, dest, aRuleset, result) {
    if (!(origin instanceof CI.nsIURI)) {
      throw "Origin must be an nsIURI.";
    }
    if (!(dest instanceof CI.nsIURI)) {
      throw "Destination must be an nsIURI.";
    }
    if (!result) {
      result = new rp.mod.RequestResult();
    }
    for (var i in aRuleset) {
      var ruleset = aRuleset[i].ruleset;
      //ruleset.setPrintFunction(print);
      //ruleset.print();
      var tempAllow, tempDeny;
      // TODO wrap this in a try/catch.
      [tempAllow, tempDeny] = ruleset.check(origin, dest);
      // I'm not convinced I like appending these [ruleset, matchedRule] arrays,
      // but it works for now.
      for (var i in tempAllow) {
        result.matchedAllowRules.push([ruleset, tempAllow[i]]);
      }
      for (var i in tempDeny) {
        result.matchedDenyRules.push([ruleset, tempDeny[i]]);
      }
    }
    return result;
  }

};
