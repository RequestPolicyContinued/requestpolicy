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

"use strict";

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
      ruleData.o = {"h": aOrigin};
    }
    if (aDest !== undefined) {
      ruleData.d = {"h": aDest};
    }
    return ruleData;
  }

  self.addRuleBySpec = function(aSpec, noStore) {
    const fn = aSpec.temp ? self.addTemporaryRule : self.addRule;
    const ruleAction = aSpec.allow ? C.RULE_ACTION_ALLOW : C.RULE_ACTION_DENY;
    const ruleData = getRuleData(aSpec.origin, aSpec.dest);

    fn(ruleAction, ruleData, noStore);
  };

  return self;
}(PolicyManager || {}));
