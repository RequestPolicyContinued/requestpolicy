PAGE_STRINGS = [
  'basic',
  'advanced',
  'webPages',
  'indicateBlockedImages',
  'dontIndicateBlacklisted',
  'autoReload',
  'menu',
  'allowAddingNonTemporaryRulesInPBM'
];

$(function () {
  common.localize(PAGE_STRINGS);
});

Cu.import("resource://gre/modules/Services.jsm");

var prefsChangedObserver = null;


function updateDisplay() {
  var indicate = rpService.prefs.getBoolPref('indicateBlockedObjects');
  document.getElementById('pref-indicateBlockedObjects').checked = indicate;
  document.getElementById('indicateBlockedImages-details').hidden = !indicate;

  document.getElementById('pref-dontIndicateBlacklistedObjects').checked =
      !rpService.prefs.getBoolPref('indicateBlacklistedObjects');

  document.getElementById('pref-autoReload').checked =
      Prefs.prefs.getBoolPref('autoReload');

  document.getElementById('pref-privateBrowsingPermanentWhitelisting').checked =
      Prefs.prefs.getBoolPref('privateBrowsingPermanentWhitelisting');

//  if (Prefs.prefs.getBoolPref('defaultPolicy.allow')) {
//    var word = 'allow';
//  } else {
//    var word = 'block';
//  }
//  document.getElementById('defaultpolicyword').innerHTML = word;
}


function onload() {
  updateDisplay();

  document.getElementById('pref-indicateBlockedObjects').addEventListener('change',
      function (event) {
        Prefs.prefs.setBoolPref('indicateBlockedObjects', event.target.checked);
        Services.prefs.savePrefFile(null);
        updateDisplay();
      }
  );

  document.getElementById('pref-dontIndicateBlacklistedObjects').addEventListener('change',
      function (event) {
        Prefs.prefs.setBoolPref('indicateBlacklistedObjects', !event.target.checked);
        Services.prefs.savePrefFile(null);
        updateDisplay();
      }
  );

  document.getElementById('pref-autoReload').addEventListener('change',
    function(event) {
      Prefs.prefs.setBoolPref('autoReload', event.target.checked);
      Services.prefs.savePrefFile(null);
      updateDisplay();
    }
  );

  document.getElementById('pref-privateBrowsingPermanentWhitelisting').addEventListener('change',
      function (event) {
        Prefs.prefs.setBoolPref('privateBrowsingPermanentWhitelisting', event.target.checked);
        Services.prefs.savePrefFile(null);
        updateDisplay();
      }
  );

  // call updateDisplay() every time a preference gets changed
  ObserverManager.observePrefChanges(updateDisplay);
}
