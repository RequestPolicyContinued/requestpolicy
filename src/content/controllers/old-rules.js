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

import {Logger} from "lib/logger";
import {Info} from "lib/utils/info";
import {OldRules} from "lib/old-rules";
import {PolicyManager} from "lib/policy-manager";

// =============================================================================
// OldRulesController
// =============================================================================

export const OldRulesController = (function() {
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
    Logger.info("Performing automatic rule import.");
    let rv = self.importOldRules();
    if (false === rv) {
      console.error("Failed to automatically import old rules.");
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
      console.error("Failed to import old rules. Details:");
      console.dir(e);
      return false;
    }
  };

  return self;
}());
