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

import { IRuleSpecs } from "./ruleset";

// declare const Cc: any;
// declare const Ci: any;
// declare const Services: any;

// =============================================================================
// Constants
// =============================================================================

export const SUBSCRIPTION_UPDATED_TOPIC =
    "rpcontinued-subscription-policy-updated";
export const SUBSCRIPTION_ADDED_TOPIC =
    "rpcontinued-subscription-policy-added";
export const SUBSCRIPTION_REMOVED_TOPIC =
    "rpcontinued-subscription-policy-removed";

export const DEFAULT_SUBSCRIPTION_LIST_URL_BASE =
    "https://raw.githubusercontent.com/" +
    "RequestPolicyContinued/subscriptions/master/";

export enum SubscriptionUpdateResult {
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
// types
// =============================================================================

export interface IObject<T> {
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

export interface ISubsObject<T, TListAdditional = never> {
  [listName: string]: TListAdditional | {
    [subName: string]: T,
  };
}

export type UpdateResults = ISubsObject<SubscriptionUpdateResult, false>;
export type Serial = -1 | number;

interface ISerialObj {
  serial: Serial;
}

export type Serials = IObject<ISerialObj>;

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

  public data: IUserSubscriptionsData;
  public get lists(): IDataPerList {
    return this.data.lists;
  }

  constructor(data: IUserSubscriptionsData) {
    this.data = data;
  }

  public toString() {
    return "[UserSubscriptions]";
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
export class SubscriptionList {
  public readonly name: string;
  public url: string;
  public data: IListData;

  constructor(name: string, url: string) {
    // TODO: allow only ascii lower letters, digits, and hyphens in name.
    this.name = name;
    this.url = url;
  }

  public toString() {
    return "[SubscriptionList " + this.name + " " + this.url + "]";
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
export class Subscription {
  public readonly name: string;
  public list: string;
  public url: string;
  public data: ISubscriptionData;

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
}
