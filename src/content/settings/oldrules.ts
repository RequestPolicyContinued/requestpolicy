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

import {RuleData} from "app/policy/policy.module";
import {BackgroundPage} from "main";
import {$id} from "./common";

(() => {
  const {
    rp,
    RuleUtils,
  } = (browser.extension.getBackgroundPage() as any) as typeof BackgroundPage;

  // ===========================================================================

  let rules: RuleData[];

  // currently unused
  // function clearRulesTable() {
  //   var table = $id("rules");
  //   var children = table.getElementsByTagName("tr");
  //   while (children.length) {
  //     var child = children.item(0);
  //     child.parentNode.removeChild(child);
  //   }
  // }

  function populateRuleTable() {
    const table = $id("rules");

    const prefStrings = rp.services.rules.v0.getRPV0PrefStrings();
    // Setting the global rules var here.
    rules = rp.services.rules.v0.parse(prefStrings!);
    rp.policy.addAllowRules(rules);

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < rules.length; i++) {
      const entry = rules[i];
      const origin = entry.o ?
        RuleUtils.endpointSpecToDisplayString(entry.o) : "";
      const dest = entry.d ?
          RuleUtils.endpointSpecToDisplayString(entry.d) : "";
      addRulesTableRow(table, "allow", origin, dest, entry);
    }
  }

  function addRulesTableRow(
      table: HTMLTableElement,
      ruleAction: "allow" | "block",
      origin: string,
      dest: string,
      ruleData: RuleData,
  ) {
    let actionClass;
    let action;
    if (ruleAction === "allow") {
      actionClass = "allow";
      action = browser.i18n.getMessage("allow");
    } else {
      actionClass = "block";
      action = browser.i18n.getMessage("block");
    }

    const row = $("<tr>").addClass(actionClass).appendTo(table);

    row.append(
        $("<td>").text(action),
        $("<td>").text(origin),
        $("<td>").text(dest),
    );
  }

  (window as any).deleteOldRules = () => {
    rp.services.rules.v0.deleteOldRules();
    $("#doimport").hide();
    $("#deletedone").show();
    $("#showReimportOptions").hide();
    $("#reimportOldRules").hide();
    $("#deleteOldRules").hide();
  };

  (window as any).showReimportOptions = () => {
    $("#showReimportOptions").hide();
    $("#reimportOldRules").show();
  };

  (window as any).importOldRules = () => {
    if (!rules || rules.length === 0) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("rules is undefined or empty");
    }
    rp.policy.addAllowRules(rules);
    $("#doimport").hide();
    $("#policy").hide();
    $("#importoptions").hide();
    $("#importdone").show();
  };

  window.onload = () => {
    const oldRulesExist = rp.services.rules.v0.oldRulesExist();
    if (!oldRulesExist) {
      $("#hasrules").hide();
      $("#norules").show();
      return;
    }
    populateRuleTable();
  };
})();
