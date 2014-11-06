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

var prefsChangedObserver = null;

/**
 * @param {String} policy
 *                 "allow" or "deny"
 */
function getDefaultPolicyElements(policy) {
  var selector = '[data-default-policy=' + policy + ']';
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
  var userSubs = rpService._subscriptions;
  var subsInfo = userSubs.getSubscriptionInfo();
  var allSubElements = getAllSubscriptionElements();
  debugger;
  for (var i = 0, len = allSubElements.length; i < len; ++i) {
    var element = allSubElements[i];
    element.input.checked = (element.id in subsInfo['official']);
  }

  if (rpService._defaultAllow) {
    var currentPolicy = 'allow', otherPolicy = 'deny';
  } else {
    var currentPolicy = 'deny', otherPolicy = 'allow';
  }
  displayDefaultPolicyElements(currentPolicy, true);
  displayDefaultPolicyElements(otherPolicy, false);
}



function handleSubscriptionCheckboxChange(event) {
  var userSubs = rpService._subscriptions;

  var subName = event.target.name;
  var enabled = event.target.checked;
  var subInfo = {};
  subInfo['official'] = {};
  subInfo['official'][subName] = true;
  if (enabled) {
    userSubs.addSubscription('official', subName);
    observerService.notifyObservers(null, SUBSCRIPTION_ADDED_TOPIC,
          JSON.stringify(subInfo));
  } else {
    userSubs.removeSubscription('official', subName);
    observerService.notifyObservers(null, SUBSCRIPTION_REMOVED_TOPIC,
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
    el.addEventListener('change', handleSubscriptionCheckboxChange);
  }

  prefsChangedObserver = new common.PrefsChangedObserver(
      function(subject, topic, data) {
        updateDisplay();
      });
  window.addEventListener("beforeunload", function(event) {
    prefsChangedObserver.unregister();
  });
}
