var PAGE_STRINGS = [
  'importOldRules',
  'deleteOldRules',
  'showOldRuleReimportOptions',
  'yourOldRulesHaveBeenDeleted',
  'type',
  'origin',
  'destination'
];

$(function () {
  common.localize(PAGE_STRINGS);
});


var rules = null;
var addHostWildcard = true;


function clearRulesTable() {
  var table = $id('rules');
  var children = table.getElementsByTagName('tr');
  while (children.length) {
    var child = children.item(0);
    child.parentNode.removeChild(child);
  }
}

function populateRuleTable() {
  var table = $id('rules');
  // Setting the global rules var here.
  rules = common.getOldRulesAsNewRules(addHostWildcard);

  for (var i = 0; i < rules.length; i++) {
    var entry = rules[i];
    var origin = entry['o'] ? common.ruleDataPartToDisplayString(entry['o']) : '';
    var dest = entry['d'] ? common.ruleDataPartToDisplayString(entry['d']) : '';
    addRulesTableRow(table, 'allow', origin, dest, entry);
  }
}

function addRulesTableRow(table, ruleAction, origin, dest, ruleData) {
  var actionClass = ruleAction == 'allow' ? 'allow' : 'block';
  var action = ruleAction == 'allow' ? $str('allow') : $str('block');

  var row = $('<tr>').addClass(actionClass).appendTo(table);

  row.append(
    $('<td>').text(action),
    $('<td>').text(origin),
    $('<td>').text(dest)
  );
}

function deleteOldRules() {
  common.clearPref('allowedOrigins');
  common.clearPref('allowedDestinations');
  common.clearPref('allowedOriginsToDestinations');
  $("#doimport").hide();
  $("#deletedone").show();
  $("#showReimportOptions").hide();
  $("#reimportOldRules").hide();
  $("#deleteOldRules").hide();
}

function showReimportOptions() {
  $("#showReimportOptions").hide();
  $("#reimportOldRules").show();
}

function importOldRules() {
  if (!rules || rules.length == 0) {
    throw 'rules is undefined or empty';
  }
  common.addAllowRules(rules);
  $("#doimport").hide();
  $("#policy").hide();
  $("#importoptions").hide();
  $("#importdone").show();
}

function handleAddHostWildcardsChange(event) {
  addHostWildcard = event.target.checked;
  clearRulesTable();
  populateRuleTable();
}

function onload() {
  var oldRulesExist = Prefs.oldRulesExist();
  if (!oldRulesExist) {
    $("#hasrules").hide();
    $("#norules").show();
    return;
  }
  populateRuleTable();
  $('#addhostwildcards').change(handleAddHostWildcardsChange);
}
