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

// =============================================================================
// constants
// =============================================================================

export const RequestReason = {
  UserPolicy: 1,
  // tslint:disable-next-line:object-literal-sort-keys
  SubscriptionPolicy: 2,
  DefaultPolicy: 3,
  DefaultPolicyInconsistentRules: 4,
  // if there are allow _and_ deny rules for the same request
  DefaultSameDomain: 5,
  Compatibility: 6,

  LinkClick: 7,
  FormSubmission: 8,
  HistoryRequest: 9,
  UserAllowedRedirect: 10,
  UserAction: 11,
  NewWindow: 12,
  IdenticalIdentifier: 13,

  RelativeUrl: 14,
  // TODO: give user control about relative urls on the page
};

type TRequestReason = number;
type MatchedRules = any;

// =============================================================================
// RequestResult
// =============================================================================

// TODO: merge this Class with the "Request" class and/or some kind of
// "RememberedRequest" or "RequestInfo" class.
/**
 * RequestResult objects are used to hand over the result of a check
 * whether a request is allowed or not. Sometimes only the boolean value of
 * isAllowed is needed; in that case the other arguments may be unused.
 *
 * @param {boolean} isAllowed
 * @param {number} resultReason
 */
export class RequestResult {
  private static countOriginToDestRules(aMatchedRules: MatchedRules) {
    let n = 0;
    for (const [, [type]] of aMatchedRules) {
      if (type === "origin-to-dest") ++n;
    }
    return n;
  }

  // FIXME: should be private
  public matchedAllowRules: MatchedRules[] = [];
  public matchedDenyRules: MatchedRules[] = [];

  constructor(
      // FIXME: should be private
      public isAllowed?: boolean,
      public resultReason?: TRequestReason,
  ) {}

  public allowRulesExist() {
    return this.matchedAllowRules.length > 0;
  }

  public denyRulesExist() {
    return this.matchedDenyRules.length > 0;
  }

  public resolveConflict() {
    const nODAllowRules = RequestResult.
        countOriginToDestRules(this.matchedAllowRules);
    const nODDenyRules = RequestResult.
        countOriginToDestRules(this.matchedDenyRules);
    if (nODAllowRules === 0 && nODDenyRules > 0) {
      return {conflictCanBeResolved: true, shouldAllow: false};
    }
    if (nODAllowRules > 0 && nODDenyRules === 0) {
      return {conflictCanBeResolved: true, shouldAllow: true};
    }
    return {conflictCanBeResolved: false, shouldAllow: undefined};
  }

  public isDefaultPolicyUsed() {
    // returns whether the default policy has been or will be used
    // for this request.
    return this.resultReason ===
        RequestReason.DefaultPolicy ||
        this.resultReason ===
            RequestReason.DefaultPolicyInconsistentRules ||
        this.resultReason === RequestReason.DefaultSameDomain;
  }

  public isOnBlacklist() {
    // TODO: implement a real blacklist. currently, if a request is blocked
    // *not* by the default policy it's by a blacklist
    return this.isAllowed ? false : !this.isDefaultPolicyUsed();
  }
}
