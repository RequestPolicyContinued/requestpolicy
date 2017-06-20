/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2015 Martin Kimmerle
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

/* exported OldRulesController */
/* exported EXPORTED_SYMBOLS */
var EXPORTED_SYMBOLS = ["OldRulesController"];

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {Logger} = importModule("lib/logger");
let {Info} = importModule("lib/utils/info");
let {OldRules} = importModule("lib/old-rules");
var {PolicyManager} = importModule("lib/policy-manager");

//==============================================================================
// OldRulesController
//==============================================================================

var OldRulesController = (function() {
  let self = {};

  self.startup = function() {
    // If the user ...
    //   * upgrades to 1.0,
    //   * downgrades back to 0.5
    //   * and upgrades again
    // the user ruleset (user.json) already exists after the first step.
    let isFirstRPUpgrade = true === Info.isRPUpgrade &&
        false === PolicyManager.userRulesetExistedOnStartup;

    if (isFirstRPUpgrade) {
      importOldRulesAutomatically();
    } else {
      // TODO inform the user about old rules
    }
  };

  function importOldRulesAutomatically() {
    Logger.dump("Performing automatic rule import.");
    let rv = self.importOldRules();
    if (false === rv) {
      Logger.error("Failed to automatically import old rules.");
    }
  }

  /**
   * @return {boolean} If the import was successful.
   */
  self.importOldRules = function() {
    try {
      let oldRules = new OldRules();
      let rules = oldRules.getAsNewRules();
      PolicyManager.addAllowRules(rules);
      return true;
    } catch (e) {
      Cu.reportError(e);
      return false;
    }
  };

  return self;
}());
