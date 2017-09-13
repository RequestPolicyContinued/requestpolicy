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

//==============================================================================
// constants
//==============================================================================

export const REQUEST_REASON_USER_POLICY           = 1;
export const REQUEST_REASON_SUBSCRIPTION_POLICY   = 2;
export const REQUEST_REASON_DEFAULT_POLICY        = 3;
export const REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES = 4; // if there are allow _and_ deny rules for the same request
export const REQUEST_REASON_DEFAULT_SAME_DOMAIN   = 5;
export const REQUEST_REASON_COMPATIBILITY         = 6;

export const REQUEST_REASON_LINK_CLICK            = 7;
export const REQUEST_REASON_FORM_SUBMISSION       = 8;
export const REQUEST_REASON_HISTORY_REQUEST       = 9;
export const REQUEST_REASON_USER_ALLOWED_REDIRECT = 10;
export const REQUEST_REASON_USER_ACTION           = 11;
export const REQUEST_REASON_NEW_WINDOW            = 12;
export const REQUEST_REASON_IDENTICAL_IDENTIFIER  = 13;

export const REQUEST_REASON_RELATIVE_URL          = 14; // TODO: give user control about relative urls on the page

//==============================================================================
// RequestResult
//==============================================================================

// TODO: merge this Class with the "Request" class and/or some kind of
// "RememberedRequest" or "RequestInfo" class.
/**
 * RequestResult objects are used to hand over the result of a check
 * whether a request is allowed or not. Sometimes only the boolean value of
 * isAllowed is needed; in that case the other arguments may be unused.
 */
export function RequestResult(isAllowed, resultReason) {
  this.matchedAllowRules = [];
  this.matchedDenyRules = [];

  this.isAllowed = isAllowed;
  this.resultReason = resultReason;
}

RequestResult.prototype = {
  matchedAllowRules: null,
  matchedDenyRules: null,

  isAllowed: undefined,  // whether the request will be or has been allowed
  resultReason: undefined
};

RequestResult.prototype.allowRulesExist = function() {
  return this.matchedAllowRules.length > 0;
};

RequestResult.prototype.denyRulesExist = function() {
  return this.matchedDenyRules.length > 0;
};

function countOriginToDestRules(aMatchedRules) {
  let n = 0;
  for (let [, [type]] of aMatchedRules) {
    if (type === "origin-to-dest") {
      ++n;
    }
  }
  return n;
}

RequestResult.prototype.resolveConflict = function() {
  let nODAllowRules = countOriginToDestRules(this.matchedAllowRules);
  let nODDenyRules = countOriginToDestRules(this.matchedDenyRules);
  if (nODAllowRules === 0 && nODDenyRules > 0) {
    return {conflictCanBeResolved: true, shouldAllow: false};
  }
  if (nODAllowRules > 0 && nODDenyRules === 0) {
    return {conflictCanBeResolved: true, shouldAllow: true};
  }
  return {conflictCanBeResolved: false, shouldAllow: undefined};
};

RequestResult.prototype.isDefaultPolicyUsed = function() {
  // returns whether the default policy has been or will be used for this request.
  return this.resultReason === REQUEST_REASON_DEFAULT_POLICY ||
      this.resultReason === REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES ||
      this.resultReason === REQUEST_REASON_DEFAULT_SAME_DOMAIN;
};

RequestResult.prototype.isOnBlacklist = function() {
  // TODO: implement a real blacklist. currently, if a request is blocked
  // *not* by the default policy it's by a blacklist
  return this.isAllowed ? false : !this.isDefaultPolicyUsed();
};
