/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["rpService"];

const HTTPS_EVERYWHERE_REWRITE_TOPIC = "https-everywhere-uri-rewrite";

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "logger",
  "prefs",
  "domain-util",
  "policy-manager",
  "request-processor",
  "subscription",
  "utils",
  "content-policy",
  "constants"
], this);



let rpService = (function() {
  let self;

  // /////////////////////////////////////////////////////////////////////////
  // Internal Data
  // /////////////////////////////////////////////////////////////////////////

  let rpServiceInitialized = false;

  let conflictingExtensions = [];
  let compatibilityRules = [];
  let topLevelDocTranslationRules = [];

  let subscriptions = null;

  let addonListener = {
    onDisabling : function(addon, needsRestart) {},
    onUninstalling : function(addon, needsRestart) {},
    onOperationCancelled : function(addon, needsRestart) {}
  };


  // /////////////////////////////////////////////////////////////////////////
  // Utility
  // /////////////////////////////////////////////////////////////////////////

  function handleUninstallOrDisable() {
    Logger.debug(Logger.TYPE_INTERNAL, "Performing 'disable' operations.");
    var resetLinkPrefetch = Prefs.prefs.getBoolPref(
        "prefetch.link.restoreDefaultOnUninstall");
    var resetDNSPrefetch = Prefs.prefs.getBoolPref(
        "prefetch.dns.restoreDefaultOnUninstall");

    if (resetLinkPrefetch) {
      if (Prefs.prefsRoot.prefHasUserValue("network.prefetch-next")) {
        Prefs.prefsRoot.clearUserPref("network.prefetch-next");
      }
    }
    if (resetDNSPrefetch) {
      if (Prefs.prefsRoot.prefHasUserValue("network.dns.disablePrefetch")) {
        Prefs.prefsRoot.clearUserPref("network.dns.disablePrefetch");
      }
    }
    Services.prefs.savePrefFile(null);
  }

  function init() {
    if (rpServiceInitialized) {
      return;
    }
    rpServiceInitialized = true;

    try {
      PolicyImplementation.init();
      register();

      // TODO:
      //initializePrivateBrowsing();

      // Note that we don't load user preferences at this point because the user
      // preferences may not be ready. If we tried right now, we may get the
      // default preferences.
    } catch(e) {
      // in case the libraries could not be loaded, the Logger is not available
      Logger.severeError("exception from init(): " + e, e);
    }
  }


  function initializeExtensionCompatibility() {
    if (compatibilityRules.length != 0) {
      return;
    }

    var idArray = [];
    idArray.push("greasefire@skrul.com"); // GreaseFire
    idArray.push("{0f9daf7e-2ee2-4fcf-9d4f-d43d93963420}"); // Sage-Too
    idArray.push("{899DF1F8-2F43-4394-8315-37F6744E6319}"); // NewsFox
    idArray.push("brief@mozdev.org"); // Brief
    idArray.push("foxmarks@kei.com"); // Xmarks Sync (a.k.a. Foxmarks)
    // Norton Safe Web Lite Toolbar
    idArray.push("{203FB6B2-2E1E-4474-863B-4C483ECCE78E}");
    // Norton Toolbar (a.k.a. NIS Toolbar)
    idArray.push("{0C55C096-0F1D-4F28-AAA2-85EF591126E7}");
    // Norton Toolbar 2011.7.0.8
    idArray.push("{2D3F3651-74B9-4795-BDEC-6DA2F431CB62}");
    idArray.push("{c45c406e-ab73-11d8-be73-000a95be3b12}"); // Web Developer
    idArray.push("{c07d1a49-9894-49ff-a594-38960ede8fb9}"); // Update Scanner
    idArray.push("FirefoxAddon@similarWeb.com"); // SimilarWeb
    idArray.push("{6614d11d-d21d-b211-ae23-815234e1ebb5}"); // Dr. Web Link Checker

    for (let i in idArray) {
      Logger.info(Logger.TYPE_INTERNAL, "Extension check: " + idArray[i]);
      AddonManager.getAddonByID(idArray[i], initializeExtCompatCallback);
    }
  }

  function initializeExtCompatCallback(ext) {
    if (!ext) {
      return;
    }

    if (ext.isActive === false) {
      Logger.info(Logger.TYPE_INTERNAL, "Extension is not active: " + ext.name);
      return;
    }

    switch (ext.id) {
      case "greasefire@skrul.com" : // Greasefire
        Logger.info(Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        compatibilityRules.push(
            ["file://", "http://userscripts.org/", ext.name]);
        compatibilityRules.push(
            ["file://", "http://static.userscripts.org/", ext.name]);
        break;
      case "{0f9daf7e-2ee2-4fcf-9d4f-d43d93963420}" : // Sage-Too
      case "{899DF1F8-2F43-4394-8315-37F6744E6319}" : // NewsFox
      case "brief@mozdev.org" : // Brief
        Logger.info(Logger.TYPE_INTERNAL, "Conflicting extension: " + ext.name);
        compatibilityRules.push(
            ["resource://brief-content/", null, ext.name]);
        conflictingExtensions.push({
          "id" : ext.id,
          "name" : ext.name,
          "version" : ext.version
        });
        break;
      case "foxmarks@kei.com" : // Xmarks Sync
        Logger.info(Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        compatibilityRules.push([
          "https://login.xmarks.com/",
          "https://static.xmarks.com/",
          ext.name
        ]);
        break;
      case "{203FB6B2-2E1E-4474-863B-4C483ECCE78E}" : // Norton Safe Web Lite
      case "{0C55C096-0F1D-4F28-AAA2-85EF591126E7}" : // Norton NIS Toolbar
      case "{2D3F3651-74B9-4795-BDEC-6DA2F431CB62}" : // Norton Toolbar
        Logger.info(Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        compatibilityRules.push([null, "symnst:", ext.name]);
        compatibilityRules.push([null, "symres:", ext.name]);
        break;
      case "{c45c406e-ab73-11d8-be73-000a95be3b12}" : // Web Developer
        Logger.info(Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        compatibilityRules.push([
          "about:blank",
          "http://jigsaw.w3.org/css-validator/validator",
          ext.name
        ]);
        compatibilityRules.push(
            ["about:blank", "http://validator.w3.org/check", ext.name]);
        break;
      case "{c07d1a49-9894-49ff-a594-38960ede8fb9}" : // Update Scanner
        Logger.info(Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        var orig = "chrome://updatescan/content/diffPage.xul";
        var translated = "data:text/html";
        topLevelDocTranslationRules.push([orig, translated]);
        break;
      case "FirefoxAddon@similarWeb.com" : // SimilarWeb
        Logger.info(Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        compatibilityRules.push([
          "http://api2.similarsites.com/",
          "http://images2.similargroup.com/",
          ext.name
        ]);
        compatibilityRules.push([
          "http://www.similarweb.com/",
          "http://go.similarsites.com/",
          ext.name
        ]);
        break;
      case "{6614d11d-d21d-b211-ae23-815234e1ebb5}" : // Dr. Web Link Checker
        Logger.info(Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        compatibilityRules.push([null, "http://st.drweb.com/", ext.name]);
        break;
      default :
        Logger.severe(Logger.TYPE_INTERNAL,
            "Unhandled extension (id typo?): " + ext.name);
        break;
    }
  }

  function initializeApplicationCompatibility() {
    var appInfo = Cc["@mozilla.org/xre/app-info;1"].
        getService(Ci.nsIXULAppInfo);

    // Mozilla updates (doing this for all applications, not just individual
    // applications from the Mozilla community that I'm aware of).
    // At least the http url is needed for Firefox updates, adding the https
    // one as well to be safe.
    compatibilityRules.push(
        ["http://download.mozilla.org/", null, appInfo.vendor]);
    compatibilityRules.push(
        ["https://download.mozilla.org/", null, appInfo.vendor]);
    // There are redirects from 'addons' to 'releases' when installing addons
    // from AMO. Adding the origin of 'releases' to be safe in case those
    // start redirecting elsewhere at some point.
    compatibilityRules.push(
        ["http://addons.mozilla.org/", null, appInfo.vendor]);
    compatibilityRules.push(
        ["https://addons.mozilla.org/", null, appInfo.vendor]);
    compatibilityRules.push(
        ["http://releases.mozilla.org/", null, appInfo.vendor]);
    compatibilityRules.push(
        ["https://releases.mozilla.org/", null, appInfo.vendor]);
    // Firefox 4 has the about:addons page open an iframe to the mozilla site.
    // That opened page grabs content from other mozilla domains.
    compatibilityRules.push([
      "about:addons",
      "https://services.addons.mozilla.org/",
      appInfo.vendor
    ]);
    compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://static.addons.mozilla.net/",
      appInfo.vendor
    ]);
    compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://addons.mozilla.org/",
      appInfo.vendor]);
    compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://www.mozilla.com/",
      appInfo.vendor
    ]);
    compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://www.getpersonas.com/",
      appInfo.vendor
    ]);
    compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://static-cdn.addons.mozilla.net/",
      appInfo.vendor
    ]);
    compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://addons.cdn.mozilla.net/",
      appInfo.vendor
    ]);
    // Firefox 4 uses an about:home page that is locally stored but can be
    // the origin for remote requests. See bug #140 for more info.
    compatibilityRules.push(["about:home", null, appInfo.vendor]);
    // Firefox Sync uses a google captcha.
    compatibilityRules.push([
      "https://auth.services.mozilla.com/",
      "https://api-secure.recaptcha.net/challenge?",
      appInfo.vendor
    ]);
    compatibilityRules.push([
      "https://api-secure.recaptcha.net/challenge?",
      "https://www.google.com/recaptcha/api/challenge?",
      appInfo.vendor
    ]);
    compatibilityRules.push([
      "https://auth.services.mozilla.com/",
      "https://www.google.com/recaptcha/api/",
      appInfo.vendor
    ]);
    // Firefox 13 added links from about:newtab
    compatibilityRules.push(["about:newtab", null, appInfo.vendor]);

    // Flock
    if (appInfo.ID == "{a463f10c-3994-11da-9945-000d60ca027b}") {
      Logger.info(Logger.TYPE_INTERNAL,
          "Application detected: " + appInfo.vendor);
      compatibilityRules.push(
          ["about:myworld", "http://www.flock.com/", appInfo.vendor]);
      compatibilityRules.push(["about:flock", null, appInfo.vendor]);
      compatibilityRules.push([
        "http://www.flock.com/rss",
        "http://feeds.feedburner.com/flock",
        appInfo.vendor
      ]);
      compatibilityRules.push([
        "http://feeds.feedburner.com/",
        "http://www.flock.com/",
        appInfo.vendor
      ]);
    }

    // Seamonkey
    if (appInfo.ID == "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}") {
      Logger.info(Logger.TYPE_INTERNAL, "Application detected: Seamonkey");
      compatibilityRules.push(["mailbox:", null, "Seamonkey"]);
      compatibilityRules.push([null, "mailbox:", "Seamonkey"]);
    }
  }

  function loadConfigAndRules() {
    subscriptions = new UserSubscriptions();
    PolicyManager.loadUserRules();

    var defaultPolicy = Prefs.prefs.defaultAllow ? 'allow' : 'deny';

    var failures = PolicyManager.loadSubscriptionRules(
          subscriptions.getSubscriptionInfo(defaultPolicy));
    // TODO: check a preference that indicates the last time we checked for
    // updates. Don't do it if we've done it too recently.
    // TODO: Maybe we should probably ship snapshot versions of the official
    // rulesets so that they can be available immediately after installation.
    var serials = {};
    for (var listName in failures) {
      serials[listName] = {};
      for (var subName in failures[listName]) {
        serials[listName][subName] = -1;
      }
    }
    var loadedSubs = PolicyManager.getSubscriptionRulesets();
    for (var listName in loadedSubs) {
      for (var subName in loadedSubs[listName]) {
        if (!serials[listName]) {
          serials[listName] = {};
        }
        var rawRuleset = loadedSubs[listName][subName].rawRuleset;
        serials[listName][subName] = rawRuleset._metadata['serial'];
      }
    }
    function updateCompleted(result) {
      Logger.info(Logger.TYPE_INTERNAL,
          'Subscription updates completed: ' + result);
    }
    subscriptions.update(updateCompleted, serials, defaultPolicy);
  }

  function register() {
    let obs = Services.obs;
    obs.addObserver(self, "http-on-examine-response", false);
    obs.addObserver(self, "http-on-modify-request", false);
    obs.addObserver(self, "sessionstore-windows-restored", false);
    obs.addObserver(self, "private-browsing", false);
    obs.addObserver(self, HTTPS_EVERYWHERE_REWRITE_TOPIC, false);
    obs.addObserver(self, SUBSCRIPTION_UPDATED_TOPIC, false);
    obs.addObserver(self, SUBSCRIPTION_ADDED_TOPIC, false);
    obs.addObserver(self, SUBSCRIPTION_REMOVED_TOPIC, false);

    AddonManager.addAddonListener(addonListener);
  }

  function unregister() {
    let obs = Services.obs;
    obs.removeObserver(self, "http-on-examine-response");
    obs.removeObserver(self, "http-on-modify-request");
    obs.removeObserver(self, "sessionstore-windows-restored");
    obs.removeObserver(self, SUBSCRIPTION_UPDATED_TOPIC);
    obs.removeObserver(self, SUBSCRIPTION_ADDED_TOPIC);
    obs.removeObserver(self, SUBSCRIPTION_REMOVED_TOPIC);

    AddonManager.removeAddonListener(addonListener);
  }

  // TODO: fix this
  function initializePrivateBrowsing() {
    try {
      var pbs = Cc["@mozilla.org/privatebrowsing;1"].
          getService(Ci.nsIPrivateBrowsingService);
      self._privateBrowsingEnabled = pbs.privateBrowsingEnabled;
    } catch (e) {
      // Ignore exceptions from browsers that do not support private browsing.
    }
  }

  function showWelcomeWindow() {
    if (!Prefs.prefs.getBoolPref("welcomeWindowShown")) {
      var url = "chrome://requestpolicy/content/settings/setup.html";

      var wm = Cc['@mozilla.org/appshell/window-mediator;1'].
          getService(Ci.nsIWindowMediator);
      var windowtype = 'navigator:browser';
      var mostRecentWindow  = wm.getMostRecentWindow(windowtype);

      // the gBrowser object of the firefox window
      var _gBrowser = mostRecentWindow.getBrowser();

      if (typeof(_gBrowser.addTab) != "function") return;

      _gBrowser.selectedTab = _gBrowser.addTab(url);

      Prefs.prefs.setBoolPref("welcomeWindowShown", true);
      Services.prefs.savePrefFile(null);
    }
  }







  self = {
    // TODO: private windows instead.
    _privateBrowsingEnabled : false,


    isPrivateBrowsingEnabled: function() {
      return self._privateBrowsingEnabled;
    },
    getSubscriptions: function() {
      return subscriptions;
    },
    getCompatibilityRules: function() {
      return compatibilityRules;
    },



    // /////////////////////////////////////////////////////////////////////////
    // Bootstrap methods
    // /////////////////////////////////////////////////////////////////////////

    startup: function() {
      init();

      loadConfigAndRules();
      // Detect other installed extensions and the current application and do
      // what is needed to allow their requests.
      initializeExtensionCompatibility();
      initializeApplicationCompatibility();
    },
    shutdown: function(data, reason) {
      if (reason == ADDON_DISABLE || reason == ADDON_UNINSTALL) {
        handleUninstallOrDisable();
      }
      unregister();
      PolicyImplementation.shutdown(data, reason);
      rpServiceInitialized = false;
    },
    install: function(data, reason) {
    },
    uninstall: function(data, reason) {
      handleUninstallOrDisable();
    },




    // /////////////////////////////////////////////////////////////////////////
    // nsIRequestPolicy interface
    // /////////////////////////////////////////////////////////////////////////

    getConflictingExtensions : function() {
      return conflictingExtensions;
    },

    getTopLevelDocTranslations : function() {
      return topLevelDocTranslationRules;
    },

    /**
     * Handles observer notifications sent by the HTTPS Everywhere extension
     * that inform us of URIs that extension has rewritten.
     *
     * @param nsIURI oldURI
     * @param string newSpec
     */
    _handleHttpsEverywhereUriRewrite : function(oldURI, newSpec) {
      oldURI = oldURI.QueryInterface(Ci.nsIURI);
      RequestProcessor.mapDestinations(oldURI.spec, newSpec);
    },




    // /////////////////////////////////////////////////////////////////////////
    // nsIObserver interface
    // /////////////////////////////////////////////////////////////////////////

    observe: function(subject, topic, data) {
      switch (topic) {
        case "http-on-examine-response" :
          RequestProcessor._examineHttpResponse(subject);
          break;
        case "http-on-modify-request" :
          RequestProcessor._examineHttpRequest(subject);
          break;
        case SUBSCRIPTION_UPDATED_TOPIC:
          Logger.debug(Logger.TYPE_INTERNAL, 'XXX updated: ' + data);
          // TODO: check if the subscription is enabled. The user might have
          // disabled it between the time the update started and when it
          // completed.
          var subInfo = JSON.parse(data);
          var failures = PolicyManager.loadSubscriptionRules(subInfo);
          break;

        case SUBSCRIPTION_ADDED_TOPIC:
          Logger.debug(Logger.TYPE_INTERNAL, 'XXX added: ' + data);
          var subInfo = JSON.parse(data);
          var failures = PolicyManager.loadSubscriptionRules(subInfo);
          var failed = false;
          for (var listName in failures) {
            failed = true;
          }
          if (failed) {
            var serials = {};
            for (var listName in subInfo) {
              if (!serials[listName]) {
                serials[listName] = {};
              }
              for (var subName in subInfo[listName]) {
                serials[listName][subName] = -1;
              }
            }
            let updateCompleted = function(result) {
              Logger.info(Logger.TYPE_INTERNAL,
                  'Subscription update completed: ' + result);
            }
            subscriptions.update(updateCompleted, serials);
          }
          break;

        case SUBSCRIPTION_REMOVED_TOPIC:
          Logger.debug(Logger.TYPE_INTERNAL, 'YYY: ' + data);
          var subInfo = JSON.parse(data);
          var failures = PolicyManager.unloadSubscriptionRules(subInfo);
          break;

        case HTTPS_EVERYWHERE_REWRITE_TOPIC :
          self._handleHttpsEverywhereUriRewrite(subject, data);
          break;
        case "sessionstore-windows-restored":
          showWelcomeWindow();
          break;
        case "private-browsing" :
          if (data == "enter") {
            self._privateBrowsingEnabled = true;
          } else if (data == "exit") {
            self._privateBrowsingEnabled = false;
            PolicyManager.revokeTemporaryRules();
          }
          break;
        default :
          Logger.warning(Logger.TYPE_ERROR, "uknown topic observed: " + topic);
      }
    },
  };

  return self;
}());
