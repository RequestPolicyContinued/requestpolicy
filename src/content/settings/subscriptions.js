var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
      .getService(Components.interfaces.nsIRequestPolicy);
var rpServiceJSObject = rpService.wrappedJSObject;

var subscriptionNames = [
  'sameorg',
  'functionality',
  'embedded',
  'trackers',
  'mozilla',
  'extensions'
];

function updateDisplay() {
  for each (var sub in subscriptionNames) {
    var enabled = rpService.prefs.getBoolPref('subscription.' + sub);
    document.getElementById('sub-' + sub).checked = enabled;
  }
}

function onload() {
  updateDisplay();

  function handleSubscriptionChange(event) {
    var sub = event.target.name;
    var enabled = event.target.checked;
    rpService.prefs.setBoolPref('subscription.' + sub, enabled);
    rpServiceJSObject._prefService.savePrefFile(null);
  }

  for each (var sub in subscriptionNames) {
    document.getElementById('sub-' + sub)
          .addEventListener('change', handleSubscriptionChange);
  }
}
