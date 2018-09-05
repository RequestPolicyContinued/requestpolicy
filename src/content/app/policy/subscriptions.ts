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

import { App, IObject } from "app/interfaces";
import { JSMs, XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { IListenInterface } from "lib/classes/listeners";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import {MainEnvironment} from "lib/environment";
import {createListenersMap} from "lib/utils/listener-factories";
import { RawRuleset } from "./ruleset";
import {
  DEFAULT_SUBSCRIPTION_LIST_URL_BASE,
  ISubsObject,
  Serial,
  Subscription,
  SUBSCRIPTION_ADDED_TOPIC,
  SUBSCRIPTION_REMOVED_TOPIC,
  SUBSCRIPTION_UPDATE_FAILURE,
  SUBSCRIPTION_UPDATE_NOT_NEEDED,
  SUBSCRIPTION_UPDATE_SUCCESS,
  SUBSCRIPTION_UPDATED_TOPIC,
  SubscriptionList,
  SubscriptionUpdateResult,
  UpdateResults,
  UserSubscriptions,
  UserSubscriptionsInfo,
} from "./subscription";

const RULESET_NOT_EXISTING = {};

type Failures = any;
interface IFailures { failures: Failures; }
type Serials = any;
type SubscriptionRulesets = any;

declare const Cc: XPCOM.nsXPCComponents_Classes;
declare const Ci: XPCOM.nsXPCComponents_Interfaces;
declare const Services: JSMs.Services;

// tslint:disable:member-ordering

export class Subscriptions extends Module implements App.policy.ISubscriptions {
  public onRulesChanged: IListenInterface;

  private subscriptions: UserSubscriptions;
  private subscriptionRulesets: SubscriptionRulesets = {};
  private events = createListenersMap(["onRulesChanged"]);

  private get storageArea() { return this.storageApi.local; }

  protected get dependencies() {
    return {
      rulesetStorage: this.rulesetStorage,
      storageApi: this.storageApi,
    };
  }

  constructor(
      log: Common.ILog,
      private readonly storageApi: App.storage.IStorageApiWrapper,

      private readonly rulesetStorage: App.policy.IRulesetStorage,
      private readonly uriService: App.services.IUriService,
  ) {
    super("rules", log);

    this.onRulesChanged = this.events.interfaces.onRulesChanged;
  }

  public getRulesets() {
    return this.subscriptionRulesets;
  }

  public loadSubscriptionRules() {
    const pDone = this.storageArea.get(
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
      this.updateUserSubscriptions((result) => {
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
            this.updateUserSubscriptions((result) => {
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

    return MaybePromise.resolve(this.loadSubscriptionRules());
  }

  public addSubscription(listName: string, subName: string) {
    const lists = this.subscriptions.data.lists;
    if (!lists[listName]) {
      lists[listName] = {subscriptions: {}};
    }
    if (!lists[listName].subscriptions) {
      lists[listName].subscriptions = {};
    }
    lists[listName].subscriptions[subName] = {};
    this.save();
  }

  public removeSubscription(listName: string, subName: string) {
    const lists = this.subscriptions.data.lists;
    if (lists[listName] && lists[listName].subscriptions &&
        lists[listName].subscriptions[subName]) {
      delete lists[listName].subscriptions[subName];
    }
    this.save();
  }

  public save() {
    this.storageArea.set({
      subscriptions: this.subscriptions.data as any, // FIXME (as any)
    }).catch((e) => {
      this.log.error("UserSubscriptions.save():", e);
    });
  }

  // This method kinda sucks. Maybe move this to a worker and write this
  // procedurally instead of event-driven. That is, the async requests really
  // make a big fat mess of the code, or more likely I'm just not good at
  // making it not a mess. On the other hand, this parallelizes the update
  // requests, though that may not be a great thing in this case.
  public updateUserSubscriptions(
      callback: (results: UpdateResults) => void,
      serials: ISubsObject<Serial>,
  ) {
    const subs = this.subscriptions;
    const updatingLists: ISubsObject<true> = {};
    const updateResults: UpdateResults = {};

    const recordDone = (
        listName: string,
        subName?: string,
        result?: SubscriptionUpdateResult,
    ) => {
      this.log.info("Recording done: " + listName + " " + subName);
      if (subName) {
        const updateResultsList =
            updateResults[listName] as IObject<SubscriptionUpdateResult>;
        updateResultsList[subName] = result as SubscriptionUpdateResult;
        const list = updatingLists[listName];
        delete list[subName];
        // tslint:disable-next-line prefer-const forin
        for (let i in list) {
          i; // tslint:disable-line
          return; // What's that??
        }
      }
      delete updatingLists[listName];
      // tslint:disable-next-line prefer-const forin
      for (let i in updatingLists) {
        i; // tslint:disable-line
        return; // What's that??
      }
      this.setTimeout(() => callback(updateResults), 0);
    };

    let listCount = 0;
    // tslint:disable-next-line prefer-const forin
    for (let listName in serials) {
      if (!subs.lists[listName] || !subs.lists[listName].subscriptions) {
        this.log.info("Skipping update of unsubscribed list: " + listName);
        continue;
      }
      const updateSubs: Serials = {};
      let subCount = 0;
      // tslint:disable-next-line prefer-const forin
      for (let subName in serials[listName]) {
        if (!subs.lists[listName].subscriptions[subName]) {
          this.log.info(
              `Skipping update of unsubscribed subscription: ` +
              `${listName} ${subName}`,
          );
          continue;
        }
        updateSubs[subName] = {serial: serials[listName][subName]};
        subCount++;
      }
      if (subCount === 0) {
        this.log.info("Skipping list with no subscriptions: " + listName);
        continue;
      }
      let url = subs.lists[listName].url;
      if (!url) {
        url = DEFAULT_SUBSCRIPTION_LIST_URL_BASE + listName + ".json";
      }
      if (!url) {
        this.log.info("Skipping list without url: " + listName);
        continue;
      }
      const list = new SubscriptionList(listName, url);
      updatingLists[listName] = {};
      // tslint:disable-next-line prefer-const forin
      for (let subName in updateSubs) {
        this.log.info("Will update subscription: " + listName + " " + subName);
        updatingLists[listName][subName] = true;
      }
      updateResults[listName] = {};

      const metadataSuccess = () => {
        const subSuccess = (
            sub: Subscription,
            status: SubscriptionUpdateResult,
        ) => {
          this.log.info("Successfully updated subscription " + sub.toString());
          recordDone(list.name, sub.name, status);
        };

        const subError = (sub: Subscription, error: string) => {
          this.log.info(
              `Failed to update subscription ${sub.toString()}`,
              error,
          );
          recordDone(list.name, sub.name, SUBSCRIPTION_UPDATE_FAILURE);
        };

        this.log.info("Successfully updated list " + list.toString());
        this.updateSubscriptionListSubscriptions(
            list, updateSubs, subSuccess, subError,
        );
      };

      const metadataError = (error: string) => {
        this.log.info(`Failed to update list: ${list.toString()}:`, error);
        updateResults[listName] = false;
        recordDone(list.name);
      };

      listCount++;
      this.log.info("Will update list: " + listName);
      this.updateSubscriptionListMetadata(list, metadataSuccess, metadataError);
    }

    if (listCount === 0) {
      this.log.info("No lists to update.");
      this.setTimeout(() => callback(updateResults), 0);
    }
  }

  public updateSubscriptionListMetadata(
      slist: SubscriptionList,
      successCallback: () => void,
      errorCallback: (e: string) => void,
  ) {
    this.log.info("Updating " + slist.toString());
    const req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
        createInstance(Ci.nsIXMLHttpRequest) as any;
    req.onload = this.maybeCallback((event) => {
      try {
        slist.data = JSON.parse(req.responseText);
        // Maybe we don't need to write this to a file since we never read it
        // back again (we always grab new metadata when updating).
        this.setTimeout(() => successCallback(), 0);
      } catch (e) {
        this.setTimeout(() => errorCallback(e.toString()), 0);
      }
    });
    req.onerror = this.maybeCallback((event) => {
      this.setTimeout(() => errorCallback(req.statusText), 0);
    });
    req.open("GET", slist.url);
    req.send(null);
  }

  public updateSubscriptionListSubscriptions(
      slist: SubscriptionList,
      userSubs: Serials,
      successCallback: (
          sub: Subscription,
          result: SubscriptionUpdateResult,
      ) => void,
      errorCallback: (sub: Subscription, error: string) => void,
  ) {
    // tslint:disable-next-line prefer-const forin
    for (let subName in userSubs) {
      const serial = slist.getSubscriptionSerial(subName);
      if (!serial) {
        continue;
      }
      this.log.info("Current serial for " + slist.name + " " + subName + ": " +
          userSubs[subName].serial);
      this.log.info(`Available serial for ${slist.name} ${subName}: ${serial}`);
      const subUrl = slist.getSubscriptionUrl(subName);
      if (!subUrl) {
        continue;
      }
      const sub = new Subscription(slist.name, subName, subUrl);
      try {
        if (serial > userSubs[subName].serial) {
          this.updateSubscription(sub, successCallback, errorCallback);
        } else {
          this.log.info("No update needed for " + slist.name + " " + subName);
          const curSub = sub;
          this.setTimeout(() => {
            successCallback(curSub, SUBSCRIPTION_UPDATE_NOT_NEEDED);
          }, 0);
        }
      } catch (e) {
        const curSub = sub;
        this.setTimeout(() => errorCallback(curSub, e.toString()), 0);
      }
    }
  }

  public updateSubscription(
      sub: Subscription,
      successCallback: (
          sub: Subscription,
          result: SubscriptionUpdateResult,
      ) => void,
      errorCallback: (sub: Subscription, error: string) => void,
  ) {
    this.log.info("Updating " + sub.toString());

    const req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
        createInstance(Ci.nsIXMLHttpRequest) as any;
    req.onload = this.maybeCallback((event) => {
      try {
        const rawData = req.responseText;
        if (!rawData) {
          const error = "Empty response when requesting subscription file";
          this.setTimeout(() => errorCallback(sub, error), 0);
          return;
        }
        sub.data = JSON.parse(rawData);
        // Make sure there's a ['metadata']['serial'] key as a way of sanity
        // checking the parsed JSON as well as enforcing the use of serial
        // numbers in subscription rulesets.
        let serial;
        if (sub.data && sub.data.metadata && sub.data.metadata.serial) {
          serial = sub.data.metadata.serial;
        } else {
          const error = "Ruleset has no serial number";
          this.setTimeout(() => errorCallback(sub, error), 0);
          return;
        }
        if (typeof serial !== "number" || serial % 1 !== 0) {
          const error = "Ruleset has invalid serial number: " + serial;
          this.setTimeout(() => errorCallback(sub, error), 0);
          return;
        }
        // The rest of the sanity checking is done by RawRuleset.
        try {
          const rawRuleset = RawRuleset.create(
              this.log,
              this.uriService,
              sub.data,
          );
          this.rulesetStorage.saveRawRulesetToFile(
              rawRuleset, sub.name, sub.list,
          );
        } catch (e) {
          this.setTimeout(() => errorCallback(sub, e.toString()), 0);
          return;
        }
        const subInfo: ISubsObject<true> = {};
        subInfo[sub.list] = {};
        subInfo[sub.list][sub.name] = true;
        Services.obs.notifyObservers(null, SUBSCRIPTION_UPDATED_TOPIC,
            JSON.stringify(subInfo));
        this.setTimeout(() => {
          successCallback(sub, SUBSCRIPTION_UPDATE_SUCCESS);
        }, 0);
      } catch (e) {
        this.setTimeout(() => errorCallback(sub, e.toString()), 0);
      }
    });
    req.onerror = this.maybeCallback((event) => {
      this.setTimeout(() => errorCallback(sub, req.statusText), 0);
    });
    req.open("GET", sub.url);
    req.send(null);
  }

  private maybeCallback<T>(
      aCallback: (...args: T[]) => void,
  ): (...args: T[]) => void {
    return (...args: T[]) => {
      let ok = true;
      try {
        ok = this.shutdownState === "not yet shut down";
      } catch (e) {
        // Probably MainEnvironment is not available anymore,
        // because RP already being shut down.
        ok = false;
        this.log.error("Catched error:", e);
      }
      if (!ok) {
        this.log.log("Did not call callback function");
        return;
      }
      aCallback(...args);
    };
  }
}
