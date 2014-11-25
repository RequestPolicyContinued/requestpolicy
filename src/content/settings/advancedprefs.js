PAGE_STRINGS = [
  'basic',
  'advanced',
  'advancedPreferences',
  'linkPrefetching',
  'dnsPrefetching',
  'enabled',
  'disableOnStartup',
  'restoreDefaultOnUninstall',
  'menuPreferences',
  'menuSorting',
  'sortByNumRequests',
  'sortByDestName',
  'noSorting',
  'hint',
  'menuSortingHint',
  'menuIndicatedInformation',
  'menuIndicateNumRequests'
];

$(function () {
  common.localize(PAGE_STRINGS);
});

Cu.import("resource://gre/modules/Services.jsm");

var prefsChangedObserver = null;


function updateDisplay() {
  // Link prefetch.
  document.getElementById('pref-linkPrefetch').checked =
      Prefs.prefsRoot.getBoolPref('network.prefetch-next');

  document.getElementById('pref-prefetch.link.disableOnStartup').checked =
      Prefs.prefs.getBoolPref('prefetch.link.disableOnStartup');

  document.getElementById('pref-prefetch.link.restoreDefaultOnUninstall').checked =
      Prefs.prefs.getBoolPref('prefetch.link.restoreDefaultOnUninstall');

  // DNS prefetch.
  document.getElementById('pref-dnsPrefetch').checked =
      !Prefs.prefsRoot.getBoolPref('network.dns.disablePrefetch');

  document.getElementById('pref-prefetch.dns.disableOnStartup').checked =
      Prefs.prefs.getBoolPref('prefetch.dns.disableOnStartup');

  document.getElementById('pref-prefetch.dns.restoreDefaultOnUninstall').checked =
      Prefs.prefs.getBoolPref('prefetch.dns.restoreDefaultOnUninstall');

  // TODO: Create a class which acts as an API for preferences and which ensures
  // that the returned value is always a valid value for "string" preferences.
  var sorting = Prefs.prefs.getCharPref('menu.sorting');

  if (sorting == document.getElementById('sortByNumRequests').value) {
    document.getElementById('sortByNumRequests').checked = true;
    document.getElementById('sortByDestName').checked = false;
    document.getElementById('noSorting').checked = false;
  } else if (sorting == document.getElementById('noSorting').value) {
    document.getElementById('sortByNumRequests').checked = false;
    document.getElementById('sortByDestName').checked = false;
    document.getElementById('noSorting').checked = true;
  } else {
    document.getElementById('sortByNumRequests').checked = false;
    document.getElementById('sortByDestName').checked = true;
    document.getElementById('noSorting').checked = false;
  }

  document.getElementById('menu.info.showNumRequests').checked =
      Prefs.prefs.getBoolPref('menu.info.showNumRequests');
}


function onload() {
  updateDisplay();

  // Link prefetch.
  document.getElementById('pref-linkPrefetch').addEventListener('change',
      function (event) {
        Prefs.prefsRoot.setBoolPref('network.prefetch-next', event.target.checked);
        Services.prefs.savePrefFile(null);
      }
  );

  document.getElementById('pref-prefetch.link.disableOnStartup').addEventListener('change',
      function (event) {
        Prefs.prefs.setBoolPref('prefetch.link.disableOnStartup',
            event.target.checked);
        Services.prefs.savePrefFile(null);
      }
  );

  document.getElementById('pref-prefetch.link.restoreDefaultOnUninstall').addEventListener('change',
      function (event) {
        Prefs.prefs.setBoolPref('prefetch.link.restoreDefaultOnUninstall', event.target.checked);
        Services.prefs.savePrefFile(null);
      }
  );

  // DNS prefetch.
  document.getElementById('pref-dnsPrefetch').addEventListener('change',
      function (event) {
        Prefs.prefsRoot.setBoolPref('network.dns.disablePrefetch', !event.target.checked);
        Services.prefs.savePrefFile(null);
      }
  );

  document.getElementById('pref-prefetch.dns.disableOnStartup').addEventListener('change',
      function (event) {
        Prefs.prefs.setBoolPref('prefetch.dns.disableOnStartup', event.target.checked);
        Services.prefs.savePrefFile(null);
      }
  );

  document.getElementById('pref-prefetch.dns.restoreDefaultOnUninstall').addEventListener('change',
      function (event) {
        Prefs.prefs.setBoolPref('prefetch.dns.restoreDefaultOnUninstall', event.target.checked);
        Services.prefs.savePrefFile(null);
      }
  );

  var sortingListener = function (event) {
    Prefs.prefs.setCharPref('menu.sorting', event.target.value);
    Services.prefs.savePrefFile(null);
  };
  document.getElementById('sortByNumRequests').addEventListener('change', sortingListener);
  document.getElementById('sortByDestName').addEventListener('change', sortingListener);
  document.getElementById('noSorting').addEventListener('change', sortingListener);

  document.getElementById('menu.info.showNumRequests').addEventListener('change',
      function (event) {
        Prefs.prefs.setBoolPref('menu.info.showNumRequests', event.target.checked);
        Services.prefs.savePrefFile(null);
      }
  );

  // call updateDisplay() every time a preference gets changed
  ObserverManager.observePrefChanges(updateDisplay);
}
