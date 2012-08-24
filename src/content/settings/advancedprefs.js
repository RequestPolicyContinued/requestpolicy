PAGE_STRINGS = ['basic', 'advanced', 'advancedPreferences', 'linkPrefetching',
  'dnsPrefetching', 'enabled', 'disableOnStartup', 'restoreDefaultOnUninstall'];

$(function () {
  common.localize(PAGE_STRINGS);
});

function updateDisplay() {
  // Link prefetch.
  document.getElementById('pref-linkPrefetch').checked =
      rpServiceJSObject._rootPrefs.getBoolPref('network.prefetch-next');

  document.getElementById('pref-prefetch.link.disableOnStartup').checked =
      rpService.prefs.getBoolPref('prefetch.link.disableOnStartup');

  document.getElementById('pref-prefetch.link.restoreDefaultOnUninstall').checked =
      rpService.prefs.getBoolPref('prefetch.link.restoreDefaultOnUninstall');

  // DNS prefetch.
  document.getElementById('pref-dnsPrefetch').checked =
      !rpServiceJSObject._rootPrefs.getBoolPref('network.dns.disablePrefetch');

  document.getElementById('pref-prefetch.dns.disableOnStartup').checked =
      rpService.prefs.getBoolPref('prefetch.dns.disableOnStartup');

  document.getElementById('pref-prefetch.dns.restoreDefaultOnUninstall').checked =
      rpService.prefs.getBoolPref('prefetch.dns.restoreDefaultOnUninstall');
}


function onload() {
  updateDisplay();

  // Link prefetch.
  document.getElementById('pref-linkPrefetch').addEventListener('change',
      function (event) {
        rpServiceJSObject._rootPrefs.setBoolPref('network.prefetch-next', event.target.checked);
        rpServiceJSObject._prefService.savePrefFile(null);
      }
  );

  document.getElementById('pref-prefetch.link.disableOnStartup').addEventListener('change',
      function (event) {
        rpService.prefs.setBoolPref('prefetch.link.disableOnStartup', event.target.checked);
        rpServiceJSObject._prefService.savePrefFile(null);
      }
  );

  document.getElementById('pref-prefetch.link.restoreDefaultOnUninstall').addEventListener('change',
      function (event) {
        rpService.prefs.setBoolPref('prefetch.link.restoreDefaultOnUninstall', event.target.checked);
        rpServiceJSObject._prefService.savePrefFile(null);
      }
  );

  // DNS prefetch.
  document.getElementById('pref-dnsPrefetch').addEventListener('change',
      function (event) {
        rpServiceJSObject._rootPrefs.setBoolPref('network.dns.disablePrefetch', !event.target.checked);
        rpServiceJSObject._prefService.savePrefFile(null);
      }
  );

  document.getElementById('pref-prefetch.dns.disableOnStartup').addEventListener('change',
      function (event) {
        rpService.prefs.setBoolPref('prefetch.dns.disableOnStartup', event.target.checked);
        rpServiceJSObject._prefService.savePrefFile(null);
      }
  );

  document.getElementById('pref-prefetch.dns.restoreDefaultOnUninstall').addEventListener('change',
      function (event) {
        rpService.prefs.setBoolPref('prefetch.dns.restoreDefaultOnUninstall', event.target.checked);
        rpServiceJSObject._prefService.savePrefFile(null);
      }
  );

}
