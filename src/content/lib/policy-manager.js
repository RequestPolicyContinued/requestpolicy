/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

import {C} from "data/constants";
import {Log} from "models/log";
import {RequestResult} from "lib/request-result";
import {Ruleset, RawRuleset} from "lib/ruleset";
import {RulesetStorage} from "lib/ruleset-storage";

const log = Log.instance.extend({
  name: "PolicyManager",
});

// =============================================================================
// constants
// =============================================================================

export const RULES_CHANGED_TOPIC = "rpcontinued-rules-changed";

const RULESET_NOT_EXISTING = {};

// =============================================================================
// utilities
// =============================================================================

function notifyRulesChanged() {
  Services.obs.notifyObservers(null, RULES_CHANGED_TOPIC, null);
}

// =============================================================================
// PolicyManager
// =============================================================================

let userRulesets = {};
let subscriptionRulesets = {};

/**
 * Provides a simplified interface to handling multiple
 * rulesets, checking requests against multiple rulesets, etc.
 */
export const PolicyManager = {
  getUserRulesets() {
    return userRulesets;
  },
  getSubscriptionRulesets() {
    return subscriptionRulesets;
  },

  getUserRuleCount() {
    let rawRuleset = userRulesets.user.rawRuleset;
    return rawRuleset.getAllowRuleCount() + rawRuleset.getDenyRuleCount();
  },

  loadUserRules() {
    log.info("loadUserRules loading user rules");
    const pRawRuleset = RulesetStorage.loadRawRulesetFromFile("user");
    pRawRuleset.then((aRawRuleset) => {
      this.userRulesetExistedOnStartup = !!aRawRuleset;
      const rawRuleset = aRawRuleset || RawRuleset.create();
      userRulesets.user = {
        "rawRuleset": rawRuleset,
        "ruleset": rawRuleset.toRuleset("user"),
      },
      userRulesets.user.ruleset.userRuleset = true;
      // userRulesets.user.ruleset.print();
      // Temporary rules. These are never stored.
      this.revokeTemporaryRules();

      notifyRulesChanged();
      return;
    }).catch((e) => {
      log.error("PolicyManager.loadUserRules():", e);
    });
  },

  loadSubscriptionRules(subscriptionInfo) {
    let failures = {};
    const promises = [];

    // Read each subscription from a file.
    for (let listName in subscriptionInfo) {
      for (let subName in subscriptionInfo[listName]) {
        log.info(`loadSubscriptionRules: ${listName} / ${subName}`);
        const pRawRuleset = RulesetStorage.
            loadRawRulesetFromFile(subName, listName);
        const pDone = pRawRuleset.then((rawRuleset) => {
          if (!rawRuleset) return Promise.reject(RULESET_NOT_EXISTING);
          if (!subscriptionRulesets[listName]) {
            subscriptionRulesets[listName] = {};
          }
          let list = subscriptionRulesets[listName];
          list[subName] = {
            rawRuleset,
            ruleset: rawRuleset.toRuleset(subName),
          };
          list[subName].ruleset.userRuleset = false;
          // list[subName].ruleset.print();
          return;
        }).catch((e) => {
          if (e === RULESET_NOT_EXISTING) {
            log.warn("Ruleset does not exist (yet).");
          } else {
            log.error("Error when loading ruleset from file: ", e);
          }
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
        });
        promises.push(pDone);
      }
    }

    return Promise.all(promises).then(() => {
      notifyRulesChanged();
      return {failures};
    });
  },

  unloadSubscriptionRules(subscriptionInfo) {
    const failures = {};

    for (let listName in subscriptionInfo) {
      for (let subName in subscriptionInfo[listName]) {
        log.info(`unloadSubscriptionRules: ${listName} / ${subName}`);
        if (!subscriptionRulesets[listName] ||
            !subscriptionRulesets[listName][subName]) {
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
          continue;
        }
        let list = subscriptionRulesets[listName];
        delete list[subName];
      }
    }

    notifyRulesChanged();

    return failures;
  },

  assertRuleAction(ruleAction) {
    if (ruleAction !== C.RULE_ACTION_ALLOW &&
        ruleAction !== C.RULE_ACTION_DENY) {
      // eslint-disable-next-line no-throw-literal
      throw `Invalid rule type: ${ruleAction}`;
    }
  },

  ruleExists(ruleAction, ruleData) {
    this.assertRuleAction(ruleAction);
    for (let name in userRulesets) {
      if (userRulesets[name].rawRuleset.ruleExists(ruleAction, ruleData)) {
        return true;
      }
    }
    for (let listName in subscriptionRulesets) {
      let rulesets = subscriptionRulesets[listName];
      for (let name in rulesets) {
        if (rulesets[name].rawRuleset.ruleExists(ruleAction, ruleData)) {
          return true;
        }
      }
    }
    return false;
  },

  addRule(ruleAction, ruleData, noStore) {
    log.info(
        `addRule ${ruleAction} ${Ruleset.rawRuleToCanonicalString(ruleData)}`
    );
    // userRulesets.user.ruleset.print();

    this.assertRuleAction(ruleAction);
    // TODO: check rule format validity
    userRulesets.user.rawRuleset.addRule(
        ruleAction, ruleData,
        userRulesets.user.ruleset
    );

    // TODO: only save if we actually added a rule. This will require
    // modifying |RawRuleset.addRule()| to indicate whether a rule
    // was added.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
      RulesetStorage.saveRawRulesetToFile(
          userRulesets.user.rawRuleset, "user"
      );
    }

    // userRulesets.user.ruleset.print();

    notifyRulesChanged();
  },

  addRules(aRuleAction, aRuleDataList, aNoStore=false) {
    for (let ruleData of aRuleDataList) {
      PolicyManager.addRule(aRuleAction, ruleData, true);
    }
    if (false === aNoStore) {
      PolicyManager.storeRules();
    }
  },

  storeRules() {
    RulesetStorage.saveRawRulesetToFile(
        userRulesets.user.rawRuleset, "user"
    );
  },

  addTemporaryRule(ruleAction, ruleData) {
    log.info(`addTemporaryRule ${ruleAction} ${
      Ruleset.rawRuleToCanonicalString(ruleData)}`);
    // userRulesets.temp.ruleset.print();

    this.assertRuleAction(ruleAction);
    // TODO: check rule format validity
    userRulesets.temp.rawRuleset.addRule(
        ruleAction, ruleData,
        userRulesets.temp.ruleset
    );

    // userRulesets.temp.ruleset.print();

    notifyRulesChanged();
  },

  removeRule(ruleAction, ruleData, noStore) {
    log.info(`removeRule ${ruleAction} ${
      Ruleset.rawRuleToCanonicalString(ruleData)}`);
    // userRulesets.user.ruleset.print();
    // userRulesets.temp.ruleset.print();

    this.assertRuleAction(ruleAction);
    // TODO: check rule format validity
    // TODO: use noStore
    userRulesets.user.rawRuleset.removeRule(
        ruleAction, ruleData,
        userRulesets.user.ruleset
    );
    userRulesets.temp.rawRuleset.removeRule(
        ruleAction, ruleData,
        userRulesets.temp.ruleset
    );

    // TODO: only save if we actually removed a rule. This will require
    // modifying |RawRuleset.removeRule()| to indicate whether a rule
    // was removed.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
      RulesetStorage.saveRawRulesetToFile(
          userRulesets.user.rawRuleset, "user"
      );
    }

    // userRulesets.user.ruleset.print();
    // userRulesets.temp.ruleset.print();

    notifyRulesChanged();
  },

  temporaryRulesExist() {
    return userRulesets.temp.rawRuleset.getAllowRuleCount() ||
           userRulesets.temp.rawRuleset.getDenyRuleCount();
  },

  revokeTemporaryRules() {
    const rawRuleset = RawRuleset.create();
    userRulesets.temp = {
      "rawRuleset": rawRuleset,
      "ruleset": rawRuleset.toRuleset("temp"),
    };
    userRulesets.temp.ruleset.userRuleset = true;

    notifyRulesChanged();
  },

  checkRequestAgainstUserRules(origin, dest) {
    return this.checkRequest(origin, dest, userRulesets);
  },

  checkRequestAgainstSubscriptionRules(origin, dest) {
    const result = new RequestResult();
    for (let listName in subscriptionRulesets) {
      let ruleset = subscriptionRulesets[listName];
      this.checkRequest(origin, dest, ruleset, result);
    }
    return result;
  },

  checkRequest(origin, dest, aRuleset, aResult) {
    if (!(origin instanceof Ci.nsIURI)) {
      // eslint-disable-next-line no-throw-literal
      throw "Origin must be an nsIURI.";
    }
    if (!(dest instanceof Ci.nsIURI)) {
      // eslint-disable-next-line no-throw-literal
      throw "Destination must be an nsIURI.";
    }
    const result = aResult || new RequestResult();
    for (let name in aRuleset) {
      let {ruleset} = aRuleset[name];
      // ruleset.setPrintFunction(print);
      // ruleset.print();

      // TODO wrap this in a try/catch.
      let [tempAllows, tempDenies] = ruleset.check(origin, dest);
      // I'm not convinced I like appending these [ruleset, matchedRule] arrays,
      // but it works for now.
      for (let tempAllow of tempAllows) {
        result.matchedAllowRules.push([ruleset, tempAllow]);
      }
      for (let tempDeny of tempDenies) {
        result.matchedDenyRules.push([ruleset, tempDeny]);
      }
    }
    return result;
  },
};

// =============================================================================
// PolicyManager (alias functions)
// =============================================================================

const PM = PolicyManager;

Object.assign(PolicyManager, {
  addAllowRule: PM.addRule.bind(PM, C.RULE_ACTION_ALLOW),
  addTemporaryAllowRule: PM.addTemporaryRule.bind(PM, C.RULE_ACTION_ALLOW),
  removeAllowRule: PM.removeRule.bind(PM, C.RULE_ACTION_ALLOW),
  addDenyRule: PM.addRule.bind(PM, C.RULE_ACTION_DENY),
  addTemporaryDenyRule: PM.addTemporaryRule.bind(PM, C.RULE_ACTION_DENY),
  removeDenyRule: PM.removeRule.bind(PM, C.RULE_ACTION_DENY),

  addAllowRules: PM.addRules.bind(PM, C.RULE_ACTION_ALLOW),
  addDenyRules: PM.addRules.bind(PM, C.RULE_ACTION_DENY),

  getRuleData(aOrigin, aDest) {
    let ruleData = {};
    if (aOrigin !== undefined) {
      ruleData.o = {"h": aOrigin};
    }
    if (aDest !== undefined) {
      ruleData.d = {"h": aDest};
    }
    return ruleData;
  },

  addRuleBySpec(aSpec, noStore) {
    const fn = aSpec.temp ? PM.addTemporaryRule : PM.addRule;
    const ruleAction = aSpec.allow ? C.RULE_ACTION_ALLOW : C.RULE_ACTION_DENY;
    const ruleData = this.getRuleData(aSpec.origin, aSpec.dest);

    fn(ruleAction, ruleData, noStore);
  },
});
