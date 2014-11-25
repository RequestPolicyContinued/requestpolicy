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

var prefsChangedObserver = null;


function updateDisplay() {
  var indicate = rpService.prefs.getBoolPref('indicateBlockedObjects');
  document.getElementById('pref-indicateBlockedObjects').checked = indicate;
  document.getElementById('indicateBlockedImages-details').hidden = !indicate;

  document.getElementById('pref-dontIndicateBlacklistedObjects').checked =
      !rpService.prefs.getBoolPref('indicateBlacklistedObjects');

  document.getElementById('pref-autoReload').checked =
      rpService.prefs.getBoolPref('autoReload');

  document.getElementById('pref-privateBrowsingPermanentWhitelisting').checked =
      rpService.prefs.getBoolPref('privateBrowsingPermanentWhitelisting');

//  if (rpService.prefs.getBoolPref('defaultPolicy.allow')) {
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
        rpService.prefs.setBoolPref('indicateBlockedObjects', event.target.checked);
        rpService._prefService.savePrefFile(null);
        updateDisplay();
      }
  );

  document.getElementById('pref-dontIndicateBlacklistedObjects').addEventListener('change',
      function (event) {
        rpService.prefs.setBoolPref('indicateBlacklistedObjects', !event.target.checked);
        rpService._prefService.savePrefFile(null);
        updateDisplay();
      }
  );

  document.getElementById('pref-autoReload').addEventListener('change',
    function(event) {
      rpService.prefs.setBoolPref('autoReload', event.target.checked);
      rpService._prefService.savePrefFile(null);
      updateDisplay();
    }
  );

  document.getElementById('pref-privateBrowsingPermanentWhitelisting').addEventListener('change',
      function (event) {
        rpService.prefs.setBoolPref('privateBrowsingPermanentWhitelisting', event.target.checked);
        rpService._prefService.savePrefFile(null);
        updateDisplay();
      }
  );

  // call updateDisplay() every time a preference gets changed
  ObserverManager.observePrefChanges(updateDisplay);
}
