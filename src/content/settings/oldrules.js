/* global window, $, common, $id, $str */

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {Prefs} = importModule("lib/prefs");
  var {PolicyManager} = importModule("lib/policy-manager");
  var {OldRules} = importModule("lib/old-rules");

  //============================================================================

  var PAGE_STRINGS = [
    "importOldRules",
    "deleteOldRules",
    "showOldRuleReimportOptions",
    "yourOldRulesHaveBeenDeleted",
    "type",
    "origin",
    "destination"
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
      var origin = entry.o ? common.ruleDataPartToDisplayString(entry.o) : "";
      var dest = entry.d ? common.ruleDataPartToDisplayString(entry.d) : "";
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
    Prefs.clearPref("allowedOrigins");
    Prefs.clearPref("allowedDestinations");
    Prefs.clearPref("allowedOriginsToDestinations");
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
      throw "rules is undefined or empty";
    }
    PolicyManager.addAllowRules(rules);
    $("#doimport").hide();
    $("#policy").hide();
    $("#importoptions").hide();
    $("#importdone").show();
  };

  window.onload = function() {
    var oldRulesExist = Prefs.oldRulesExist();
    if (!oldRulesExist) {
      $("#hasrules").hide();
      $("#norules").show();
      return;
    }
    populateRuleTable();
  };

}());
