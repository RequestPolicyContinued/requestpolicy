var PAGE_STRINGS = [
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
  'ruleSet',
  'filterRules',
  'policy'
];

$(function () {
  common.localize(PAGE_STRINGS);
  // l10n for input placeholders.
  $id("rulesearch").placeholder = $str('search');
  $('[name=originscheme]').prop('placeholder', $str('scheme'));
  $('[name=destscheme]').prop('placeholder', $str('scheme'));
  $('[name=originhost]').prop('placeholder', $str('host'));
  $('[name=desthost]').prop('placeholder', $str('host'));
  $('[name=originport]').prop('placeholder', $str('port'));
  $('[name=destport]').prop('placeholder', $str('port'));
});

const SEARCH_DELAY = 100;

var searchTimeoutId = null;

function populateRuleTable(filter) {
  searchTimeoutId = null;

  var table = $id('rules');

  clearRulesTable(table);

  // Get and display user rules
  var user = PolicyManager.getUserRulesets()['user'];
  var entries = user.rawRuleset.toJSON()['entries'];
  addRules(entries, 'User', filter, false);

  // Get and display temorary rules
  var temp = PolicyManager.getUserRulesets()['temp'];
  var entries = temp.rawRuleset.toJSON()['entries'];
  addRules(entries, 'Temporary', filter, false);

  // Get and display subscription rules
  var subscriptionLists = PolicyManager.getSubscriptionRulesets();
  for (subscriptionList in subscriptionLists) {
    for (subscription in subscriptionLists[subscriptionList]) {
      entries = subscriptionLists[subscriptionList][subscription].rawRuleset.toJSON()['entries'];
      addRules(entries, subscription, filter, true);
    }
  }

}

function addRules(entries, source, filter, readOnly) {
  var table = $('#rules');
  for (var entryType in entries) {
    for (var i = 0; i < entries[entryType].length; i++) {
      var entry = entries[entryType][i];
      var origin = entry['o'] ? ruleDataPartToDisplayString(entry['o']) : '';
      var dest = entry['d'] ? ruleDataPartToDisplayString(entry['d']) : '';
      if (filter) {
        if (origin.indexOf(filter) == -1 && dest.indexOf(filter) == -1) {
          continue;
        }
      }
      addRulesTableRow(table, entryType, origin, dest, entry, source, readOnly);
    }
  }
}

function deleteRule(event) {
  // TODO: the rule should not be referenced by the rule data but by some
  //       unique identifier. Currently, if there's exactly the same rule twice,
  //       (one of them might be a temporary rule), both will get removed.
  var anchor = $(event.target);
  var ruleAction = anchor.data('requestpolicyRuleAction');
  var ruleData = anchor.data('requestpolicyRuleData');
  if (ruleAction == 'allow') {
    PolicyManager.removeAllowRule(ruleData);
  } else {
    PolicyManager.removeDenyRule(ruleData);
  }
  anchor.closest('tr').remove();
}

function clearRulesTable(table) {
  var children = table.getElementsByTagName('tr');
  while (children.length) {
    var child = children.item(0);
    child.parentNode.removeChild(child);
  }
}

function addRulesTableRow(table, ruleAction, origin, dest, ruleData, source, readOnly) {


  if (ruleAction != 'allow') {
    ruleAction = 'block';
  }
  ruleAction = ruleAction == 'allow' ? 'allow' : 'block';
  var ruleActionString = ruleAction == 'allow' ? $str('allow') : $str('block');

  var row = $('<tr>').addClass(ruleAction).appendTo(table);

  row.append(
    $('<td>').text(ruleActionString),
    $('<td>').text(origin),
    $('<td>').text(dest),
    $('<td>').text(source)
  );

  if (!readOnly) {
    var anchor = $('<a>');
    anchor.text('x').addClass('deleterule');
    anchor.data('requestpolicyRuleAction', ruleAction);
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
    str += ruleDataPart["s"] + ":";

    if (ruleDataPart["h"]) {
      // In case no host has been specified, do not show the
      // two slashes, as it might be an URI without a host.
      str += "//";
    }
  }
  str += ruleDataPart["h"] || "*";
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
  var search = $id('rulesearch');

  // the table is repopulated through the RulesChangedObserver
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
      PolicyManager.addTemporaryAllowRule(ruleData);
    } else {
      PolicyManager.addAllowRule(ruleData);
    }
  } else {
    if (temporary) {
      PolicyManager.addTemporaryDenyRule(ruleData);
    } else {
      PolicyManager.addDenyRule(ruleData);
    }
  }
}



function onload() {
  var search = $id('rulesearch');
  elManager.addListener(search, 'keyup', function (event) {
    if (searchTimeoutId != null) {
      clearTimeout(searchTimeoutId);
    }
    searchTimeoutId = setTimeout(function () {
      populateRuleTable(event.target.value)
    }, SEARCH_DELAY);
  }, false);
  populateRuleTable(search.value);
  if (Prefs.oldRulesExist()) {
    $id("oldrulesexist").hidden = false;
  }

  // observe rule changes and update the table then
  WinEnv.obMan.observe(["rpcontinued-rules-changed"], function() {
    var search = $id('rulesearch');
    populateRuleTable(search.value);
  });
}
