PAGE_STRINGS = [
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


function clearPolicyTable() {
  var table = document.getElementById('policy-user');
  var children = table.getElementsByTagName('tr');
  while (children.length) {
    var child = children.item(0);
    child.parentNode.removeChild(child);
  }
}

function populateRuleTable() {
  var table = document.getElementById('policy-user');
  // Setting the global rules var here.
  rules = common.getOldRulesAsNewRules(addHostWildcard);

  for (var i = 0; i < rules.length; i++) {
    var entry = rules[i];
    var origin = entry['o'] ? ruleDataPartToDisplayString(entry['o']) : '';
    var dest = entry['d'] ? ruleDataPartToDisplayString(entry['d']) : '';
    addPolicyTableRow(table, 'allow', origin, dest, entry);
  }
}

function addPolicyTableRow(table, type, origin, dest, ruleData) {
  var rowCount = table.rows.length;
  var row = table.insertRow(rowCount);

  var typeCell = row.insertCell(0);
  typeCell.textContent = type == 'allow' ? 'Allow' : 'Block';

  var originCell = row.insertCell(1);
  originCell.textContent = origin;

  var destCell = row.insertCell(2);
  destCell.textContent = dest;

  var destCell = row.insertCell(3);
  var anchor = document.createElement('a');
  anchor.appendChild(document.createTextNode(''));
  destCell.appendChild(anchor);
}

// TODO: remove code duplication with menu.js
function ruleDataPartToDisplayString(ruleDataPart) {
  var str = "";
  if (ruleDataPart["s"]) {
    str += ruleDataPart["s"] + "://";
  }
  str += ruleDataPart["h"] ? ruleDataPart["h"] : "*";
  if (ruleDataPart["port"]) {
    str += ":" + ruleDataPart["port"];
  }
  return str;
}

function deleteOldRules() {
  common.clearPref('allowedOrigins');
  common.clearPref('allowedDestinations');
  common.clearPref('allowedOriginsToDestinations');
  $('#doimport').hide();
  $('#deletedone').show();
  $('#showReimportOptions').hide();
  $('#reimportOldRules').hide();
  $('#deleteOldRules').hide();
}

function showReimportOptions() {
  $('#showReimportOptions').hide();
  $('#reimportOldRules').show();
}

function importOldRules() {
  if (!rules || rules.length == 0) {
    throw 'rules is undefined or empty';
  }
  common.addAllowRules(rules);
  $('#doimport').hide();
  $('#policy').hide();
  $('#importoptions').hide();
  $('#importdone').show();
}

function handleAddHostWildcardsChange(event) {
  addHostWildcard = event.target.checked;
  clearPolicyTable();
  populateRuleTable();
}

function onload() {
  var oldRulesExist = rpService.oldRulesExist();
  if (!oldRulesExist) {
    $('#hasrules').hide();
    $('#norules').show();
    return;
  }
  populateRuleTable();
  $('#addhostwildcards').change(handleAddHostWildcardsChange);
}
