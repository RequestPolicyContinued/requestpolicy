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

import {rp} from "app/app.background";
import {IController} from "lib/classes/controllers";
import {OldRules} from "lib/classes/old-rules";
import {Log} from "models/log";
import {VersionInfos} from "models/version-infos";

const log = Log.instance;

/**
 * @return {boolean} If the import was successful.
 */
function importOldRules() {
  try {
    const oldRules = new OldRules();
    const rules = oldRules.getAsNewRules();
    rp.policy.addAllowRules(rules);
    return true;
  } catch (e) {
    console.error("Failed to import old rules. Details:");
    console.dir(e);
    return false;
  }
}

function importOldRulesAutomatically() {
  log.info("Performing automatic rule import.");
  const rv = importOldRules();
  if (false === rv) {
    console.error("Failed to automatically import old rules.");
  }
}

export const OldRulesController: IController = {
  startupPreconditions: [
    VersionInfos.pReady,
    rp.policy.whenReady,
  ],
  startup() {
    // If the user ...
    //   * upgrades to 1.0,
    //   * downgrades back to 0.5
    //   * and upgrades again
    // the user ruleset already exists after the first step.
    const isFirstRPUpgrade = true === VersionInfos.isRPUpgrade &&
        false === rp.policy.userRulesetExistedOnStartup;

    if (isFirstRPUpgrade) {
      importOldRulesAutomatically();
    } else {
      // TODO inform the user about old rules
    }
  },
};
