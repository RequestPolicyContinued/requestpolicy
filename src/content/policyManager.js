function addPolicyTableRow(table, type, origin, dest) {
  var rowCount = table.rows.length;
  var row = table.insertRow(rowCount);

  var typeCell = row.insertCell(0);
  typeCell.textContent = type;

  var originCell = row.insertCell(1);
  originCell.textContent = origin;

  var destCell = row.insertCell(2);
  destCell.textContent = dest;
}

// TODO: remove code duplication with menu.js
function ruleDataPartToDisplayString (ruleDataPart) {
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
  var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
    .getService(Components.interfaces.nsIRequestPolicy);
  var rpServiceJSObject = rpService.wrappedJSObject;


  Components.utils.import("resource://requestpolicy/PolicyManager.jsm");

  var config = {
    "subscriptions" : {
    }
  };

  var policyMgr = new PolicyManager();
  policyMgr.loadPolicies(config);


  for (var name in policyMgr._policies) {
    //alert(name);
  }

  var user = policyMgr._policies['user'];

  var el = document.getElementById('policy-user').getElementsByClassName('allow-rule-count')[0];
  el.textContent = 'There are ' + user.rawPolicy.getAllowRuleCount() + ' "allow" rules in this policy.';
  var el = document.getElementById('policy-user').getElementsByClassName('deny-rule-count')[0];
  el.textContent = 'There are ' + user.rawPolicy.getDenyRuleCount() + ' "deny" rules in this policy.';

  var table = document.getElementById('policy-user').getElementsByClassName('policy')[0];

  var entries = user.rawPolicy.toJSON()['entries'];

  for (var i = 0; i < entries['allow'].length; i++) {
    var entry = entries['allow'][i];
    var origin = entry['o'] ? ruleDataPartToDisplayString(entry['o']) : '';
    var dest = entry['d'] ? ruleDataPartToDisplayString(entry['d']) : '';
    addPolicyTableRow(table, 'allow', origin, dest);
  }
}
