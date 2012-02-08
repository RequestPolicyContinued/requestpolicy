const SEARCH_DELAY = 500;

Components.utils.import("resource://requestpolicy/PolicyManager.jsm");

var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
  .getService(Components.interfaces.nsIRequestPolicy);
var rpServiceJSObject = rpService.wrappedJSObject;

var searchTimeoutId = null;

function populateRuleTable(filter) {
  searchTimeoutId = null;

  var config = {
    "subscriptions" : {
    }
  };
  var policyMgr = new PolicyManager();
  policyMgr.loadPolicies(config);

  var user = policyMgr._policies['user'];
  var table = document.getElementById('policy-user');
  var entries = user.rawPolicy.toJSON()['entries'];

  clearPolicyTable(table);

  for (var i = 0; i < entries['allow'].length; i++) {
    var entry = entries['allow'][i];
    var origin = entry['o'] ? ruleDataPartToDisplayString(entry['o']) : '';
    var dest = entry['d'] ? ruleDataPartToDisplayString(entry['d']) : '';
    if (filter) {
      if (origin.indexOf(filter) == -1 && dest.indexOf(filter) == -1) {
        continue;
      }
    }
    addPolicyTableRow(table, 'allow', origin, dest, entry);
  }
}

function deleteRule(event) {
  var anchor = event.target;
  var ruleType = anchor.requestpolicyRuleType;
  var ruleData = anchor.requestpolicyRuleData;
  if (ruleType == 'allow') {
    rpServiceJSObject.removeAllowRule(ruleData);
  } else if (ruleType == 'deny') {
    alert('Removing deny rules is not implemented yet.');
  }
  var row = anchor.parentNode.parentNode;
  row.parentNode.removeChild(row);
}

function clearPolicyTable(table) {
  var children = table.getElementsByTagName('tr');
  while (children.length) {
    var child = children.item(0);
    child.parentNode.removeChild(child);
  }
}

function addPolicyTableRow(table, type, origin, dest, ruleData) {
  var rowCount = table.rows.length;
  var row = table.insertRow(rowCount);

  var typeCell = row.insertCell(0);
  typeCell.textContent = type == 'allow' ? 'Allow' : 'Deny';

  var originCell = row.insertCell(1);
  originCell.textContent = origin;

  var destCell = row.insertCell(2);
  destCell.textContent = dest;

  var destCell = row.insertCell(3);
  //destCell.innerHTML = '<a href="#" class="deleterule">X</a>';
  var anchor = document.createElement('a');
  anchor.appendChild(document.createTextNode('X'));
  anchor.setAttribute('class', 'deleterule');
  anchor.setAttribute('onclick', 'deleteRule(event);');
  anchor.requestpolicyRuleType = type;
  anchor.requestpolicyRuleData = ruleData;
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

function onload() {
  var search = document.getElementById('rulesearch');
  search.addEventListener('keyup', function (event) {
    if (searchTimeoutId != null) {
      clearTimeout(searchTimeoutId);
    }
    searchTimeoutId = setTimeout(function () {
      populateRuleTable(event.target.value)
    }, SEARCH_DELAY);
  }, false);
  populateRuleTable();
}
