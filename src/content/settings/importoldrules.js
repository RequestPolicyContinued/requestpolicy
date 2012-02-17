Components.utils.import("resource://requestpolicy/DomainUtil.jsm");
Components.utils.import("resource://requestpolicy/Logger.jsm");
Components.utils.import("resource://requestpolicy/PolicyManager.jsm");

var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
  .getService(Components.interfaces.nsIRequestPolicy);
var rpServiceJSObject = rpService.wrappedJSObject;


var rules = null;
var addHostWildcard = true;


function clearPref(pref) {
  try {
    if (rpServiceJSObject.prefs.prefHasUserValue(pref)) {
      rpServiceJSObject.prefs.clearUserPref(pref);
    }
  } catch (e) {
    Logger.dump('Clearing pref failed: ' + e.toString());
  }
  rpServiceJSObject._prefService.savePrefFile(null);
}

function getPrefObj(pref) {
  try {
    var value = rpServiceJSObject.prefs
          .getComplexValue(pref, Components.interfaces.nsISupportsString).data;
  } catch (e) {
    value = '';
  }
  return prefStringToObj(value);
}

function prefStringToObj(prefString) {
  var prefObj = {};
  var prefArray = prefString.split(" ");
  if (prefArray[0] != "") {
    for (var i in prefArray) {
      prefObj[prefArray[i]] = true;
    }
  }
  return prefObj;
}

function getOldRulesAsNewRules() {
  var origins = getPrefObj('allowedOrigins');
  var destinations = getPrefObj('allowedDestinations');
  var originsToDestinations = getPrefObj('allowedOriginsToDestinations');
  var rules = [];

  for (var origin in origins) {
    var entry = {};
    entry['o'] = {};
    entry['o']['h'] = origin;
    if (entry['o']['h'] && addHostWildcard) {
      entry['o']['h'] = '*.' + entry['o']['h']
    }
    rules.push(entry);
  }
  for (var dest in destinations) {
    entry = {};
    entry['d'] = {};
    entry['d']['h'] = dest;
    if (entry['d']['h'] && addHostWildcard) {
      entry['d']['h'] = '*.' + entry['d']['h']
    }
    rules.push(entry);
  }
  for (var originToDest in originsToDestinations) {
    var parts = originToDest.split('|');
    entry = {};
    entry['o'] = {};
    entry['o']['h'] = parts[0];
    if (entry['o']['h'] && addHostWildcard) {
      entry['o']['h'] = '*.' + entry['o']['h']
    }
    entry['d'] = {};
    entry['d']['h'] = parts[1];
    if (entry['d']['h'] && addHostWildcard) {
      entry['d']['h'] = '*.' + entry['d']['h']
    }
    rules.push(entry);
  }

  return rules;
}

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
  rules = getOldRulesAsNewRules();

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
  // TODO: path
  return str;
}

function addRule() {
  try {
    addRuleHelper();
  } catch (e) {
    alert('Unable to add rule: ' + e.toString());
    return;
  }
  var search = document.getElementById('rulesearch');
  populateRuleTable(search.value);
}

function importNewRules() {
  for (var i in rules) {
    var ruleData = rules[i];
    rpServiceJSObject.addAllowRule(ruleData);
  }
}

function deleteOldRules() {
  clearPref('allowedOrigins');
  clearPref('allowedDestinations');
  clearPref('allowedOriginsToDestinations');
}

function importNewRulesDeleteOldRules() {
  if (!rules || rules.length == 0) {
    throw 'rules is undefined or empty';
  }
  importNewRules();
  deleteOldRules();
  document.getElementById('doimport').hidden = true;
  document.getElementById('importdone').hidden = false;
}

function onlyImportNewRules() {
  if (!rules || rules.length == 0) {
    throw 'rules is undefined or empty';
  }
  importNewRules();
  document.getElementById('doimport').hidden = true;
  document.getElementById('importdone').hidden = false;
}

function onlyDeleteOldRules() {
  deleteOldRules();
  document.getElementById('doimport').hidden = true;
  document.getElementById('deletedone').hidden = false;
}

function handleAddHostWildcardsChange(event) {
  addHostWildcard = event.target.checked;
  clearPolicyTable();
  populateRuleTable();
}

function onload() {
  populateRuleTable();
  if (rules.length == 0) {
    document.getElementById('hasrules').hidden = true;
    document.getElementById('norules').hidden = false;
  } else {
    var el = document.getElementById('addhostwildcards');
    el.addEventListener('change', handleAddHostWildcardsChange);
  }
}
