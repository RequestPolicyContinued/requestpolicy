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

const CP_OK = Ci.nsIContentPolicy.ACCEPT;
const CP_NOP = function() {
  return CP_OK;
};
const CP_REJECT = Ci.nsIContentPolicy.REJECT_SERVER;

const EXTENSION_ID = "requestpolicy@requestpolicy.com";

const HTTPS_EVERYWHERE_REWRITE_TOPIC = "https-everywhere-uri-rewrite";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Scope for imported modules.
if (!rp) {
  var rp = {mod : {}};
}

function RequestPolicyService() {
  // If you only need to access your component from Javascript, uncomment the
  // following line: (https://developer.mozilla.org/en-US/docs/wrappedJSObject)
  this.wrappedJSObject = this;
}

RequestPolicyService.prototype = {
  classDescription : "RequestPolicy JavaScript XPCOM Component",
  classID : Components.ID("{14027e96-1afb-4066-8846-e6c89b5faf3b}"),
  contractID : "@requestpolicy.com/requestpolicy-service;1",
  // For info about the change from app-startup to profile-after-change, see:
  // https://developer.mozilla.org/en/XPCOM/XPCOM_changes_in_Gecko_1.9.3
  _xpcom_categories : [
    {category : "app-startup"},
    {category : "profile-after-change"},
    {category : "content-policy"}
  ],
  QueryInterface : XPCOMUtils.generateQI(
      [Ci.nsIRequestPolicy, Ci.nsIObserver, Ci.nsIContentPolicy]),

  /* Factory that creates a singleton instance of the component */
  _xpcom_factory : {
    createInstance : function() {
      if (RequestPolicyService.instance == null) {
        RequestPolicyService.instance = new RequestPolicyService();
      }
      return RequestPolicyService.instance;
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // Internal Data
  // /////////////////////////////////////////////////////////////////////////

  _initialized : false,
  _profileAfterChangeCompleted : false,

  _defaultAllow : true,
  _defaultAllowSameDomain : true,

  _blockingDisabled : false,

  _conflictingExtensions : [],

  _prefService : null,
  _rootPrefs : null,


  _subscriptions : null,
  _policyMgr : null,
  _requestProcessor : null,

  _prefNameToObjectMap : null,

  _compatibilityRules : [],
  _topLevelDocTranslationRules : [],

  _privateBrowsingEnabled : false,
  _uninstall : false,

  // /////////////////////////////////////////////////////////////////////////
  // Utility
  // /////////////////////////////////////////////////////////////////////////

  _init : function() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    try {
      this._loadLibraries();

      try {
        this._initContentPolicy();
        this._register();
        this._initializePrefSystem();
        this._initializePrivateBrowsing();
        // Note that we don't load user preferences at this point because the user
        // preferences may not be ready. If we tried right now, we may get the
        // default preferences.
      } catch (e) {
        rp.mod.Logger.severe(rp.mod.Logger.TYPE_POLICY,
            "exception from _init(): " + e);
      }
    } catch(e) {
      // in case the libraries could not be loaded, the Logger is not available
      dump("[RequestPolicy] [SEVERE] [POLICY] exception from _init(): " + e + "\n");
    }
  },

  _initializeExtensionCompatibility : function() {
    if (this._compatibilityRules.length != 0) {
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

    const rpService = this;
    var callback = function(ext) {
      rpService._initializeExtCompatCallback(ext)
    };
    for (var i = 0; i < idArray.length; i++) {
      rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
          "Extension new-style check: " + idArray[i]);
      AddonManager.getAddonByID(idArray[i], callback);
    }
  },

  _initializeExtCompatCallback : function(ext) {
    if (!ext) {
      return;
    }

    if (ext.isActive == false) {
      rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
          "Extension is not active: " + ext.name);
      return;
    }

    switch (ext.id) {
      case "greasefire@skrul.com" : // Greasefire
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push(
            ["file://", "http://userscripts.org/", ext.name]);
        this._compatibilityRules.push(
            ["file://", "http://static.userscripts.org/", ext.name]);
        break;
      case "{0f9daf7e-2ee2-4fcf-9d4f-d43d93963420}" : // Sage-Too
      case "{899DF1F8-2F43-4394-8315-37F6744E6319}" : // NewsFox
      case "brief@mozdev.org" : // Brief
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Conflicting extension: " + ext.name);
        this._compatibilityRules.push(
            ["resource://brief-content/", null, ext.name]);
        this._conflictingExtensions.push({
          "id" : ext.id,
          "name" : ext.name,
          "version" : ext.version
        });
        break;
      case "foxmarks@kei.com" : // Xmarks Sync
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push([
          "https://login.xmarks.com/",
          "https://static.xmarks.com/",
          ext.name
        ]);
        break;
      case "{203FB6B2-2E1E-4474-863B-4C483ECCE78E}" : // Norton Safe Web Lite
      case "{0C55C096-0F1D-4F28-AAA2-85EF591126E7}" : // Norton NIS Toolbar
      case "{2D3F3651-74B9-4795-BDEC-6DA2F431CB62}" : // Norton Toolbar
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push([null, "symnst:", ext.name]);
        this._compatibilityRules.push([null, "symres:", ext.name]);
        break;
      case "{c45c406e-ab73-11d8-be73-000a95be3b12}" : // Web Developer
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push([
          "about:blank",
          "http://jigsaw.w3.org/css-validator/validator",
          ext.name
        ]);
        this._compatibilityRules.push(
            ["about:blank", "http://validator.w3.org/check", ext.name]);
        break;
      case "{c07d1a49-9894-49ff-a594-38960ede8fb9}" : // Update Scanner
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        var orig = "chrome://updatescan/content/diffPage.xul";
        var translated = "data:text/html";
        this._topLevelDocTranslationRules.push([orig, translated]);
        break;
      case "FirefoxAddon@similarWeb.com" : // SimilarWeb
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push([
          "http://api2.similarsites.com/",
          "http://images2.similargroup.com/",
          ext.name
        ]);
        this._compatibilityRules.push([
          "http://www.similarweb.com/",
          "http://go.similarsites.com/",
          ext.name
        ]);
        break;
      case "{6614d11d-d21d-b211-ae23-815234e1ebb5}" : // Dr. Web Link Checker
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push([null, "http://st.drweb.com/", ext.name]);
        break;
      default :
        rp.mod.Logger.severe(rp.mod.Logger.TYPE_INTERNAL,
            "Unhandled extension (id typo?): " + ext.name);
        break;
    }
  },

  _initializeApplicationCompatibility : function() {
    var appInfo = Cc["@mozilla.org/xre/app-info;1"].
        getService(Ci.nsIXULAppInfo);

    // Mozilla updates (doing this for all applications, not just individual
    // applications from the Mozilla community that I'm aware of).
    // At least the http url is needed for Firefox updates, adding the https
    // one as well to be safe.
    this._compatibilityRules.push(
        ["http://download.mozilla.org/", null, appInfo.vendor]);
    this._compatibilityRules.push(
        ["https://download.mozilla.org/", null, appInfo.vendor]);
    // There are redirects from 'addons' to 'releases' when installing addons
    // from AMO. Adding the origin of 'releases' to be safe in case those
    // start redirecting elsewhere at some point.
    this._compatibilityRules.push(
        ["http://addons.mozilla.org/", null, appInfo.vendor]);
    this._compatibilityRules.push(
        ["https://addons.mozilla.org/", null, appInfo.vendor]);
    this._compatibilityRules.push(
        ["http://releases.mozilla.org/", null, appInfo.vendor]);
    this._compatibilityRules.push(
        ["https://releases.mozilla.org/", null, appInfo.vendor]);
    // Firefox 4 has the about:addons page open an iframe to the mozilla site.
    // That opened page grabs content from other mozilla domains.
    this._compatibilityRules.push([
      "about:addons",
      "https://services.addons.mozilla.org/",
      appInfo.vendor
    ]);
    this._compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://static.addons.mozilla.net/",
      appInfo.vendor
    ]);
    this._compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://addons.mozilla.org/",
      appInfo.vendor]);
    this._compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://www.mozilla.com/",
      appInfo.vendor
    ]);
    this._compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://www.getpersonas.com/",
      appInfo.vendor
    ]);
    this._compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://static-cdn.addons.mozilla.net/",
      appInfo.vendor
    ]);
    this._compatibilityRules.push([
      "https://services.addons.mozilla.org/",
      "https://addons.cdn.mozilla.net/",
      appInfo.vendor
    ]);
    // Firefox 4 uses an about:home page that is locally stored but can be
    // the origin for remote requests. See bug #140 for more info.
    this._compatibilityRules.push(["about:home", null, appInfo.vendor]);
    // Firefox Sync uses a google captcha.
    this._compatibilityRules.push([
      "https://auth.services.mozilla.com/",
      "https://api-secure.recaptcha.net/challenge?",
      appInfo.vendor
    ]);
    this._compatibilityRules.push([
      "https://api-secure.recaptcha.net/challenge?",
      "https://www.google.com/recaptcha/api/challenge?",
      appInfo.vendor
    ]);
    this._compatibilityRules.push([
      "https://auth.services.mozilla.com/",
      "https://www.google.com/recaptcha/api/",
      appInfo.vendor
    ]);
    // Firefox 13 added links from about:newtab
    this._compatibilityRules.push(["about:newtab", null, appInfo.vendor]);

    // Flock
    if (appInfo.ID == "{a463f10c-3994-11da-9945-000d60ca027b}") {
      rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
          "Application detected: " + appInfo.vendor);
      this._compatibilityRules.push(
          ["about:myworld", "http://www.flock.com/", appInfo.vendor]);
      this._compatibilityRules.push(["about:flock", null, appInfo.vendor]);
      this._compatibilityRules.push([
        "http://www.flock.com/rss",
        "http://feeds.feedburner.com/flock",
        appInfo.vendor
      ]);
      this._compatibilityRules.push([
        "http://feeds.feedburner.com/",
        "http://www.flock.com/",
        appInfo.vendor
      ]);
    }

    // Seamonkey
    if (appInfo.ID == "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}") {
      rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
          "Application detected: Seamonkey");
      this._compatibilityRules.push(["mailbox:", null, "Seamonkey"]);
      this._compatibilityRules.push([null, "mailbox:", "Seamonkey"]);
    }
  },

  _syncFromPrefs : function() {
    // Load the logging preferences before the others.
    this._updateLoggingSettings();

    this._defaultAllow = this.prefs.getBoolPref("defaultPolicy.allow");
    this._defaultAllowSameDomain = this.prefs.
        getBoolPref("defaultPolicy.allowSameDomain");
    this._blockingDisabled = this.prefs.getBoolPref("startWithAllowAllEnabled");

    // Disable link prefetch.
    if (this.prefs.getBoolPref("prefetch.link.disableOnStartup")) {
      if (this._rootPrefs.getBoolPref("network.prefetch-next")) {
        this._rootPrefs.setBoolPref("network.prefetch-next", false);
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Disabled link prefetch.");
      }
    }
    // Disable DNS prefetch.
    if (this.prefs.getBoolPref("prefetch.dns.disableOnStartup")) {
      // network.dns.disablePrefetch only exists starting in Firefox 3.1 (and it
      // doesn't have a default value, at least in 3.1b2, but if and when it
      // does have a default it will be false).
      if (!this._rootPrefs.prefHasUserValue("network.dns.disablePrefetch") ||
          !this._rootPrefs.getBoolPref("network.dns.disablePrefetch")) {
        this._rootPrefs.setBoolPref("network.dns.disablePrefetch", true);
        rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            "Disabled DNS prefetch.");
      }
    }

    // Clean up old, unused prefs (removed in 0.2.0).
    deletePrefs = [
      "temporarilyAllowedOrigins",
      "temporarilyAllowedDestinations",
      "temporarilyAllowedOriginsToDestinations"
    ];
    for (var i = 0; i < deletePrefs.length; i++) {
      if (this.prefs.prefHasUserValue(deletePrefs[i])) {
        this.prefs.clearUserPref(deletePrefs[i]);
      }
    }
    this._prefService.savePrefFile(null);
  },

  _loadConfigAndRules : function() {
    this._subscriptions = new rp.mod.UserSubscriptions();
    this._policyMgr = new rp.mod.PolicyManager();
    this._policyMgr.loadUserRules();

    var defaultPolicy = this._defaultAllow ? 'allow' : 'deny';

    var failures = this._policyMgr.loadSubscriptionRules(
          this._subscriptions.getSubscriptionInfo(defaultPolicy));
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
    var loadedSubs = this._policyMgr._subscriptionRulesets;
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
      rp.mod.Logger.info(rp.mod.Logger.TYPE_INTERNAL,
            'Subscription updates completed: ' + result);
    }
    this._subscriptions.update(updateCompleted, serials, defaultPolicy);
  },

  _updateLoggingSettings : function() {
    rp.mod.Logger.enabled = this.prefs.getBoolPref("log");
    rp.mod.Logger.level = this.prefs.getIntPref("log.level");
    rp.mod.Logger.types = this.prefs.getIntPref("log.types");
  },

  _registerAddonListener : function() {
    const rpService = this;
    var addonListener = {
      onDisabling : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        rp.mod.Logger.debug(rp.mod.Logger.TYPE_INTERNAL,
            "Addon set to be disabled.");
        rpService._uninstall = true;
      },
      onUninstalling : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        rp.mod.Logger.debug(rp.mod.Logger.TYPE_INTERNAL,
            "Addon set to be uninstalled.");
        rpService._uninstall = true;
      },
      onOperationCancelled : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        rp.mod.Logger.debug(rp.mod.Logger.TYPE_INTERNAL,
            "Addon operation cancelled.");
        // Just because an operation was cancelled doesn't mean there isn't
        // a pending operation we care about. For example, a user can choose
        // disable and then uninstall, then clicking "undo" once will cancel
        // the uninstall but not the disable.
        var pending = addon.pendingOperations &
            (AddonManager.PENDING_DISABLE | AddonManager.PENDING_UNINSTALL);
        if (!pending) {
          rp.mod.Logger.debug(rp.mod.Logger.TYPE_INTERNAL,
              "No pending uninstall or disable.");
          rpService._uninstall = false;
        }
      }
    };
    AddonManager.addAddonListener(addonListener);
  },

  _register : function() {
    var os = Cc['@mozilla.org/observer-service;1'].
        getService(Ci.nsIObserverService);
    os.addObserver(this, "http-on-examine-response", false);
    os.addObserver(this, "http-on-modify-request", false);
    os.addObserver(this, "xpcom-shutdown", false);
    os.addObserver(this, "profile-after-change", false);
    os.addObserver(this, "sessionstore-windows-restored", false);
    os.addObserver(this, "quit-application", false);
    os.addObserver(this, "private-browsing", false);
    os.addObserver(this, HTTPS_EVERYWHERE_REWRITE_TOPIC, false);
    os.addObserver(this, rp.mod.SUBSCRIPTION_UPDATED_TOPIC, false);
    os.addObserver(this, rp.mod.SUBSCRIPTION_ADDED_TOPIC, false);
    os.addObserver(this, rp.mod.SUBSCRIPTION_REMOVED_TOPIC, false);

    this._registerAddonListener();
  },

  _unregister : function() {
    try {
      var os = Cc['@mozilla.org/observer-service;1'].
          getService(Ci.nsIObserverService);
      os.removeObserver(this, "http-on-examine-response");
      os.removeObserver(this, "http-on-modify-request");
      os.removeObserver(this, "xpcom-shutdown");
      os.removeObserver(this, "profile-after-change");
      os.removeObserver(this, "sessionstore-windows-restored");
      os.removeObserver(this, "quit-application");
      os.removeObserver(this, rp.mod.SUBSCRIPTION_UPDATED_TOPIC);
      os.removeObserver(this, rp.mod.SUBSCRIPTION_ADDED_TOPIC);
      os.removeObserver(this, rp.mod.SUBSCRIPTION_REMOVED_TOPIC);
    } catch (e) {
      rp.mod.Logger.dump(e + " while unregistering.");
    }
  },

  _shutdown : function() {
    this._unregister();
  },

  _initializePrefSystem : function() {
    // Get the preferences branch and setup the preferences observer.
    this._prefService = Cc["@mozilla.org/preferences-service;1"].
        getService(Ci.nsIPrefService);

    this.prefs = this._prefService.getBranch("extensions.requestpolicy.")
        .QueryInterface(Ci.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);

    this._rootPrefs = this._prefService.getBranch("")
        .QueryInterface(Ci.nsIPrefBranch2);
    this._rootPrefs.addObserver("network.prefetch-next", this, false);
    this._rootPrefs.addObserver("network.dns.disablePrefetch", this, false);
  },

  _initVersionInfo : function() {
    try {
      const util = rp.mod.Utils;

      // Set the last version values in the Utils module based on the prefs.
      util.lastVersion = this.prefs.getCharPref("lastVersion");
      util.lastAppVersion = this.prefs.getCharPref("lastAppVersion");

      // Now update the last version prefs and set current version values.
      util.initCurAppVersion();
      this.prefs.setCharPref("lastAppVersion", util.curAppVersion);

      var versionChanged = false;
      const usePrefs = this.prefs;
      const prefService = this._prefService;
      AddonManager.getAddonByID(EXTENSION_ID,
        function(addon) {
          usePrefs.setCharPref("lastVersion", addon.version);
          util.curVersion = addon.version;
          if (util.lastVersion != util.curVersion) {
            prefService.savePrefFile(null);
          }
        });

      if (versionChanged || util.lastAppVersion != util.curAppVersion) {
        this._prefService.savePrefFile(null);
      }
    } catch (e) {
        rp.mod.Logger.error(rp.mod.Logger.TYPE_INTERNAL,
            "_initVersionInfo failed: " + e);
    }
  },

  /**
   * Take necessary actions when preferences are updated.
   *
   * @paramString{} prefName NAme of the preference that was updated.
   */
  _updatePref : function(prefName) {
    switch (prefName) {
      case "log" :
      case "log.level" :
      case "log.types" :
        this._updateLoggingSettings();
        break;
      case "defaultPolicy.allow" :
        this._defaultAllow = this.prefs
              .getBoolPref("defaultPolicy.allow");
        break;
      case "defaultPolicy.allowSameDomain" :
        this._defaultAllowSameDomain = this.prefs
              .getBoolPref("defaultPolicy.allowSameDomain");
        break;
      default :
        break;
    }
    var observerService = Cc['@mozilla.org/observer-service;1'].
        getService(Ci.nsIObserverService);
    observerService.notifyObservers(null, "requestpolicy-prefs-changed", null);
  },

  _loadLibraries : function() {
    var modules = [
      "logger.jsm",
      "domain-util.jsm",
      "ruleset.jsm",
      "policy-manager.jsm",
      "request.jsm",
      "request-processor.jsm",
      "request-util.jsm",
      "subscription.jsm",
      "utils.jsm"
    ];
    for (var i in modules) {
      filename = modules[i];
      try {
        Components.utils.import("chrome://requestpolicy/content/lib/" + filename,
            rp.mod);
      } catch(e) {
        // Indicate the filename because the exception doesn't have that
        // in the string.
        var msg = "Failed to load module " + filename + ": " + e;
        dump(msg);
        // TODO: catch errors from here and _init and, if detected, set a
        // flag that RP's broken and indicate that to the user.
        throw msg;
      }
    }
    Components.utils.import("resource://gre/modules/AddonManager.jsm");

    // Give the RequestUtil singleton a reference to us.
    rp.mod.RequestUtil.setRPService(this);
  },

  _initializePrivateBrowsing : function() {
    try {
      var pbs = Cc["@mozilla.org/privatebrowsing;1"].
          getService(Ci.nsIPrivateBrowsingService);
      this._privateBrowsingEnabled = pbs.privateBrowsingEnabled;
    } catch (e) {
      // Ignore exceptions from browsers that do not support private browsing.
    }
  },

  _showWelcomeWindow : function() {
    if (!this.prefs.getBoolPref("welcomeWindowShown")) {
      var url = "chrome://requestpolicy/content/settings/setup.html";

      var wm = Cc['@mozilla.org/appshell/window-mediator;1'].
          getService(Ci.nsIWindowMediator);
      var windowtype = 'navigator:browser';
      var mostRecentWindow  = wm.getMostRecentWindow(windowtype);

      // the gBrowser object of the firefox window
      var _gBrowser = mostRecentWindow.getBrowser();

      if (typeof(_gBrowser.addTab) != "function") return;

      _gBrowser.selectedTab = _gBrowser.addTab(url);

      this.prefs.setBoolPref("welcomeWindowShown", true);
      this._prefService.savePrefFile(null);
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIRequestPolicy interface
  // /////////////////////////////////////////////////////////////////////////

  prefs : null,

  getUriIdentifier : function(uri) {
    return rp.mod.DomainUtil.getIdentifier(uri,
    //    this._uriIdentificationLevel);
        null);
  },

  registerHistoryRequest : function(destinationUrl) {
    this._requestProcessor.registerHistoryRequest(destinationUrl);
  },

  registerFormSubmitted : function(originUrl, destinationUrl) {
    this._requestProcessor.registerFormSubmitted(originUrl, destinationUrl);
  },

  registerLinkClicked : function(originUrl, destinationUrl) {
    this._requestProcessor.registerLinkClicked(originUrl, destinationUrl);
  },

  registerAllowedRedirect : function(originUrl, destinationUrl) {
    this._requestProcessor.registerAllowedRedirect(originUrl, destinationUrl);
  },

  setBlockingDisabled : function(disabled) {
    this._blockingDisabled = disabled;
    this.prefs.setBoolPref('startWithAllowAllEnabled', disabled);
    this._prefService.savePrefFile(null);
  },

  storeRules : function() {
    this._policyMgr.storeRules();
  },

  addAllowRule : function(rawRule, noStore) {
    this._policyMgr.addRule(rp.mod.RULE_ACTION_ALLOW, rawRule,
        noStore);
  },

  addTemporaryAllowRule : function(rawRule) {
    this._policyMgr.addTemporaryRule(rp.mod.RULE_ACTION_ALLOW,
        rawRule);
  },

  removeAllowRule : function(rawRule) {
    this._policyMgr.removeRule(rp.mod.RULE_ACTION_ALLOW, rawRule);
  },

  addDenyRule : function(rawRule) {
    this._policyMgr.addRule(rp.mod.RULE_ACTION_DENY, rawRule);
  },

  addTemporaryDenyRule : function(rawRule) {
    this._policyMgr.addTemporaryRule(rp.mod.RULE_ACTION_DENY, rawRule);
  },

  removeDenyRule : function(rawRule) {
    this._policyMgr.removeRule(rp.mod.RULE_ACTION_DENY, rawRule);
  },

  _allowOrigin : function(host, noStore) {
    var ruleData = {"o":{"h":host}};
    this._policyMgr.addRule(rp.mod.RULE_ACTION_ALLOW, ruleData,
          noStore);
  },

  allowOrigin : function(host) {
    this._allowOrigin(host, false);
  },

  allowOriginDelayStore : function(host) {
    this._allowOrigin(host, true);
  },

  temporarilyAllowOrigin : function(host) {
    var ruleData = {"o": {"h" : host}};
    this._policyMgr.addTemporaryRule(rp.mod.RULE_ACTION_ALLOW,
          ruleData);
  },

  _allowDestination : function(host, noStore) {
    var ruleData = {"d": {"h" : host}};
    this._policyMgr.addRule(rp.mod.RULE_ACTION_ALLOW, ruleData,
          noStore);
  },

  allowDestination : function(host) {
    this._allowDestination(host, false);
  },

  allowDestinationDelayStore : function(host) {
    this._allowDestination(host, true);
  },

  temporarilyAllowDestination : function(host) {
    var ruleData = {"d": {"h" : host}};
    this._policyMgr.addTemporaryRule(rp.mod.RULE_ACTION_ALLOW,
        ruleData);
  },

  _allowOriginToDestination : function(originIdentifier, destIdentifier,
      noStore) {
    var ruleData = {
      "o": {"h" : originIdentifier},
      "d": {"h" : destIdentifier}
    };
    this._policyMgr.addRule(rp.mod.RULE_ACTION_ALLOW, ruleData,
          noStore);
  },

  allowOriginToDestination : function(originIdentifier, destIdentifier) {
    this._allowOriginToDestination(originIdentifier, destIdentifier, false);
  },

  allowOriginToDestinationDelayStore : function(originIdentifier,
                                                destIdentifier) {
    this._allowOriginToDestination(originIdentifier, destIdentifier, true);
  },

  temporarilyAllowOriginToDestination : function(originIdentifier,
                                                 destIdentifier) {
    var ruleData = {
      "o": {"h" : originIdentifier},
      "d": {"h" : destIdentifier}
    };
    this._policyMgr.addTemporaryRule(rp.mod.RULE_ACTION_ALLOW,
        ruleData);
  },

  temporaryRulesExist : function() {
    return this._policyMgr.temporaryRulesExist();
  },

  revokeTemporaryPermissions : function() {
    this._policyMgr.revokeTemporaryRules();
  },

  isAllowedRedirect : function(originUri, destinationUri) {
    return this._requestProcessor.isAllowedRedirect(originUri, destinationUri);
  },

  /**
   * Determines whether the user has granted any temporary permissions. This
   * does not include temporarily disabling all blocking.
   *
   * @return {Boolean} true if any temporary permissions have been granted,
   *         false otherwise.
   */
  areTemporaryPermissionsGranted : function() {
    return this._policyMgr.temporaryRulesExist();
  },

  getConflictingExtensions : function() {
    return this._conflictingExtensions;
  },

  getTopLevelDocTranslations : function() {
    return this._topLevelDocTranslationRules;
  },

  isPrefetchEnabled : function() {
    // network.dns.disablePrefetch only exists starting in Firefox 3.1
    try {
      return this._rootPrefs.getBoolPref("network.prefetch-next")
          || !this._rootPrefs.getBoolPref("network.dns.disablePrefetch");
    } catch (e) {
      return this._rootPrefs.getBoolPref("network.prefetch-next");
    }
  },

  isDefaultAllow : function() {
    return this._defaultAllow;
  },

  isDefaultAllowSameDomain : function() {
    return this._defaultAllowSameDomain;
  },

  isBlockingDisabled : function() {
    return this._blockingDisabled;
  },

  isPrivateBrowsingEnabled : function() {
    return this._privateBrowsingEnabled;
  },

  oldRulesExist : function() {
    var prefs = this.prefs;
    function prefEmpty(pref) {
      try {
        var value = prefs.getComplexValue(pref, Ci.nsISupportsString).data;
        return value == '';
      } catch (e) {
        return true;
      }
    }
    return !(prefEmpty('allowedOrigins') &&
             prefEmpty('allowedDestinations') &&
             prefEmpty('allowedOriginsToDestinations'));
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
    this._requestProcessor.mapDestinations(oldURI.spec, newSpec);
  },

  _handleUninstallOrDisable : function() {
    rp.mod.Logger.debug(rp.mod.Logger.TYPE_INTERNAL,
        "Performing 'disable' operations.");
    var resetLinkPrefetch = this.prefs.getBoolPref(
        "prefetch.link.restoreDefaultOnUninstall");
    var resetDNSPrefetch = this.prefs.getBoolPref(
        "prefetch.dns.restoreDefaultOnUninstall");

    if (resetLinkPrefetch) {
      if (this._rootPrefs.prefHasUserValue("network.prefetch-next")) {
        this._rootPrefs.clearUserPref("network.prefetch-next");
      }
    }
    if (resetDNSPrefetch) {
      if (this._rootPrefs.prefHasUserValue("network.dns.disablePrefetch")) {
        this._rootPrefs.clearUserPref("network.dns.disablePrefetch");
      }
    }
    this._prefService.savePrefFile(null);
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIObserver interface
  // /////////////////////////////////////////////////////////////////////////

  observe : function(subject, topic, data) {
    switch (topic) {
      case "http-on-examine-response" :
        this._requestProcessor._examineHttpResponse(subject);
        break;
      case "http-on-modify-request" :
        this._requestProcessor._examineHttpRequest(subject);
        break;
      case rp.mod.SUBSCRIPTION_UPDATED_TOPIC:
        rp.mod.Logger.debug(
          rp.mod.Logger.TYPE_INTERNAL, 'XXX updated: ' + data);
        // TODO: check if the subscription is enabled. The user might have
        // disabled it between the time the update started and when it
        // completed.
        var subInfo = JSON.parse(data);
        var failures = this._policyMgr.loadSubscriptionRules(subInfo);
        break;

      case rp.mod.SUBSCRIPTION_ADDED_TOPIC:
        rp.mod.Logger.debug(
          rp.mod.Logger.TYPE_INTERNAL, 'XXX added: ' + data);
        var subInfo = JSON.parse(data);
        var failures = this._policyMgr.loadSubscriptionRules(subInfo);
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
          function updateCompleted(result) {
            rp.mod.Logger.info(
                rp.mod.Logger.TYPE_INTERNAL,
                'Subscription update completed: ' + result);
          }
          this._subscriptions.update(updateCompleted, serials);
        }
        break;

      case rp.mod.SUBSCRIPTION_REMOVED_TOPIC:
        rp.mod.Logger.debug(
          rp.mod.Logger.TYPE_INTERNAL, 'YYY: ' + data);
        var subInfo = JSON.parse(data);
        var failures = this._policyMgr.unloadSubscriptionRules(subInfo);
        break;

      case HTTPS_EVERYWHERE_REWRITE_TOPIC :
        this._handleHttpsEverywhereUriRewrite(subject, data);
        break;
      case "nsPref:changed" :
        this._updatePref(data);
        break;
      case "profile-after-change" :
        // Firefox 3.6 ends up here twice with how we have things set up.
        if (this._profileAfterChangeCompleted) {
          break;
        }
        this._profileAfterChangeCompleted = true;

        // We call _init() here because gecko 1.9.3 states that extensions will
        // no longer be able to receive app-startup.
        this._init(); // app-startup still exists (Sept 2013)
        // "profile-after-change" means that user preferences are now
        // accessible. If we tried to load preferences before this, we would get
        // default preferences rather than user preferences.
        this._syncFromPrefs();
        this._loadConfigAndRules();
        this._initVersionInfo();
        // Detect other installed extensions and the current application and do
        // what is needed to allow their requests.
        this._initializeExtensionCompatibility();
        this._initializeApplicationCompatibility();
        break;
      case "sessionstore-windows-restored":
        this._showWelcomeWindow();
        break;
      case "private-browsing" :
        if (data == "enter") {
          this._privateBrowsingEnabled = true;
        } else if (data == "exit") {
          this._privateBrowsingEnabled = false;
          this.revokeTemporaryPermissions();
        }
        break;
      case "app-startup" :
        this._init();
        break;
      case "xpcom-shutdown" :
        this._shutdown();
        break;
      case "quit-application" :
        if (this._uninstall) {
          this._handleUninstallOrDisable();
        }
        break;
      default :
        rp.mod.Logger.warning(rp.mod.Logger.TYPE_ERROR,
            "uknown topic observed: " + topic);
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIContentPolicy interface
  // /////////////////////////////////////////////////////////////////////////

  // before initializing content policy, allow all requests through
  shouldLoad : CP_NOP,
  shouldProcess : CP_NOP,

  // enable our actual shouldLoad function
  _initContentPolicy : function() {
    this._requestProcessor = new rp.mod.RequestProcessor(this);
    this.shouldLoad = this.mainContentPolicy.shouldLoad;
    if (!this.mimeService) {
      // this.rejectCode = typeof(/ /) == "object" ? -4 : -3;
      this.rejectCode = Ci.nsIContentPolicy.REJECT_SERVER;
      this.mimeService =
          Cc['@mozilla.org/uriloader/external-helper-app-service;1']
          .getService(Ci.nsIMIMEService);
    }
  },

  mainContentPolicy : {
    // https://developer.mozilla.org/en/nsIContentPolicy
    shouldLoad : function(aContentType, aContentLocation, aRequestOrigin,
        aContext, aMimeTypeGuess, aExtra, aRequestPrincipal) {
      var request = new rp.mod.NormalRequest(
          aContentType, aContentLocation, aRequestOrigin, aContext,
          aMimeTypeGuess, aExtra, aRequestPrincipal);
      return this._requestProcessor.process(request);
      // TODO: implement the following
//       this._requestProcessor.process(request);
//       return request.getShouldLoadResult();
    }

  }

  // /////////////////////////////////////////////////////////////////////////
  // end nsIContentPolicy interface
  // /////////////////////////////////////////////////////////////////////////
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([RequestPolicyService]);
