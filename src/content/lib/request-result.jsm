/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = [
  "RequestResult",
  "REQUEST_REASON_USER_POLICY",
  "REQUEST_REASON_SUBSCRIPTION_POLICY",
  "REQUEST_REASON_DEFAULT_POLICY",
  "REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES",
  "REQUEST_REASON_DEFAULT_SAME_DOMAIN",
  "REQUEST_REASON_COMPATIBILITY",
  "REQUEST_REASON_LINK_CLICK",
  "REQUEST_REASON_FORM_SUBMISSION",
  "REQUEST_REASON_HISTORY_REQUEST",
  "REQUEST_REASON_USER_ALLOWED_REDIRECT",
  "REQUEST_REASON_USER_ACTION",
  "REQUEST_REASON_NEW_WINDOW",
  "REQUEST_REASON_IDENTICAL_IDENTIFIER",
  "REQUEST_REASON_RELATIVE_URL"
];

const REQUEST_REASON_USER_POLICY           = 1;
const REQUEST_REASON_SUBSCRIPTION_POLICY   = 2;
const REQUEST_REASON_DEFAULT_POLICY        = 3;
const REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES = 4; // if there are allow _and_ deny rules for the same request
const REQUEST_REASON_DEFAULT_SAME_DOMAIN   = 5;
const REQUEST_REASON_COMPATIBILITY         = 6;

const REQUEST_REASON_LINK_CLICK            = 7;
const REQUEST_REASON_FORM_SUBMISSION       = 8;
const REQUEST_REASON_HISTORY_REQUEST       = 9;
const REQUEST_REASON_USER_ALLOWED_REDIRECT = 10;
const REQUEST_REASON_USER_ACTION           = 11;
const REQUEST_REASON_NEW_WINDOW            = 12;
const REQUEST_REASON_IDENTICAL_IDENTIFIER  = 13;

const REQUEST_REASON_RELATIVE_URL          = 14; // TODO: give user control about relative urls on the page


// TODO: merge this Class with the "Request" class and/or some kind of
// "RememberedRequest" or "RequestInfo" class.
/**
 * RequestResult objects are used to hand over the result of a check
 * whether a request is allowed or not. Sometimes only the boolean value of
 * isAllowed is needed; in that case the other arguments may be unused.
 */
function RequestResult(isAllowed, resultReason) {
  this.matchedAllowRules = [];
  this.matchedDenyRules = [];

  this.isAllowed = isAllowed;
  this.resultReason = resultReason;
}
RequestResult.prototype = {
  matchedAllowRules : null,
  matchedDenyRules : null,

  isAllowed : undefined,  // whether the request will be or has been allowed
  resultReason : undefined,

  allowRulesExist : function() {
    return this.matchedAllowRules.length > 0;
  },
  denyRulesExist : function () {
    return this.matchedDenyRules.length > 0;
  },

  isDefaultPolicyUsed : function () {
    // returns whether the default policy has been or will be used for this request.
    return (this.resultReason == REQUEST_REASON_DEFAULT_POLICY ||
            this.resultReason == REQUEST_REASON_DEFAULT_POLICY_INCONSISTENT_RULES ||
            this.resultReason == REQUEST_REASON_DEFAULT_SAME_DOMAIN);
  },

  isOnBlacklist: function() {
    // TODO: implement a real blacklist. currently, if a request is blocked
    // *not* by the default policy it's by a blacklist
    return this.isAllowed ? false : !this.isDefaultPolicyUsed();
  }
};
