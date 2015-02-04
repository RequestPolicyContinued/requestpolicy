var PAGE_STRINGS = [
  'yourPolicy',
  'defaultPolicy',
  'subscriptions',
  'learnMore',
  'subscriptionPolicies',
  'subscriptionPoliciesDefinition',
  'usability',
  'privacy',
  'browser',
  'subscriptionDenyTrackersDescription',
  'subscriptionAllowSameOrgDescription',
  'subscriptionAllowFunctionalityDescription',
  'subscriptionAllowEmbeddedDescription',
  'subscriptionAllowMozillaDescription',
  'subscriptionAllowExtensionsDescription'
];

$(function () {
  common.localize(PAGE_STRINGS);
});

/**
 * @param {String} policy
 *                 "allow" or "deny"
 */
function getDefaultPolicyElements(policy) {
  var selector = '[data-defaultpolicy=' + policy + ']';
  var matches = document.body.querySelectorAll(selector);
  var elements = Array.prototype.slice.call(matches);
  return elements;
}

function displayDefaultPolicyElements(policy, display) {
  // note: display could be undefined.
  display = display === false ? false : true;
  var elements = getDefaultPolicyElements(policy);
  for (var i = 0, len = elements.length; i < len; i++) {
    if (display) {
      elements[i].removeAttribute("style");
    } else {
      elements[i].style.display = 'none';
    }
  }
}

function getInputElement(subName) {
  var elements = document.body.querySelectorAll('input[name=' + subName + ']');
  if (elements.length <= 0) {
    return null;
  }
  return elements[0];
}

function getAllSubscriptionElements() {
  var divs = document.getElementsByClassName("subscription");
  var elements = [];
  for (var i = 0, len = divs.length; i < len; ++i) {
    var div = divs[i];
    elements.push({
        id: div.id,
        div: div,
        input: getInputElement(div.id)});
  }
  return elements;
}

function updateDisplay() {
  var userSubs = rpService.getSubscriptions();
  var subsInfo = userSubs.getSubscriptionInfo();
  var allSubElements = getAllSubscriptionElements();
  for (var i = 0, len = allSubElements.length; i < len; ++i) {
    var element = allSubElements[i];
    element.input.checked = (element.id in subsInfo['official']);
  }

  if (Prefs.isDefaultAllow) {
    var currentPolicy = 'allow', otherPolicy = 'deny';
  } else {
    var currentPolicy = 'deny', otherPolicy = 'allow';
  }
  displayDefaultPolicyElements(currentPolicy, true);
  displayDefaultPolicyElements(otherPolicy, false);
}



function handleSubscriptionCheckboxChange(event) {
  var userSubs = rpService.getSubscriptions();

  var subName = event.target.name;
  var enabled = event.target.checked;
  var subInfo = {};
  subInfo['official'] = {};
  subInfo['official'][subName] = true;
  if (enabled) {
    userSubs.addSubscription('official', subName);
    Services.obs.notifyObservers(null, SUBSCRIPTION_ADDED_TOPIC,
          JSON.stringify(subInfo));
  } else {
    userSubs.removeSubscription('official', subName);
    Services.obs.notifyObservers(null, SUBSCRIPTION_REMOVED_TOPIC,
          JSON.stringify(subInfo));
  }
}

function onload() {
  updateDisplay();

  var available = {
    'allow_embedded' : {},
    'allow_extensions' : {},
    'allow_functionality' : {},
    'allow_mozilla' : {},
    'allow_sameorg' : {},
    'deny_trackers' : {}
  };
  for (var subName in available) {
    var el = getInputElement(subName);
    if (!el) {
      Logger.dump('Skipping unexpected official subName: ' + subName);
      continue;
    }
    elManager.addListener(el, 'change', handleSubscriptionCheckboxChange);
  }

  var selector = '[data-defaultpolicy=' +
    (Prefs.isDefaultAllow() ? 'deny' : 'allow') + ']';
  var matches = document.body.querySelectorAll(selector);
  var hideElements = Array.prototype.slice.call(matches);
  for (var i = 0; i < hideElements.length; i++) {
    hideElements[i].style.display = 'none';
  }

  // call updateDisplay() every time a subscription is added or removed
  WinEnv.obMan.observe([
    SUBSCRIPTION_ADDED_TOPIC,
    SUBSCRIPTION_REMOVED_TOPIC
  ], updateDisplay);
}
