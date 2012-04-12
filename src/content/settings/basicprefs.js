var rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
  .getService(Components.interfaces.nsIRequestPolicy);
var rpServiceJSObject = rpService.wrappedJSObject;


function updateDisplay() {
  document.getElementById('pref-indicateBlockedObjects').checked =
    rpService.prefs.getBoolPref('indicateBlockedObjects');

//  document.getElementById('pref-autoReload').checked =
//    rpService.prefs.getBoolPref('autoReload');

  document.getElementById('pref-privateBrowsingPermanentWhitelisting').checked =
    rpService.prefs.getBoolPref('privateBrowsingPermanentWhitelisting');

  if (rpService.prefs.getBoolPref('defaultPolicy.allow')) {
    var word = 'allow';
  } else {
    var word = 'block';
  }
  document.getElementById('defaultpolicyword').innerHTML = word;
}


function onload() {
  updateDisplay();

  document.getElementById('pref-indicateBlockedObjects').addEventListener('change',
     function(event) {
       rpService.prefs.setBoolPref('indicateBlockedObjects', event.target.checked);
       rpServiceJSObject._prefService.savePrefFile(null);
     }
  );

//  document.getElementById('pref-autoReload').addEventListener('change',
//    function(event) {
//      rpService.prefs.setBoolPref('autoReload', event.target.checked);
//      rpServiceJSObject._prefService.savePrefFile(null);
//    }
//  );

  document.getElementById('pref-privateBrowsingPermanentWhitelisting').addEventListener('change',
    function(event) {
      rpService.prefs.setBoolPref('privateBrowsingPermanentWhitelisting', event.target.checked);
      rpServiceJSObject._prefService.savePrefFile(null);
    }
  );
}
