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

import {common, $id, $str} from "./common";

(function() {
  var {
    LegacyApi,
    PolicyManager,
    OldRules,
    RuleUtils,
  } = browser.extension.getBackgroundPage();

  // ===========================================================================

  var PAGE_STRINGS = [
    "importOldRules",
    "deleteOldRules",
    "showOldRuleReimportOptions",
    "yourOldRulesHaveBeenDeleted",
    "type",
    "origin",
    "destination",
  ];

  $(function() {
    common.localize(PAGE_STRINGS);
  });

  var rules = null;

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
    var table = $id("rules");

    var oldRules = new OldRules();
    // Setting the global rules var here.
    rules = oldRules.getAsNewRules();

    for (var i = 0; i < rules.length; i++) {
      var entry = rules[i];
      var origin = entry.o ?
                   RuleUtils.endpointSpecToDisplayString(entry.o) : "";
      var dest = entry.d ? RuleUtils.endpointSpecToDisplayString(entry.d) : "";
      addRulesTableRow(table, "allow", origin, dest, entry);
    }
  }

  function addRulesTableRow(table, ruleAction, origin, dest, ruleData) {
    var actionClass = ruleAction === "allow" ? "allow" : "block";
    var action = ruleAction === "allow" ? $str("allow") : $str("block");

    var row = $("<tr>").addClass(actionClass).appendTo(table);

    row.append(
      $("<td>").text(action),
      $("<td>").text(origin),
      $("<td>").text(dest)
    );
  }

  window.deleteOldRules = function() {
    LegacyApi.prefs.reset("allowedOrigins");
    LegacyApi.prefs.reset("allowedDestinations");
    LegacyApi.prefs.reset("allowedOriginsToDestinations");
    LegacyApi.prefs.save();
    $("#doimport").hide();
    $("#deletedone").show();
    $("#showReimportOptions").hide();
    $("#reimportOldRules").hide();
    $("#deleteOldRules").hide();
  };

  window.showReimportOptions = function() {
    $("#showReimportOptions").hide();
    $("#reimportOldRules").show();
  };

  window.importOldRules = function() {
    if (!rules || rules.length === 0) {
      // eslint-disable-next-line no-throw-literal
      throw "rules is undefined or empty";
    }
    PolicyManager.addAllowRules(rules);
    $("#doimport").hide();
    $("#policy").hide();
    $("#importoptions").hide();
    $("#importdone").show();
  };

  window.onload = function() {
    var oldRulesExist = LegacyApi.prefs.oldRulesExist();
    if (!oldRulesExist) {
      $("#hasrules").hide();
      $("#norules").show();
      return;
    }
    populateRuleTable();
  };
})();
