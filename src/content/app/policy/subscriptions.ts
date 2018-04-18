/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
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
import { IListenInterface } from "lib/classes/listeners";
import { Module } from "lib/classes/module";
import {MainEnvironment} from "lib/environment";
import {
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
  SUBSCRIPTION_UPDATED_TOPIC,
  UserSubscriptions,
  UserSubscriptionsInfo,
} from "lib/subscription";
import {createListenersMap} from "lib/utils/listener-factories";
import {RulesetStorage} from "./ruleset-storage";

const RULESET_NOT_EXISTING = {};

type Failures = any;
interface IFailures { failures: Failures; }
type Serials = any;
type SubscriptionRulesets = any;

export class Subscriptions extends Module {
  public onRulesChanged: IListenInterface;

  private subscriptions: UserSubscriptions;
  private subscriptionRulesets: SubscriptionRulesets = {};
  private events = createListenersMap(["onRulesChanged"]);

  constructor(
      log: App.ILog,
      private rulesetStorage: RulesetStorage,
  ) {
    super("rules", log);

    this.onRulesChanged = this.events.interfaces.onRulesChanged;

  }

  public getRulesets() {
    return this.subscriptionRulesets;
  }

  public loadSubscriptionRules() {
    const pDone = browser.storage.local.get(
        "subscriptions",
    ).then((result) => {
      const rawData = result.hasOwnProperty("subscriptions") ?
        result.subscriptions : undefined;
      this.subscriptions = UserSubscriptions.create(rawData);
      return this.loadSubscriptionRulesFromSubInfo(
          this.subscriptions.getSubscriptionInfo(),
      );
    }).then(({failures}) => {
      // TODO: check a preference that indicates the last time we checked for
      // updates. Don't do it if we've done it too recently.
      // TODO: Maybe we should probably ship snapshot versions of the official
      // rulesets so that they can be available immediately after installation.
      const serials: Serials = {};
      // tslint:disable-next-line:forin
      for (const listName in failures) {
        serials[listName] = {};
        // tslint:disable-next-line:forin
        for (const subName in failures[listName]) {
          serials[listName][subName] = -1;
        }
      }
      // tslint:disable-next-line:forin
      for (const listName in this.subscriptionRulesets) {
        // tslint:disable-next-line:forin
        for (const subName in this.subscriptionRulesets[listName]) {
          if (!serials[listName]) {
            serials[listName] = {};
          }
          const {rawRuleset} = this.subscriptionRulesets[listName][subName];
          serials[listName][subName] = rawRuleset.metadata.serial;
        }
      }
      this.subscriptions.update((result) => {
        this.log.info(`Subscription updates completed: ${result}`);
      }, serials);
      return;
    });
    pDone.catch((e) => {
      this.log.error("loadConfigAndRules():", e);
    });
    return pDone;
  }

  public loadSubscriptionRulesFromSubInfo(
      subscriptionInfo: UserSubscriptionsInfo,
  ): Promise<IFailures> {
    const failures: Failures = {};
    const promises: Array<Promise<void>> = [];

    // Read each subscription from a file.
    // tslint:disable-next-line:forin
    for (const listName in subscriptionInfo) {
      // tslint:disable-next-line:forin
      for (const subName in subscriptionInfo[listName]) {
        this.log.info(`loadSubscriptionRules: ${listName} / ${subName}`);
        const pRawRuleset = this.rulesetStorage.
            loadRawRulesetFromFile(subName, listName);
        const pDone = pRawRuleset.then((rawRuleset) => {
          if (!rawRuleset) return Promise.reject(RULESET_NOT_EXISTING);
          if (!this.subscriptionRulesets[listName]) {
            this.subscriptionRulesets[listName] = {};
          }
          const list = this.subscriptionRulesets[listName];
          list[subName] = {
            rawRuleset,
            ruleset: rawRuleset.toRuleset(subName),
          };
          list[subName].ruleset.userRuleset = false;
          // list[subName].ruleset.print();
          return Promise.resolve();
        }).catch((e) => {
          if (e === RULESET_NOT_EXISTING) {
            this.log.warn("Ruleset does not exist (yet).");
          } else {
            this.log.error("Error when loading ruleset from file: ", e);
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
      this.events.listenersMap.onRulesChanged.emit();
      return {failures};
    });
  }

  public unloadSubscriptionRules(subscriptionInfo: UserSubscriptionsInfo) {
    const failures: Failures = {};

    // tslint:disable-next-line:forin
    for (const listName in subscriptionInfo) {
      // tslint:disable-next-line:forin
      for (const subName in subscriptionInfo[listName]) {
        this.log.info(`unloadSubscriptionRules: ${listName} / ${subName}`);
        if (!this.subscriptionRulesets[listName] ||
            !this.subscriptionRulesets[listName][subName]) {
          if (!failures[listName]) {
            failures[listName] = {};
          }
          failures[listName][subName] = null;
          continue;
        }
        const list = this.subscriptionRulesets[listName];
        delete list[subName];
      }
    }

    this.events.listenersMap.onRulesChanged.emit();

    return failures;
  }

  public getSubscriptions() {
    return this.subscriptions;
  }

  // ---------------------------------------------------------------------------
  // nsIObserver interface
  // ---------------------------------------------------------------------------

  public observe(subject: any, topic: any, data: any) {
    switch (topic) {
      // FIXME: The subscription logic should reside in the
      // subscription module.

      case SUBSCRIPTION_UPDATED_TOPIC: {
        this.log.log(`XXX updated: ${data}`);
        // TODO: check if the subscription is enabled. The user might have
        // disabled it between the time the update started and when it
        // completed.
        const subInfo = JSON.parse(data);
        this.loadSubscriptionRulesFromSubInfo(subInfo).
            catch(this.log.onError("SUBSCRIPTION_UPDATED_TOPIC"));
        break;
      }

      case SUBSCRIPTION_ADDED_TOPIC: {
        this.log.log(`XXX added: ${data}`);
        const subInfo: UserSubscriptionsInfo = JSON.parse(data);
        const pLoadSubscriptionRules =
            this.loadSubscriptionRulesFromSubInfo(subInfo);
        pLoadSubscriptionRules.then(({failures}: IFailures) => {
          const failed = Object.getOwnPropertyNames(failures).length > 0;
          if (failed) {
            const serials: Serials = {};
            // tslint:disable-next-line:forin
            for (const listName in subInfo) {
              if (!serials[listName]) {
                serials[listName] = {};
              }
              // tslint:disable-next-line:forin
              for (const subName in subInfo[listName]) {
                serials[listName][subName] = -1;
              }
            }
            this.subscriptions.update((result) => {
              this.log.info(`Subscription update completed: ${result}`);
            }, serials);
          }
          return;
        }).catch((e) => {
          this.log.error("SUBSCRIPTION_ADDED_TOPIC", e);
        });
        break;
      }

      case SUBSCRIPTION_REMOVED_TOPIC: {
        this.log.log(`YYY: ${data}`);
        const subInfo = JSON.parse(data);
        this.unloadSubscriptionRules(subInfo);
        break;
      }

      default:
        console.error(`unknown topic observed: ${topic}`);
    }
  }

  protected startupSelf() {
    MainEnvironment.obMan.observe([
      SUBSCRIPTION_UPDATED_TOPIC,
      SUBSCRIPTION_ADDED_TOPIC,
      SUBSCRIPTION_REMOVED_TOPIC,
    ], this.observe.bind(this));

    return this.loadSubscriptionRules();
  }
}
