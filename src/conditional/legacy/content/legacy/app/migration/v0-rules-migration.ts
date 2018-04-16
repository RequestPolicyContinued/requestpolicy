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

import { Policy } from "app/policy/policy.module";
import { V0RulesService } from "app/services/rules/v0-rules-service";
import { VersionInfoService } from "app/services/version-info-service";
import { Module } from "lib/classes/module";
import { Log } from "models/log";

export class V0RulesMigration extends Module {
  constructor(
      log: Log,
      private policy: Policy,
      private v0RulesService: V0RulesService,
      private versionInfoService: VersionInfoService,
  ) {
    super("app.migration.v0Rules", log);
  }

  protected async startupSelf() {
    // If the user ...
    //   * upgrades to 1.0,
    //   * downgrades back to 0.5
    //   * and upgrades again
    // the user ruleset already exists after the first step.
    await this.versionInfoService.whenReady;
    if (!this.versionInfoService.isRPUpgrade) { return; }

    await this.policy.whenReady;
    if (this.policy.userRulesetExistedOnStartup) { return; }

    await this.v0RulesService.whenReady;

    // it's the first RP upgrade
    this.importOldRulesAutomatically();
  }

  /**
   * @return {boolean} If the import was successful.
   */
  private importOldRules() {
    try {
      const prefStrings = this.v0RulesService.getRPV0PrefStrings();
      if (prefStrings === null) return null;
      const rules = this.v0RulesService.parse(prefStrings);
      this.policy.addAllowRules(rules);
      return true;
    } catch (e) {
      console.error("Failed to import old rules. Details:");
      console.dir(e);
      return false;
    }
  }

  private importOldRulesAutomatically() {
    this.log.info("Performing automatic rule import.");
    const rv = this.importOldRules();
    if (false === rv) {
      console.error("Failed to automatically import old rules.");
    }
  }
}
