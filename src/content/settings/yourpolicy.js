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
  'removeOldRules',
  'policyList',
  'filterRules',
  'ruleType'
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
});

const SEARCH_DELAY = 100;

var searchTimeoutId = null;

function populateRuleTable(filter) {
  searchTimeoutId = null;

  var policyMgr = rpService._policyMgr;

  var table = document.getElementById('rules');

  clearPolicyTable(table);

  // Get and display user policies
  var user = policyMgr._userPolicies['user'];
  var entries = user.rawPolicy.toJSON()['entries'];
  addPolicies(entries, 'User', filter, false);

  // Get and display temorary policies
  var temp = policyMgr._userPolicies['temp'];
  var entries = temp.rawPolicy.toJSON()['entries'];
  addPolicies(entries, 'Temporary', filter, false);

  // Get and display subscription policies
  var subscription_lists = policyMgr._subscriptionPolicies;
  for (subscription_list in subscription_lists) {
    for (subscription in subscription_lists[subscription_list]) {
      entries = subscription_lists[subscription_list][subscription].rawPolicy.toJSON()['entries'];
      addPolicies(entries, subscription, filter, true);
    }
  }

}

function addPolicies(entries, source, filter, read_only) {
  var table = $('#rules');
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
      addPolicyTableRow(table, entry_type, origin, dest, entry, source, read_only);
    }
  }
}

function deleteRule(event) {
  var anchor = $(event.target);
  var ruleType = anchor.data('requestpolicyRuleType');
  var ruleData = anchor.data('requestpolicyRuleData');
  if (ruleType == 'allow') {
    rpService.removeAllowRule(ruleData);
  } else {
    rpService.removeDenyRule(ruleData);
  }
  anchor.closest('tr').remove();
}

function clearPolicyTable(table) {
  var children = table.getElementsByTagName('tr');
  while (children.length) {
    var child = children.item(0);
    child.parentNode.removeChild(child);
  }
}

function addPolicyTableRow(table, type, origin, dest, ruleData, source, read_only) {

  var type_class = type == 'allow' ? 'allow' : 'block';
  var rule_type = type == 'allow' ? _('allow') : _('block');

  var row = $('<tr>').addClass(type_class).appendTo(table);

  row.append(
    $('<td>').text(rule_type),
    $('<td>').text(origin),
    $('<td>').text(dest),
    $('<td>').text(source)
  );

  if (!read_only) {
    var anchor = $('<a>');
    anchor.text('x').addClass('deleterule');
    anchor.data('requestpolicyRuleType', type);
    anchor.data('requestpolicyRuleData', ruleData);
    anchor.click(deleteRule);
    row.append($('<td>').append(anchor));
  } else {
    row.append($('<td>'));
  }
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
