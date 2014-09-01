PAGE_STRINGS = [
  'yourPolicy',
  'defaultPolicy',
  'subscriptions',
  'type',
  'origin',
  'destination',
  'allow',
  'block',
  'temporary',
  'addRule',
  'learnMoreAboutRules',
  'removeOldRules'
];

$(function () {
  common.localize(PAGE_STRINGS);
  // l10n for input placeholders.
  $('#rulesearch').prop('placeholder', _('search'));
  $('[name=originscheme]').prop('placeholder', _('scheme'));
  $('[name=destscheme]').prop('placeholder', _('scheme'));
  $('[name=originhost]').prop('placeholder', _('host'));
  $('[name=desthost]').prop('placeholder', _('host'));
  $('[name=originport]').prop('placeholder', _('port'));
  $('[name=destport]').prop('placeholder', _('port'));

  var rows_highlighted = false;

  $('#highlight_rows').change(function () {
    rows_highlighted = !rows_highlighted;
    if (rows_highlighted) {
      $('#policy-user tr').addClass('highlight');
    } else {
      $('#policy-user tr').removeClass('highlight');
    }
  });

});

const SEARCH_DELAY = 100;

var searchTimeoutId = null;

function populateRuleTable(filter) {
  searchTimeoutId = null;

  var policyMgr = rpService._policyMgr;

  var table = document.getElementById('policy-user');

  clearPolicyTable(table);

  // Get and display user policies
  var user = policyMgr._userPolicies['user'];
  var entries = user.rawPolicy.toJSON()['entries'];
  addPolicies(entries, 'User', filter);

  // Get and display temorary policies
  var temp = policyMgr._userPolicies['temp'];
  var entries = temp.rawPolicy.toJSON()['entries'];
  addPolicies(entries, 'Temporary', filter);

}

function addPolicies(entries, source, filter) {
  var table = document.getElementById('policy-user');
  for (var entry_type in entries) {
    for (var i = 0; i < entries[entry_type].length; i++) {
      var entry = entries[entry_type][i];
      var origin = entry['o'] ? ruleDataPartToDisplayString(entry['o']) : '';
      var dest = entry['d'] ? ruleDataPartToDisplayString(entry['d']) : '';
      if (filter) {
        if (origin.indexOf(filter) == -1 && dest.indexOf(filter) == -1) {
          continue;
        }
      }
      addPolicyTableRow(table, entry_type, origin, dest, entry, source);
    }
  }
}

function deleteRule(event) {
  var anchor = event.target;
  var ruleType = anchor.requestpolicyRuleType;
  var ruleData = anchor.requestpolicyRuleData;
  if (ruleType == 'allow') {
    rpService.removeAllowRule(ruleData);
  } else {
    rpService.removeDenyRule(ruleData);
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

function addPolicyTableRow(table, type, origin, dest, ruleData, source) {
  var rowCount = table.rows.length;
  var row = table.insertRow(rowCount);

  var type_class = type == 'allow' ? 'allow' : 'block';
  row.setAttribute('class', type_class);

  var typeCell = row.insertCell(0);
  typeCell.textContent = type == 'allow' ? 'Allow' : 'Block';

  var originCell = row.insertCell(1);
  originCell.textContent = origin;

  var destCell = row.insertCell(2);
  destCell.textContent = dest;

  // Source Cell
  var sourceCell = row.insertCell(3);
  sourceCell.textContent = source;

  var removeCell = row.insertCell(4);
  var anchor = document.createElement('a');
  anchor.appendChild(document.createTextNode('X'));
  anchor.setAttribute('class', 'deleterule');
  anchor.setAttribute('onclick', 'deleteRule(event);');
  anchor.requestpolicyRuleType = type;
  anchor.requestpolicyRuleData = ruleData;
  removeCell.appendChild(anchor);
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

function addRuleHelper() {
  var form = document.forms['addruleform'];
  var allow = form.elements['allowrule'].checked ? true : false;
  var temporary = form.elements['temporary'].checked ? true : false;
  var originScheme = form.elements['originscheme'].value;
  var originHost = form.elements['originhost'].value;
  var originPort = form.elements['originport'].value;
  var destScheme = form.elements['destscheme'].value;
  var destHost = form.elements['desthost'].value;
  var destPort = form.elements['destport'].value;
  // TODO: we either need to sanity check the ruleData here or the policy needs
  // to do this when it is added. Probably better to do it in the policy code.
  function ruleInfoToRuleDataPart(scheme, host, port) {
    if (!scheme && !host && !port) {
      return null;
    }
    var part = {};
    if (scheme) {
      part['s'] = scheme;
    }
    if (host) {
      part['h'] = host;
    }
    if (port) {
      part['port'] = port;
    }
    return part;
  }
  var originPart = ruleInfoToRuleDataPart(originScheme, originHost, originPort);
  var destPart = ruleInfoToRuleDataPart(destScheme, destHost, destPort);
  if (!originPart && !destPart) {
    // TODO: don't throw, instead show message in form.
    throw 'You must specify some rule information';
  }
  var ruleData = {};
  if (originPart) {
    ruleData['o'] = originPart;
  }
  if (destPart) {
    ruleData['d'] = destPart;
  }
  if (allow) {
    if (temporary) {
      rpService.addTemporaryAllowRule(ruleData);
    } else {
      rpService.addAllowRule(ruleData);
    }
  } else {
    if (temporary) {
      rpService.addTemporaryDenyRule(ruleData);
    } else {
      rpService.addDenyRule(ruleData);
    }
  }
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
  if (rpService.oldRulesExist()) {
    $('#oldrulesexist').show();
  }
}
