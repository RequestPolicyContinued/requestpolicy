/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2012 Justin Samuel
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

import { rp } from "app/app.background";
import {MainEnvironment} from "lib/environment";
import {IRuleSpecs, RawRuleset} from "lib/ruleset";
import {Log} from "models/log";

const log = Log.instance.extend({
  name: "Subscriptions",
});

declare const Cc: any;
declare const Ci: any;
declare const Services: any;

// =============================================================================
// Constants
// =============================================================================

export const SUBSCRIPTION_UPDATED_TOPIC =
    "rpcontinued-subscription-policy-updated";
export const SUBSCRIPTION_ADDED_TOPIC =
    "rpcontinued-subscription-policy-added";
export const SUBSCRIPTION_REMOVED_TOPIC =
    "rpcontinued-subscription-policy-removed";

const DEFAULT_SUBSCRIPTION_LIST_URL_BASE =
    "https://raw.githubusercontent.com/" +
    "RequestPolicyContinued/subscriptions/master/";

enum SubscriptionUpdateResult {
  SUBSCRIPTION_UPDATE_SUCCESS = "SUCCESS",
  SUBSCRIPTION_UPDATE_NOT_NEEDED = "NOT_NEEDED",
  SUBSCRIPTION_UPDATE_FAILURE = "FAILURE",
}

export const {
  SUBSCRIPTION_UPDATE_SUCCESS,
  SUBSCRIPTION_UPDATE_NOT_NEEDED,
  SUBSCRIPTION_UPDATE_FAILURE,
} = SubscriptionUpdateResult;

// =============================================================================
// utilities
// =============================================================================

function maybeCallback<T>(
    aCallback: (...args: T[]) => void,
): (...args: T[]) => void {
  return (...args: T[]) => {
    let ok = true;
    try {
      ok = MainEnvironment.isShuttingDownOrShutDown() === false;
    } catch (e) {
      // Probably MainEnvironment is not available anymore, because RP already
      // being shut down.
      ok = false;
      log.error("Catched error:", e);
    }
    if (!ok) {
      log.log("Did not call callback function");
      return;
    }
    aCallback(...args);
  };
}

// =============================================================================
// types
// =============================================================================

interface IObject<T> {
  [k: string]: T;
}

// see also RawRuleset's IMetadata
interface ISubscriptionMetadata {
  version: 1;
  serial: Serial;
}

interface ISubscriptionData {
  metadata: ISubscriptionMetadata;
  entries: IRuleSpecs;
}

interface IListData {
  subscriptions: {
    [subName: string]: {
      serial?: Serial;
      url?: string;
      title?: string;
      description?: string;
    },
  };
  url?: string;
}

interface IDataPerList {
  [listName: string]: IListData;
}

interface IUserSubscriptionsData {
  lists: IDataPerList;
}
interface IMaybeIncompleteUserSubscriptionsData {
  lists?: IUserSubscriptionsData["lists"];
}

interface ISubsObject<T, TListAdditional = never> {
  [listName: string]: TListAdditional | {
    [subName: string]: T,
  };
}

type UpdateResults = ISubsObject<SubscriptionUpdateResult, false>;
export type Serial = -1 | number;

interface ISerialObj {
  serial: Serial;
}

type Serials = IObject<ISerialObj>;

export type UserSubscriptionsInfo = ISubsObject<null | true>;

// =============================================================================
// UserSubscriptions
// =============================================================================

/**
 * Represents all of the subscriptions a user has enabled. This is where user
 * subscription information is stored and provides the mechanism for updating
 * subscriptions.
 */
export class UserSubscriptions {
  public static create(
      aData: any,
  ): UserSubscriptions {
    let data: IMaybeIncompleteUserSubscriptionsData;
    if (!aData) {
      data = {};
    } else {
      const checkResult = UserSubscriptions.checkDataObj(aData);
      if (!checkResult.valid) {
        throw new Error(`Invalid subscription data: ${checkResult.error}`);
      }
      data = aData;
    }
    if (!data.lists) {
      data.lists = {
        official: {
          subscriptions: {
            allow_embedded: {},
            allow_extensions: {},
            allow_functionality: {},
            allow_mozilla: {},
            allow_sameorg: {},
            deny_trackers: {},
          },
        },
      };
    }
    return new UserSubscriptions(data as IUserSubscriptionsData);
  }

  public static checkDataObj(
      dataObj: any,
  ): {valid: true} | {valid: false, error: string} {
    if (!dataObj || typeof dataObj !== "object") {
      return {valid: false, error: "not an object"};
    }
    // IMaybeIncompleteUserSubscriptionsData
    if ("lists" in dataObj) {
      // IDataPerList
      // TODO
    }
    return {valid: true};
  }

  private data: IUserSubscriptionsData;
  private get lists(): IDataPerList {
    return this.data.lists;
  }

  constructor(data: IUserSubscriptionsData) {
    this.data = data;
  }

  public toString() {
    return "[UserSubscriptions]";
  }

  public save() {
    browser.storage.local.set({
      subscriptions: this.data as any, // FIXME (as any)
    }).catch((e) => {
      log.error("UserSubscriptions.save():", e);
    });
  }

  public getSubscriptionInfo(): UserSubscriptionsInfo {
    const lists = this.data.lists;
    const result: UserSubscriptionsInfo = {};
    // tslint:disable-next-line prefer-const forin
    for (let listName in lists) {
      if (!lists[listName].subscriptions) {
        continue;
      }
      result[listName] = {};
      // tslint:disable-next-line prefer-const forin
      for (let subName in lists[listName].subscriptions) {
        result[listName][subName] = null;
      }
    }
    return result;
  }

  public addSubscription(listName: string, subName: string) {
    const lists = this.data.lists;
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
    const lists = this.data.lists;
    if (lists[listName] && lists[listName].subscriptions &&
        lists[listName].subscriptions[subName]) {
      delete lists[listName].subscriptions[subName];
    }
    this.save();
  }

  // This method kinda sucks. Maybe move this to a worker and write this
  // procedurally instead of event-driven. That is, the async requests really
  // make a big fat mess of the code, or more likely I'm just not good at
  // making it not a mess. On the other hand, this parallelizes the update
  // requests, though that may not be a great thing in this case.
  public update(
      callback: (results: UpdateResults) => void,
      serials: ISubsObject<Serial>,
  ) {
    const updatingLists: ISubsObject<true> = {};
    const updateResults: UpdateResults = {};

    const recordDone = (
        listName: string,
        subName?: string,
        result?: SubscriptionUpdateResult,
    ) => {
      log.info("Recording done: " + listName + " " + subName);
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
      setTimeout(() => callback(updateResults), 0);
    };

    let listCount = 0;
    // tslint:disable-next-line prefer-const forin
    for (let listName in serials) {
      if (!this.lists[listName] || !this.lists[listName].subscriptions) {
        log.info("Skipping update of unsubscribed list: " + listName);
        continue;
      }
      const updateSubs: Serials = {};
      let subCount = 0;
      // tslint:disable-next-line prefer-const forin
      for (let subName in serials[listName]) {
        if (!this.lists[listName].subscriptions[subName]) {
          log.info("Skipping update of unsubscribed subscription: " + listName +
              " " + subName);
          continue;
        }
        updateSubs[subName] = {serial: serials[listName][subName]};
        subCount++;
      }
      if (subCount === 0) {
        log.info("Skipping list with no subscriptions: " + listName);
        continue;
      }
      let url = this.lists[listName].url;
      if (!url) {
        url = DEFAULT_SUBSCRIPTION_LIST_URL_BASE + listName + ".json";
      }
      if (!url) {
        log.info("Skipping list without url: " + listName);
        continue;
      }
      const list = new SubscriptionList(listName, url);
      updatingLists[listName] = {};
      // tslint:disable-next-line prefer-const forin
      for (let subName in updateSubs) {
        log.info("Will update subscription: " + listName + " " + subName);
        updatingLists[listName][subName] = true;
      }
      updateResults[listName] = {};

      const metadataSuccess = () => {
        const subSuccess = (
            sub: Subscription,
            status: SubscriptionUpdateResult,
        ) => {
          log.info("Successfully updated subscription " + sub.toString());
          recordDone(list.name, sub.name, status);
        };

        const subError = (sub: Subscription, error: string) => {
          log.info("Failed to update subscription " + sub.toString() + ": " +
              error);
          recordDone(list.name, sub.name, SUBSCRIPTION_UPDATE_FAILURE);
        };

        log.info("Successfully updated list " + list.toString());
        list.updateSubscriptions(updateSubs, subSuccess, subError);
      };

      const metadataError = (error: string) => {
        log.info("Failed to update list: " + list.toString() + ": " + error);
        updateResults[listName] = false;
        recordDone(list.name);
      };

      listCount++;
      log.info("Will update list: " + listName);
      list.updateMetadata(metadataSuccess, metadataError);
    }

    if (listCount === 0) {
      log.info("No lists to update.");
      setTimeout(() => callback(updateResults), 0);
    }
  }
}

// =============================================================================
// SubscriptionList
// =============================================================================

/**
 * Represents a list of available subscriptions. Any actual subscription belongs
 * to a list. Each list has a unique name and within each list every
 * subscription has a unique name. The available subscriptions in the list is
 * determined by downloading a metadata file which specifies the subscription
 * names, the url for each subscription, and the subscription's current serial
 * number. If the the user's current copy of a subscription policy has a serial
 * number that is not lower than the one listed, an update isn't necessary.
 *
 * @param {string} name
 * @param {string} url
 */
// tslint:disable-next-line max-classes-per-file
class SubscriptionList {
  public readonly name: string;
  private url: string;
  private data: IListData;

  constructor(name: string, url: string) {
    // TODO: allow only ascii lower letters, digits, and hyphens in name.
    this.name = name;
    this.url = url;
  }

  public toString() {
    return "[SubscriptionList " + this.name + " " + this.url + "]";
  }

  public updateMetadata(
      successCallback: () => void,
      errorCallback: (e: string) => void,
  ) {
    log.info("Updating " + this.toString());
    const req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Ci.nsIXMLHttpRequest);
    req.onload = maybeCallback((event) => {
      try {
        this.data = JSON.parse(req.responseText);
        // Maybe we don't need to write this to a file since we never read it
        // back again (we always grab new metadata when updating).
        setTimeout(() => successCallback(), 0);
      } catch (e) {
        setTimeout(() => errorCallback(e.toString()), 0);
      }
    });
    req.onerror = maybeCallback((event) => {
      setTimeout(() => errorCallback(req.statusText), 0);
    });
    req.open("GET", this.url);
    req.send(null);
  }

  public updateSubscriptions(
      userSubs: Serials,
      successCallback: (
          sub: Subscription,
          result: SubscriptionUpdateResult,
      ) => void,
      errorCallback: (sub: Subscription, error: string) => void,
  ) {
    // tslint:disable-next-line prefer-const forin
    for (let subName in userSubs) {
      const serial = this.getSubscriptionSerial(subName);
      if (!serial) {
        continue;
      }
      log.info("Current serial for " + this.name + " " + subName + ": " +
          userSubs[subName].serial);
      log.info("Available serial for " + this.name + " " + subName + ": " +
          serial);
      const subUrl = this.getSubscriptionUrl(subName);
      if (!subUrl) {
        continue;
      }
      const sub = new Subscription(this.name, subName, subUrl);
      try {
        if (serial > userSubs[subName].serial) {
          sub.update(successCallback, errorCallback);
        } else {
          log.info("No update needed for " + this.name + " " + subName);
          const curSub = sub;
          setTimeout(() => {
            successCallback(curSub, SUBSCRIPTION_UPDATE_NOT_NEEDED);
          }, 0);
        }
      } catch (e) {
        const curSub = sub;
        setTimeout(() => errorCallback(curSub, e.toString()), 0);
      }
    }
  }

  // getSubscriptionNames  () {
  //   var names = [];
  //   for (var subName in this._data.subscriptions) {
  //     names.push(subName);
  //   }
  //   return names;
  // },

  public getSubscriptionSerial(subName: string) {
    if (!(subName in this.data.subscriptions)) {
      return null;
    }
    return this.data.subscriptions[subName].serial;
  }

  public getSubscriptionUrl(subName: string) {
    if (!(subName in this.data.subscriptions)) {
      return null;
    }
    return this.data.subscriptions[subName].url;
  }
}

// =============================================================================
// Subscription
// =============================================================================

/**
 * Represents a particular subscription policy available through a given
 * subscription list.
 *
 * @param {string} listName
 * @param {string} subName
 * @param {string} subUrl
 */
// tslint:disable-next-line max-classes-per-file
class Subscription {
  public readonly name: string;
  private list: string;
  private url: string;
  private data: ISubscriptionData;

  constructor(listName: string, subName: string, subUrl: string) {
    // TODO: allow only ascii lower letters, digits, and hyphens in listName.
    this.list = listName;
    // TODO: allow only ascii lower letters, digits, and hyphens in subName.
    this.name = subName;
    this.url = subUrl;
  }

  public toString() {
    return "[Subscription " + this.list + " " + this.name + " " +
        this.url + "]";
  }

  public update(
      successCallback: (
          sub: Subscription,
          result: SubscriptionUpdateResult,
      ) => void,
      errorCallback: (sub: Subscription, error: string) => void,
  ) {
    log.info("Updating " + this.toString());

    const req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
        createInstance(Ci.nsIXMLHttpRequest);
    req.onload = maybeCallback((event) => {
      try {
        const rawData = req.responseText;
        if (!rawData) {
          const error = "Empty response when requesting subscription file";
          setTimeout(() => errorCallback(this, error), 0);
          return;
        }
        this.data = JSON.parse(rawData);
        // Make sure there's a ['metadata']['serial'] key as a way of sanity
        // checking the parsed JSON as well as enforcing the use of serial
        // numbers in subscription rulesets.
        let serial;
        if (this.data && this.data.metadata && this.data.metadata.serial) {
          serial = this.data.metadata.serial;
        } else {
          const error = "Ruleset has no serial number";
          setTimeout(() => errorCallback(this, error), 0);
          return;
        }
        if (typeof serial !== "number" || serial % 1 !== 0) {
          const error = "Ruleset has invalid serial number: " + serial;
          setTimeout(() => errorCallback(this, error), 0);
          return;
        }
        // The rest of the sanity checking is done by RawRuleset.
        try {
          const rawRuleset = RawRuleset.create(this.data);
          rp.policy.rulesetStorage.saveRawRulesetToFile(
              rawRuleset, this.name, this.list,
          );
        } catch (e) {
          setTimeout(() => errorCallback(this, e.toString()), 0);
          return;
        }
        const subInfo: ISubsObject<true> = {};
        subInfo[this.list] = {};
        subInfo[this.list][this.name] = true;
        Services.obs.notifyObservers(null, SUBSCRIPTION_UPDATED_TOPIC,
            JSON.stringify(subInfo));
        setTimeout(() => {
          successCallback(this, SUBSCRIPTION_UPDATE_SUCCESS);
        }, 0);
      } catch (e) {
        setTimeout(() => errorCallback(this, e.toString()), 0);
      }
    });
    req.onerror = maybeCallback((event) => {
      setTimeout(() => errorCallback(this, req.statusText), 0);
    });
    req.open("GET", this.url);
    req.send(null);
  }
}
