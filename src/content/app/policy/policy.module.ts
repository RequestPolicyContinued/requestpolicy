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

import { App } from "app/interfaces";
import { XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import {C} from "data/constants";
import { MaybePromise } from "lib/classes/maybe-promise";
import {Module} from "lib/classes/module";
import {RequestResult} from "lib/classes/request-result";
import {RawRuleset, Ruleset} from "./ruleset";

export const RULES_CHANGED_TOPIC = "rpcontinued-rules-changed";

declare const Ci: any;
declare const Services: any;
type RuleAction = typeof C.RULE_ACTION_ALLOW | typeof C.RULE_ACTION_DENY;
export type RuleData = any;

function notifyRulesChanged() {
  Services.obs.notifyObservers(null, RULES_CHANGED_TOPIC, null);
}

export class Policy extends Module implements App.IPolicy {
  // protected get debugEnabled() { return true; }

  public userRulesetExistedOnStartup: boolean;
  private userRulesets: any = {};

  protected get subModules() {
    return {
      rulesetStorage: this.rulesetStorage,
      subscriptions: this.subscriptions,
    };
  }

  constructor(
      log: Common.ILog,
      public readonly rulesetStorage: App.policy.IRulesetStorage,
      public readonly subscriptions: App.policy.ISubscriptions,

      private readonly uriService: App.services.IUriService,
  ) {
    super("app.policy", log);
  }

  public getUserRulesets() {
    return this.userRulesets;
  }

  public getUserRuleCount() {
    const rawRuleset = this.userRulesets.user.rawRuleset;
    return rawRuleset.getAllowRuleCount() + rawRuleset.getDenyRuleCount();
  }

  public loadUserRules(): Promise<void> {
    this.log.info("loadUserRules loading user rules");
    const pRawRuleset = this.rulesetStorage.loadRawRulesetFromFile("user");
    const p = pRawRuleset.then((aRawRuleset) => {
      this.userRulesetExistedOnStartup = !!aRawRuleset;
      const rawRuleset = aRawRuleset ||
          RawRuleset.create(this.log, this.uriService);
      this.userRulesets.user = {
        rawRuleset,
        ruleset: rawRuleset.toRuleset("user"),
      },
      this.userRulesets.user.ruleset.userRuleset = true;
      // this.userRulesets.user.ruleset.print();
      // Temporary rules. These are never stored.
      this.revokeTemporaryRules();

      notifyRulesChanged();
      return;
    });
    p.catch(this.log.onError("loadUserRules()"));
    return p;
  }

  public ruleExists(ruleAction: RuleAction, ruleData: RuleData) {
    this.assertRuleAction(ruleAction);
    for (const name in this.userRulesets) {
      if (this.userRulesets[name].rawRuleset.ruleExists(ruleAction, ruleData)) {
        return true;
      }
    }
    const subscriptionRulesets = this.subscriptions.getRulesets();
    // tslint:disable-next-line:forin
    for (const listName in subscriptionRulesets) {
      const rulesets = subscriptionRulesets[listName];
      for (const name in rulesets) {
        if (rulesets[name].rawRuleset.ruleExists(ruleAction, ruleData)) {
          return true;
        }
      }
    }
    return false;
  }

  public addRule(
      ruleAction: RuleAction,
      ruleData: RuleData,
      noStore?: boolean,
  ) {
    this.log.info(
        `addRule ${ruleAction} ${Ruleset.rawRuleToCanonicalString(ruleData)}`,
    );
    // this.userRulesets.user.ruleset.print();

    this.assertRuleAction(ruleAction);
    // TODO: check rule format validity
    this.userRulesets.user.rawRuleset.addRule(
        ruleAction, ruleData,
        this.userRulesets.user.ruleset,
    );

    // TODO: only save if we actually added a rule. This will require
    // modifying |RawRuleset.addRule()| to indicate whether a rule
    // was added.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
      this.rulesetStorage.saveRawRulesetToFile(
          this.userRulesets.user.rawRuleset, "user",
      );
    }

    // this.userRulesets.user.ruleset.print();

    notifyRulesChanged();
  }

  public addRules(
      aRuleAction: RuleAction,
      aRuleDataList: RuleData[],
      aNoStore = false,
  ) {
    for (const ruleData of aRuleDataList) {
      this.addRule(aRuleAction, ruleData, true);
    }
    if (false === aNoStore) {
      this.storeRules();
    }
  }

  public storeRules() {
    this.rulesetStorage.saveRawRulesetToFile(
        this.userRulesets.user.rawRuleset, "user",
    );
  }

  public addTemporaryRule(ruleAction: RuleAction, ruleData: RuleData) {
    this.log.info(`addTemporaryRule ${ruleAction} ${
      Ruleset.rawRuleToCanonicalString(ruleData)}`);
    // this.userRulesets.temp.ruleset.print();

    this.assertRuleAction(ruleAction);
    // TODO: check rule format validity
    this.userRulesets.temp.rawRuleset.addRule(
        ruleAction, ruleData,
        this.userRulesets.temp.ruleset,
    );

    // this.userRulesets.temp.ruleset.print();

    notifyRulesChanged();
  }

  public removeRule(
      ruleAction: RuleAction,
      ruleData: RuleData,
      noStore: boolean,
  ) {
    this.log.info(`removeRule ${ruleAction} ${
      Ruleset.rawRuleToCanonicalString(ruleData)}`);
    // this.userRulesets.user.ruleset.print();
    // this.userRulesets.temp.ruleset.print();

    this.assertRuleAction(ruleAction);
    // TODO: check rule format validity
    // TODO: use noStore
    this.userRulesets.user.rawRuleset.removeRule(
        ruleAction, ruleData,
        this.userRulesets.user.ruleset,
    );
    this.userRulesets.temp.rawRuleset.removeRule(
        ruleAction, ruleData,
        this.userRulesets.temp.ruleset,
    );

    // TODO: only save if we actually removed a rule. This will require
    // modifying |RawRuleset.removeRule()| to indicate whether a rule
    // was removed.
    // TODO: can we do this in the background and add some locking? It will
    // become annoying when there is a large file to write.
    if (!noStore) {
      this.rulesetStorage.saveRawRulesetToFile(
          this.userRulesets.user.rawRuleset, "user",
      );
    }

    // this.userRulesets.user.ruleset.print();
    // this.userRulesets.temp.ruleset.print();

    notifyRulesChanged();
  }

  public temporaryRulesExist() {
    return this.userRulesets.temp.rawRuleset.getAllowRuleCount() ||
           this.userRulesets.temp.rawRuleset.getDenyRuleCount();
  }

  public revokeTemporaryRules() {
    const rawRuleset = RawRuleset.create(this.log, this.uriService);
    this.userRulesets.temp = {
      rawRuleset,
      ruleset: rawRuleset.toRuleset("temp"),
    };
    this.userRulesets.temp.ruleset.userRuleset = true;

    notifyRulesChanged();
  }

  public checkRequestAgainstUserRules(
      origin: XPCOM.nsIURI,
      dest: XPCOM.nsIURI,
  ) {
    return this.checkRequest(origin, dest, this.userRulesets);
  }

  public checkRequestAgainstSubscriptionRules(
      origin: XPCOM.nsIURI,
      dest: XPCOM.nsIURI,
  ) {
    const result = new RequestResult();
    const subscriptionRulesets = this.subscriptions.getRulesets();
    // tslint:disable-next-line:forin
    for (const listName in subscriptionRulesets) {
      const ruleset = subscriptionRulesets[listName];
      this.checkRequest(origin, dest, ruleset, result);
    }
    return result;
  }

  public checkRequest(
      origin: XPCOM.nsIURI,
      dest: XPCOM.nsIURI,
      aRuleset: any,
      aResult?: RequestResult,
  ) {
    if (!(origin instanceof Ci.nsIURI)) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("Origin must be an nsIURI.");
    }
    if (!(dest instanceof Ci.nsIURI)) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("Destination must be an nsIURI.");
    }
    const result = aResult || new RequestResult();
    // tslint:disable-next-line:forin
    for (const name in aRuleset) {
      const {ruleset} = aRuleset[name];
      // ruleset.setPrintFunction(print);
      // ruleset.print();

      // TODO wrap this in a try/catch.
      const [tempAllows, tempDenies] = ruleset.check(origin, dest);
      // I'm not convinced I like appending these [ruleset, matchedRule] arrays,
      // but it works for now.
      for (const tempAllow of tempAllows) {
        result.matchedAllowRules.push([ruleset, tempAllow]);
      }
      for (const tempDeny of tempDenies) {
        result.matchedDenyRules.push([ruleset, tempDeny]);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // alias functions
  // ---------------------------------------------------------------------------

  // tslint:disable:member-ordering
  public addAllowRule = this.addRule.bind(this, C.RULE_ACTION_ALLOW);
  public addTemporaryAllowRule =
      this.addTemporaryRule.bind(this, C.RULE_ACTION_ALLOW);
  public removeAllowRule = this.removeRule.bind(this, C.RULE_ACTION_ALLOW);
  public addDenyRule = this.addRule.bind(this, C.RULE_ACTION_DENY);
  public addTemporaryDenyRule =
      this.addTemporaryRule.bind(this, C.RULE_ACTION_DENY);
  public removeDenyRule = this.removeRule.bind(this, C.RULE_ACTION_DENY);

  public addAllowRules = this.addRules.bind(this, C.RULE_ACTION_ALLOW);
  public addDenyRules = this.addRules.bind(this, C.RULE_ACTION_DENY);
  // tslint:enable:member-ordering

  public getRuleData(aOrigin: string | undefined, aDest: string | undefined) {
    const ruleData: RuleData = {};
    if (aOrigin !== undefined) {
      ruleData.o = {h: aOrigin};
    }
    if (aDest !== undefined) {
      ruleData.d = {h: aDest};
    }
    return ruleData;
  }

  public addRuleBySpec(aSpec: any, noStore?: boolean) {
    const ruleAction = aSpec.allow ? C.RULE_ACTION_ALLOW : C.RULE_ACTION_DENY;
    const ruleData = this.getRuleData(aSpec.origin, aSpec.dest);

    if (aSpec.temp) {
      this.addTemporaryRule(ruleAction, ruleData);
    } else {
      this.addRule(ruleAction, ruleData, noStore);
    }
  }

  // ---------------------------------------------------------------------------
  // protected functions
  // ---------------------------------------------------------------------------

  protected startupSelf() {
    const p = this.loadUserRules();
    return MaybePromise.resolve(p);
  }

  // ---------------------------------------------------------------------------
  // private functions
  // ---------------------------------------------------------------------------

  private assertRuleAction(ruleAction: RuleAction) {
    if (ruleAction !== C.RULE_ACTION_ALLOW &&
        ruleAction !== C.RULE_ACTION_DENY) {
      // eslint-disable-next-line no-throw-literal
      throw new Error(`Invalid rule type: ${ruleAction}`);
    }
  }
}
