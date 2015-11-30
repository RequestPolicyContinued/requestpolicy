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

/* global Components */
const {utils: Cu} = Components;

/* global PolicyManager: true */

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {C} = importModule("lib/utils/constants");

//==============================================================================
// PolicyManager (extension)
//==============================================================================

PolicyManager = (function(self) {

  self.addAllowRule = self.addRule.bind(this, C.RULE_ACTION_ALLOW);
  self.addTemporaryAllowRule = self.addTemporaryRule.bind(this,
                                                          C.RULE_ACTION_ALLOW);
  self.removeAllowRule = self.removeRule.bind(this, C.RULE_ACTION_ALLOW);
  self.addDenyRule = self.addRule.bind(this, C.RULE_ACTION_DENY);
  self.addTemporaryDenyRule = self.addTemporaryRule.bind(this,
                                                         C.RULE_ACTION_DENY);
  self.removeDenyRule = self.removeRule.bind(this, C.RULE_ACTION_DENY);

  self.addAllowRules = self.addRules.bind(this, C.RULE_ACTION_ALLOW);
  self.addDenyRules = self.addRules.bind(this, C.RULE_ACTION_DENY);


  function getRuleData(aOrigin, aDest) {
    let ruleData = {};
    if (aOrigin !== undefined) {
      ruleData["o"] = {"h": aOrigin};
    }
    if (aDest !== undefined) {
      ruleData["d"] = {"h": aDest};
    }
    return ruleData;
  }


  function allowOrigin(aOrigin, noStore) {
    self.addAllowRule(getRuleData(aOrigin), noStore);
  }
  self.allowOrigin = function(aOrigin) {
    allowOrigin(aOrigin, false);
  };
  self.allowOriginDelayStore = function(aOrigin) {
    allowOrigin(aOrigin, true);
  };


  self.temporarilyAllowOrigin = function(aOrigin) {
    PolicyManager.addTemporaryAllowRule(getRuleData(aOrigin));
  };
  self.temporarilyAllowDestination = function(aDest) {
    self.addTemporaryAllowRule(getRuleData(undefined, aDest));
  };


  function allowDestination(aDest, noStore) {
    self.addAllowRule(getRuleData(undefined, aDest), noStore);
  }
  self.allowDestination = function(aDest) {
    allowDestination(aDest, false);
  };
  self.allowDestinationDelayStore = function(aDest) {
    allowDestination(aDest, true);
  };


  function allowOriginToDestination(originIdentifier, destIdentifier, noStore) {
    self.addAllowRule(getRuleData(originIdentifier, destIdentifier), noStore);
  };
  self.allowOriginToDestination = function(originIdentifier, destIdentifier) {
    allowOriginToDestination(originIdentifier, destIdentifier, false);
  };
  self.allowOriginToDestinationDelayStore = function(originIdentifier,
                                                     destIdentifier) {
    allowOriginToDestination(originIdentifier, destIdentifier, true);
  };


  self.temporarilyAllowOriginToDestination = function(originIdentifier,
                                                      destIdentifier) {
    PolicyManager.addTemporaryAllowRule(getRuleData(originIdentifier,
                                                    destIdentifier));
  };

  return self;
}(PolicyManager || {}));
