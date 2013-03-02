/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
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

const CI = Components.interfaces;
const CC = Components.classes;

const CP_OK = CI.nsIContentPolicy.ACCEPT;
const CP_NOP = function() {
  return CP_OK;
};
const CP_REJECT = CI.nsIContentPolicy.REJECT_SERVER;

const EXTENSION_ID = "requestpolicy@requestpolicy.com";

// A value intended to not conflict with aExtra passed to shouldLoad() by any
// other callers. Was chosen randomly.
const CP_MAPPEDDESTINATION = 0x178c40bf;

const HTTPS_EVERYWHERE_REWRITE_TOPIC = "https-everywhere-uri-rewrite";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Scope for imported modules.
if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

function RequestPolicyService() {
  this.wrappedJSObject = this;
}

RequestPolicyService.prototype = {
  classDescription : "RequestPolicy JavaScript XPCOM Component",
  classID : Components.ID("{14027e96-1afb-4066-8846-e6c89b5faf3b}"),
  contractID : "@requestpolicy.com/requestpolicy-service;1",
  // For info about the change from app-startup to profile-after-change, see:
  // https://developer.mozilla.org/en/XPCOM/XPCOM_changes_in_Gecko_1.9.3
  _xpcom_categories : [{
        category : "app-startup"
      }, {
        category : "profile-after-change"
      }, {
        category : "content-policy"
      }],
  QueryInterface : XPCOMUtils.generateQI([CI.nsIRequestPolicy, CI.nsIObserver,
      CI.nsIContentPolicy]),

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

  _blockingDisabled : false,

  _conflictingExtensions : [],

  _rejectedRequests : {},
  _allowedRequests : {},

  /**
   * These are redirects that the user allowed when presented with a redirect
   * notification.
   */
  _userAllowedRedirects : {},

  _blockedRedirects : {},
  _allowedRedirectsReverse : {},

  _prefService : null,
  _rootPrefs : null,

  _historyRequests : {},

  _submittedForms : {},
  _submittedFormsReverse : {},

  _clickedLinks : {},
  _clickedLinksReverse : {},

  _faviconRequests : {},

  _mappedDestinations : {},

  _requestObservers : [],

  _uriIdentificationLevel : 0,

  /**
   * Number of elapsed milliseconds from the time of the last shouldLoad() call
   * at which the cached results of the last shouldLoad() call are discarded.
   * 
   * @type Number
   */
  _lastShouldLoadCheckTimeout : 200,

  // Calls to shouldLoad appear to be repeated, so successive repeated calls and
  // their result (accept or reject) are tracked to avoid duplicate processing
  // and duplicate logging.
  /**
   * Object that caches the last shouldLoad
   */
  _lastShouldLoadCheck : {
    "origin" : null,
    "destination" : null,
    "time" : 0,
    "result" : null
  },

  _temporarilyAllowedOriginsCount : 0,
  _temporarilyAllowedDestinationsCount : 0,
  _temporarilyAllowedOriginsToDestinationsCount : 0,

  _temporarilyAllowedOrigins : {},
  _temporarilyAllowedDestinations : {},
  _temporarilyAllowedOriginsToDestinations : {},

  _allowedOrigins : {},
  _allowedDestinations : {},
  _allowedOriginsToDestinations : {},

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

    this._loadLibraries();
    this._initContentPolicy();
    this._register();
    this._initializePrefSystem();
    this._initializePrivateBrowsing();
    // Note that we don't load user preferences at this point because the user
    // preferences may not be ready. If we tried right now, we may get the
    // default preferences.
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

    try {
      // For Firefox <= 3.6.
      var em = Components.classes["@mozilla.org/extensions/manager;1"]
          .getService(Components.interfaces.nsIExtensionManager);
      var ext;
      for (var i = 0; i < idArray.length; i++) {
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Extension old-style check: " + idArray[i]);
        this._initializeExtCompatCallback(em.getItemForID(idArray[i]));
      }
    } catch (e) {
      // As of Firefox 3.7, the extension manager has been replaced.
      const rpService = this;
      var callback = function(ext) {
        rpService._initializeExtCompatCallback(ext)
      };
      for (var i = 0; i < idArray.length; i++) {
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Extension new-style check: " + idArray[i]);
        AddonManager.getAddonByID(idArray[i], callback);
      }
    }
  },

  _initializeExtCompatCallback : function(ext) {
    if (!ext) {
      return;
    }

    // As of Firefox 3.7, we can easily whether addons are disabled.
    // The isActive property won't exist before 3.7, so it will be null.
    if (ext.isActive == false) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Extension is not active: " + ext.name);
      return;
    }

    switch (ext.id) {
      case "greasefire@skrul.com" : // Greasefire
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push(["file://", "http://userscripts.org/",
            ext.name]);
        this._compatibilityRules.push(["file://",
            "http://static.userscripts.org/", ext.name]);
        break;
      case "{0f9daf7e-2ee2-4fcf-9d4f-d43d93963420}" : // Sage-Too
      case "{899DF1F8-2F43-4394-8315-37F6744E6319}" : // NewsFox
      case "brief@mozdev.org" : // Brief
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Conflicting extension: " + ext.name);
        this._compatibilityRules.push(["resource://brief-content/", null,
            ext.name]);
        this._conflictingExtensions.push({
              "id" : ext.id,
              "name" : ext.name,
              "version" : ext.version
            });
        break;
      case "foxmarks@kei.com" : // Xmarks Sync
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push(["https://login.xmarks.com/",
            "https://static.xmarks.com/", ext.name]);
        break;
      case "{203FB6B2-2E1E-4474-863B-4C483ECCE78E}" : // Norton Safe Web Lite
      case "{0C55C096-0F1D-4F28-AAA2-85EF591126E7}" : // Norton NIS Toolbar
      case "{2D3F3651-74B9-4795-BDEC-6DA2F431CB62}" : // Norton Toolbar
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push([null, "symnst:", ext.name]);
        this._compatibilityRules.push([null, "symres:", ext.name]);
        break;
      case "{c45c406e-ab73-11d8-be73-000a95be3b12}" : // Web Developer
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push(["about:blank",
            "http://jigsaw.w3.org/css-validator/validator", ext.name]);
        this._compatibilityRules.push(["about:blank",
            "http://validator.w3.org/check", ext.name]);
        break;
      case "{c07d1a49-9894-49ff-a594-38960ede8fb9}" : // Update Scanner
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        var orig = "chrome://updatescan/content/diffPage.xul";
        var translated = "data:text/html";
        this._topLevelDocTranslationRules.push([orig, translated]);
        break;
      case "FirefoxAddon@similarWeb.com" : // SimilarWeb
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push(["http://api2.similarsites.com/",
            "http://images2.similargroup.com/", ext.name]);
        this._compatibilityRules.push(["http://www.similarweb.com/",
            "http://go.similarsites.com/", ext.name]);
        break;
      case "{6614d11d-d21d-b211-ae23-815234e1ebb5}" : // Dr. Web Link Checker
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Using extension compatibility rules for: " + ext.name);
        this._compatibilityRules.push([null, "http://st.drweb.com/", ext.name]);
        break;
      default :
        requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Unhandled extension (id typo?): " + ext.name);
        break;
    }
  },

  _initializeApplicationCompatibility : function() {
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
        .getService(Components.interfaces.nsIXULAppInfo);

    // Mozilla updates (doing this for all applications, not just individual
    // applications from the Mozilla community that I'm aware of).
    // At least the http url is needed for Firefox updates, adding the https
    // one as well to be safe.
    this._compatibilityRules.push(["http://download.mozilla.org/", null,
        appInfo.vendor]);
    this._compatibilityRules.push(["https://download.mozilla.org/", null,
        appInfo.vendor]);
    // There are redirects from 'addons' to 'releases' when installing addons
    // from AMO. Adding the origin of 'releases' to be safe in case those
    // start redirecting elsewhere at some point.
    this._compatibilityRules.push(["http://addons.mozilla.org/", null,
        appInfo.vendor]);
    this._compatibilityRules.push(["https://addons.mozilla.org/", null,
        appInfo.vendor]);
    this._compatibilityRules.push(["http://releases.mozilla.org/", null,
        appInfo.vendor]);
    this._compatibilityRules.push(["https://releases.mozilla.org/", null,
        appInfo.vendor]);
    // Firefox 4 has the about:addons page open an iframe to the mozilla site.
    // That opened page grabs content from other mozilla domains.
    this._compatibilityRules.push(["about:addons",
        "https://services.addons.mozilla.org/", appInfo.vendor]);
    this._compatibilityRules.push(["https://services.addons.mozilla.org/",
        "https://static.addons.mozilla.net/", appInfo.vendor]);
    this._compatibilityRules.push(["https://services.addons.mozilla.org/",
        "https://addons.mozilla.org/", appInfo.vendor]);
    this._compatibilityRules.push(["https://services.addons.mozilla.org/",
        "https://www.mozilla.com/", appInfo.vendor]);
    this._compatibilityRules.push(["https://services.addons.mozilla.org/",
        "https://www.getpersonas.com/", appInfo.vendor]);
    this._compatibilityRules.push(["https://services.addons.mozilla.org/",
        "https://static-cdn.addons.mozilla.net/", appInfo.vendor]);
    // Firefox 4 uses an about:home page that is locally stored but can be
    // the origin for remote requests. See bug #140 for more info.
    this._compatibilityRules.push(["about:home", null, appInfo.vendor]);
    // Firefox Sync uses a google captcha.
    this._compatibilityRules.push(["https://auth.services.mozilla.com/",
        "https://api-secure.recaptcha.net/challenge?", appInfo.vendor]);
    this._compatibilityRules.push([
        "https://api-secure.recaptcha.net/challenge?",
        "https://www.google.com/recaptcha/api/challenge?", appInfo.vendor]);
    this._compatibilityRules.push(["https://auth.services.mozilla.com/",
        "https://www.google.com/recaptcha/api/", appInfo.vendor]);
    // Firefox 13 added links from about:newtab
    this._compatibilityRules.push(["about:newtab", null, appInfo.vendor]);

    // Flock
    if (appInfo.ID == "{a463f10c-3994-11da-9945-000d60ca027b}") {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Application detected: " + appInfo.vendor);
      this._compatibilityRules.push(["about:myworld", "http://www.flock.com/",
          appInfo.vendor]);
      this._compatibilityRules.push(["about:flock", null, appInfo.vendor]);
      this._compatibilityRules.push(["http://www.flock.com/rss",
          "http://feeds.feedburner.com/flock", appInfo.vendor]);
      this._compatibilityRules.push(["http://feeds.feedburner.com/",
          "http://www.flock.com/", appInfo.vendor]);
    }

    // Seamonkey
    if (appInfo.ID == "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}") {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Application detected: Seamonkey");
      this._compatibilityRules.push(["mailbox:", null, "Seamonkey"]);
      this._compatibilityRules.push([null, "mailbox:", "Seamonkey"]);
    }
  },

  _clearPref: function(name) {
    if (this.prefs.prefHasUserValue(name)) {
      this.prefs.clearUserPref(name);
    }
  },

  _syncFromPrefs : function() {
    // Load the logging preferences before the others.
    this._updateLoggingSettings();
    this._uriIdentificationLevel = this.prefs
        .getIntPref("uriIdentificationLevel");
    // origins
    this._allowedOrigins = this._getPreferenceObj("allowedOrigins");
    requestpolicy.mod.Logger.vardump(this._allowedOrigins,
        "this._allowedOrigins");
    // destinations
    this._allowedDestinations = this._getPreferenceObj("allowedDestinations");
    requestpolicy.mod.Logger.vardump(this._allowedDestinations,
        "this._allowedDestinations");
    // origins to destinations
    this._allowedOriginsToDestinations = this
        ._getPreferenceObj("allowedOriginsToDestinations");
    requestpolicy.mod.Logger.vardump(this._allowedOriginsToDestinations,
        "this._allowedOriginsToDestinations");

    this._prefNameToObjectMap = {
      "allowedOrigins" : this._allowedOrigins,
      "allowedDestinations" : this._allowedDestinations,
      "allowedOriginsToDestinations" : this._allowedOriginsToDestinations
    };

    this._blockingDisabled = this.prefs.getBoolPref("startWithAllowAllEnabled");

    // Disable link prefetch.
    if (this.prefs.getBoolPref("prefetch.link.disableOnStartup")) {
      if (this._rootPrefs.getBoolPref("network.prefetch-next")) {
        this._rootPrefs.setBoolPref("network.prefetch-next", false);
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
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
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Disabled DNS prefetch.");
      }
    }

    // Study is over.
    if (this.prefs.getBoolPref('study.participate')) {
      this.endParticipationInStudy();
    }
    this._clearPref('study.participate');
    this._clearPref('study.profileID');
    this._clearPref('study.consentID');
    this._clearPref('study.consentVersion');
    this._clearPref('study.sessionID');
    this._clearPref('study.globalEventID');
    this._prefService.savePrefFile(null);

    // Clean up old, unused prefs (removed in 0.2.0).
    this._clearPref("temporarilyAllowedOrigins");
    this._clearPref("temporarilyAllowedDestinations");
    this._clearPref("temporarilyAllowedOriginsToDestinations");
    this._prefService.savePrefFile(null);
  },

  endParticipationInStudy : function() {
    this.prefs.setBoolPref('study.participate', false);
    this._clearPref('study.consentVersion');
    this._prefService.savePrefFile(null);
    requestpolicy.mod.Stats.deleteFile();
  },

  _updateLoggingSettings : function() {
    requestpolicy.mod.Logger.enabled = this.prefs.getBoolPref("log");
    requestpolicy.mod.Logger.level = this.prefs.getIntPref("log.level");
    requestpolicy.mod.Logger.types = this.prefs.getIntPref("log.types");
  },

  _registerAddonListener : function() {
    const rpService = this;
    var addonListener = {
      onDisabling : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Addon set to be disabled.");
        rpService._uninstall = true;
      },
      onUninstalling : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Addon set to be uninstalled.");
        rpService._uninstall = true;
      },
      onOperationCancelled : function(addon, needsRestart) {
        if (addon.id != EXTENSION_ID) {
          return;
        }
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Addon operation cancelled.");
        // Just because an operation was cancelled doesn't mean there isn't
        // a pending operation we care about. For example, a user can choose
        // disable and then uninstall, then clicking "undo" once will cancel
        // the uninstall but not the disable.
        var pending = addon.pendingOperations &
            (AddonManager.PENDING_DISABLE | AddonManager.PENDING_UNINSTALL);
        if (!pending) {
          requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
              "No pending uninstall or disable.");
          rpService._uninstall = false;
        }
      }
    };
    AddonManager.addAddonListener(addonListener);
  },

  _register : function() {
    var os = CC['@mozilla.org/observer-service;1']
        .getService(CI.nsIObserverService);
    os.addObserver(this, "http-on-examine-response", false);
    os.addObserver(this, "http-on-modify-request", false);
    os.addObserver(this, "xpcom-shutdown", false);
    os.addObserver(this, "profile-after-change", false);
    os.addObserver(this, "quit-application", false);
    os.addObserver(this, "private-browsing", false);
    os.addObserver(this, HTTPS_EVERYWHERE_REWRITE_TOPIC, false);

    // Listening for uninstall/disable events is done with the AddonManager
    // since Firefox 4.
    if (AddonManager) {
      this._registerAddonListener();
    } else {
      os.addObserver(this, "em-action-requested", false);
    }
  },

  _unregister : function() {
    try {
      var os = CC['@mozilla.org/observer-service;1']
          .getService(CI.nsIObserverService);
      os.removeObserver(this, "http-on-examine-response");
      os.removeObserver(this, "http-on-modify-request");
      os.removeObserver(this, "xpcom-shutdown");
      os.removeObserver(this, "profile-after-change");
      os.removeObserver(this, "quit-application");
      if (!AddonManager) {
        os.removeObserver(this, "em-action-requested");
      }
    } catch (e) {
      requestpolicy.mod.Logger.dump(e + " while unregistering.");
    }
  },

  _shutdown : function() {
    this._unregister();
  },

  _initializePrefSystem : function() {
    // Get the preferences branch and setup the preferences observer.
    this._prefService = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService);

    this.prefs = this._prefService.getBranch("extensions.requestpolicy.")
        .QueryInterface(CI.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);

    this._rootPrefs = this._prefService.getBranch("")
        .QueryInterface(CI.nsIPrefBranch2);
  },

  _initVersionInfo : function() {
    try {
      const util = requestpolicy.mod.Util;

      // Set the last version values in the Util module based on the prefs.
      util.lastVersion = this.prefs.getCharPref("lastVersion");
      util.lastAppVersion = this.prefs.getCharPref("lastAppVersion");

      // Now update the last version prefs and set current version values.
      util.initCurAppVersion();
      this.prefs.setCharPref("lastAppVersion", util.curAppVersion);

      var versionChanged = false;
      if (AddonManager) {
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
      } else {
        var em = Components.classes["@mozilla.org/extensions/manager;1"]
                 .getService(Components.interfaces.nsIExtensionManager);
        var addon = em.getItemForID(EXTENSION_ID);
        this.prefs.setCharPref("lastVersion", addon.version);
        util.curVersion = addon.version;
        if (util.lastVersion != util.curVersion) {
          versionChanged = true;
        }
      }

      if (versionChanged || util.lastAppVersion != util.curAppVersion) {
        this._prefService.savePrefFile(null);
      }
    } catch (e) {
        requestpolicy.mod.Logger.error(requestpolicy.mod.Logger.TYPE_INTERNAL,
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
      case "uriIdentificationLevel" :
        this._uriIdentificationLevel = this.prefs
            .getIntPref("uriIdentificationLevel");
        break;
      default :
        break;
    }
  },

  _loadLibraries : function() {
    Components.utils.import("resource://requestpolicy/Logger.jsm",
        requestpolicy.mod);
    Components.utils.import("resource://requestpolicy/DomainUtil.jsm",
        requestpolicy.mod);
    Components.utils.import("resource://requestpolicy/Util.jsm",
        requestpolicy.mod);
    Components.utils.import("resource://requestpolicy/Stats.jsm",
        requestpolicy.mod);
    try {
      Components.utils.import("resource://gre/modules/AddonManager.jsm");
    } catch (e) {
      // We'll be using the old (pre-Firefox 4) addon manager.
      AddonManager = null;
    }
  },

  _initializePrivateBrowsing : function() {
    try {
      var pbs = Components.classes["@mozilla.org/privatebrowsing;1"]
          .getService(Components.interfaces.nsIPrivateBrowsingService);
      this._privateBrowsingEnabled = pbs.privateBrowsingEnabled;
    } catch (e) {
      // Ignore exceptions from browsers that do not support private browsing.
    }
  },

  /**
   * Checks whether a request is initiated by a content window. If it's from a
   * content window, then it's from unprivileged code.
   */
  _isContentRequest : function(channel) {
    var callbacks = [];
    if (channel.notificationCallbacks) {
      callbacks.push(channel.notificationCallbacks);
    }
    if (channel.loadGroup && channel.loadGroup.notificationCallbacks) {
      callbacks.push(channel.loadGroup.notificationCallbacks);
    }

    for (var i = 0; i < callbacks.length; i++) {
      var callback = callbacks[i];
      try {
        // For Gecko 1.9.1
        return callback.getInterface(CI.nsILoadContext).isContent;
      } catch (e) {
      }
      try {
        // For Gecko 1.9.0
        var itemType = callback.getInterface(CI.nsIWebNavigation)
            .QueryInterface(CI.nsIDocShellTreeItem).itemType;
        return itemType == CI.nsIDocShellTreeItem.typeContent;
      } catch (e) {
      }
    }

    return false;
  },

  _examineHttpResponse : function(observedSubject) {
    // Currently, if a user clicks a link to download a file and that link
    // redirects and is subsequently blocked, the user will see the blocked
    // destination in the menu. However, after they have allowed it from
    // the menu and attempted the download again, they won't see the allowed
    // request in the menu. Fixing that might be a pain and also runs the
    // risk of making the menu cluttered and confusing with destinations of
    // followed links from the current page.

    // TODO: Make user aware of blocked headers so they can allow them if
    // desired.

    var httpChannel = observedSubject
        .QueryInterface(Components.interfaces.nsIHttpChannel);

    var headerType;
    var dest;
    try {
      // If there is no such header, getResponseHeader() will throw
      // NS_ERROR_NOT_AVAILABLE. If there is more than header, the last one is
      // the one that will be used.
      headerType = "Location";
      dest = httpChannel.getResponseHeader(headerType);
    } catch (e) {
      // No location header. Look for a Refresh header.
      try {
        headerType = "Refresh";
        var refreshString = httpChannel.getResponseHeader(headerType);
      } catch (e) {
        // No Location header or Refresh header.
        return;
      }
      try {
        var parts = requestpolicy.mod.DomainUtil.parseRefresh(refreshString);
      } catch (e) {
        requestpolicy.mod.Logger.warning(
            requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
            "Invalid refresh header: <" + refreshString + ">");
        if (!this._blockingDisabled) {
          httpChannel.setResponseHeader(headerType, "", false);
        }
        return;
      }
      // We can ignore the delay (parts[0]) because we aren't manually doing
      // the refreshes. Allowed refreshes we still leave to the browser.
      // The dest may be empty if the origin is what should be refreshed. This
      // will be handled by DomainUtil.determineRedirectUri().
      dest = parts[1];
    }

    // For origins that are IDNs, this will always be in ACE format. We want
    // it in UTF8 format if it's a TLD that Mozilla allows to be in UTF8.
    var origin = requestpolicy.mod.DomainUtil.formatIDNUri(httpChannel.name);

    // Allow redirects of requests from privileged code.
    if (!this._isContentRequest(httpChannel)) {
      // However, favicon requests that are redirected appear as non-content
      // requests. So, check if the original request was for a favicon.
      var originPath = requestpolicy.mod.DomainUtil.getPath(httpChannel.name);
      // We always have to check "/favicon.ico" because Firefox will use this
      // as a default path and that request won't pass through shouldLoad().
      if (originPath == "/favicon.ico" || this._faviconRequests[origin]) {
        // If the redirected request is allowed, we need to know that was a
        // favicon request in case it is further redirected.
        this._faviconRequests[dest] = true;
        requestpolicy.mod.Logger.info(
            requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT, "'" + headerType
                + "' header to <" + dest + "> " + "from <" + origin
                + "> appears to be a redirected favicon request. "
                + "This will be treated as a content request.");
      } else {
        requestpolicy.mod.Logger.warning(
            requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT, "** ALLOWED ** '"
                + headerType + "' header to <" + dest + "> " + "from <"
                + origin + ">. Original request is from privileged code.");
        return;
      }
    }

    // If it's not a valid uri, the redirect is relative to the origin host.
    // The way we have things written currently, without this check the full
    // dest string will get treated as the destination and displayed in the
    // menu because DomainUtil.getIdentifier() doesn't raise exceptions.
    // We add this to fix https://www.requestpolicy.com/dev/ticket/39.
    if (!requestpolicy.mod.DomainUtil.isValidUri(dest)) {
      var destAsUri = requestpolicy.mod.DomainUtil.determineRedirectUri(origin,
          dest);
      requestpolicy.mod.Logger.warning(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
          "Redirect destination is not a valid uri, assuming dest <" + dest
              + "> from origin <" + origin + "> is actually dest <" + destAsUri
              + ">.");
      dest = destAsUri;
    }

    // Ignore redirects to javascript. The browser will ignore them, as well.
    if (requestpolicy.mod.DomainUtil.getUriObject(dest)
          .schemeIs("javascript")) {
      requestpolicy.mod.Logger.warning(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
          "Ignoring redirect to javascript URI <" + dest + ">");
      return;
    }

    if (this.isAllowedRedirect(origin, dest)) {
      requestpolicy.mod.Logger.warning(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT, "** ALLOWED ** '"
              + headerType + "' header to <" + dest + "> " + "from <" + origin
              + ">. Same hosts or allowed origin/destination.");
      this._recordAllowedRequest(origin, dest);
      this._allowedRedirectsReverse[dest] = origin;

      // If this was a link click or a form submission, we register an
      // additional click/submit with the original source but with a new
      // destination of the target of the redirect. This is because future
      // requests (such as using back/forward) might show up as directly from
      // the initial origin to the ultimate redirected destination.
      if (httpChannel.referrer) {
        var realOrigin = httpChannel.referrer.spec;

        if (this._clickedLinks[realOrigin]
            && this._clickedLinks[realOrigin][origin]) {
          requestpolicy.mod.Logger.warning(
              requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
              "This redirect was from a link click."
                  + " Registering an additional click to <" + dest + "> "
                  + "from <" + realOrigin + ">");
          this.registerLinkClicked(realOrigin, dest);

        } else if (this._submittedForms[realOrigin]
            && this._submittedForms[realOrigin][origin.split("?")[0]]) {
          requestpolicy.mod.Logger.warning(
              requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
              "This redirect was from a form submission."
                  + " Registering an additional form submission to <" + dest
                  + "> " + "from <" + realOrigin + ">");
          this.registerFormSubmitted(realOrigin, dest);
        }
      }

      return;
    }

    // The header isn't allowed, so remove it.
    try {
      if (!this._blockingDisabled) {
        httpChannel.setResponseHeader(headerType, "", false);
        this._blockedRedirects[origin] = dest;

        try {
          contentDisp = httpChannel.getResponseHeader("Content-Disposition");
          if (contentDisp.indexOf("attachment") != -1) {
            try {
              httpChannel.setResponseHeader("Content-Disposition", "", false);
              requestpolicy.mod.Logger.warning(
                  requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
                  "Removed 'Content-Disposition: attachment' header to "
                      + "prevent display of about:neterror.");
            } catch (e) {
              requestpolicy.mod.Logger.warning(
                  requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
                  "Unable to remove 'Content-Disposition: attachment' header "
                      + "to prevent display of about:neterror. " + e);
            }
          }
        } catch (e) {
          // No Content-Disposition header.
        }

        // We try to trace the blocked redirect back to a link click or form
        // submission if we can. It may indicate, for example, a link that
        // was to download a file but a redirect got blocked at some point.
        var initialOrigin = origin;
        var initialDest = dest;
        // To prevent infinite loops, bound the number of iterations.
        // Note that an apparent redirect loop doesn't mean a problem with a
        // website as the site may be using other information, such as cookies
        // that get set in the redirection process, to stop the redirection.
        var iterations = 0;
        const ASSUME_REDIRECT_LOOP = 100; // Chosen arbitrarily.
        while (this._allowedRedirectsReverse[initialOrigin]) {
          if (iterations++ >= ASSUME_REDIRECT_LOOP) {
            break;
          }
          initialDest = initialOrigin;
          initialOrigin = this._allowedRedirectsReverse[initialOrigin];
        }

        if (this._clickedLinksReverse[initialOrigin]) {
          for (var i in this._clickedLinksReverse[initialOrigin]) {
            // We hope there's only one possibility of a source page (that is,
            // ideally there will be one iteration of this loop).
            var sourcePage = i;
          }

          this._notifyRequestObserversOfBlockedLinkClickRedirect(sourcePage,
              origin, dest);

          // Maybe we just record the clicked link and each step in between as
          // an allowed request, and the final blocked one as a blocked request.
          // That is, make it show up in the requestpolicy menu like anything
          // else.
          // We set the "isInsert" parameter so we don't clobber the existing
          // info about allowed and deleted requests.
          this._recordAllowedRequest(sourcePage, initialOrigin, true);
        }

        // if (this._submittedFormsReverse[initialOrigin]) {
        // // TODO: implement for form submissions whose redirects are blocked
        // }

        this._recordRejectedRequest(origin, dest);
      }
      requestpolicy.mod.Logger.warning(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT, "** BLOCKED ** '"
              + headerType + "' header to <" + dest + ">"
              + " found in response from <" + origin + ">");
    } catch (e) {
      requestpolicy.mod.Logger.severe(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT, "Failed removing "
              + "'" + headerType + "' header to <" + dest + ">"
              + "  in response from <" + origin + ">." + e);
    }
  },

  /**
   * Currently this just looks for prefetch requests that are getting through
   * which we currently can't stop.
   */
  _examineHttpRequest : function(observedSubject) {
    var httpChannel = observedSubject
        .QueryInterface(Components.interfaces.nsIHttpChannel);
    try {
      // Determine if prefetch requests are slipping through.
      if (httpChannel.getRequestHeader("X-moz") == "prefetch") {
        // Seems to be too late to block it at this point. Calling the
        // cancel(status) method didn't stop it.
        requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_CONTENT,
            "Discovered prefetch request being sent to: " + httpChannel.name);
      }
    } catch (e) {
      // No X-moz header.
    }
  },

  _printAllowedRequests : function() {
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
    requestpolicy.mod.Logger.dump("Allowed Requests");
    for (i in this._allowedRequests) {
      requestpolicy.mod.Logger.dump("\t" + "Origin uri: <" + i + ">");
      for (var j in this._allowedRequests[i]) {
        requestpolicy.mod.Logger.dump("\t\t" + "Dest identifier: <" + j + ">");
        for (var k in this._allowedRequests[i][j]) {
          if (k == "count") {
            continue;
          }
          requestpolicy.mod.Logger.dump("\t\t\t" + k);
        }
      }
    }
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
  },

  _printRejectedRequests : function() {
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
    requestpolicy.mod.Logger.dump("Rejected Requests");
    for (i in this._rejectedRequests) {
      requestpolicy.mod.Logger.dump("\t" + "Origin uri: <" + i + ">");
      for (var j in this._rejectedRequests[i]) {
        requestpolicy.mod.Logger.dump("\t\t" + "Dest identifier: <" + j + ">");
        for (var k in this._rejectedRequests[i][j]) {
          if (k == "count") {
            continue;
          }
          requestpolicy.mod.Logger.dump("\t\t\t" + k);
        }
      }
    }
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
  },

  _notifyRequestObserversOfBlockedRequest : function(originUri, destUri) {
    for (var i = 0; i < this._requestObservers.length; i++) {
      if (!this._requestObservers[i]) {
        continue;
      }
      this._requestObservers[i].observeBlockedRequest(originUri, destUri);
    }
  },

  _notifyRequestObserversOfAllowedRequest : function(originUri, destUri) {
    for (var i = 0; i < this._requestObservers.length; i++) {
      if (!this._requestObservers[i]) {
        continue;
      }
      this._requestObservers[i].observeAllowedRequest(originUri, destUri);
    }
  },

  _notifyRequestObserversOfBlockedLinkClickRedirect : function(sourcePageUri,
      linkDestUri, blockedRedirectUri) {
    for (var i = 0; i < this._requestObservers.length; i++) {
      if (!this._requestObservers[i]) {
        continue;
      }
      this._requestObservers[i].observeBlockedLinkClickRedirect(sourcePageUri,
          linkDestUri, blockedRedirectUri);
    }
  },

  _notifyBlockedTopLevelDocRequest : function(originUri, destUri) {
    for (var i = 0; i < this._requestObservers.length; i++) {
      if (!this._requestObservers[i]) {
        continue;
      }
      this._requestObservers[i].observeBlockedTopLevelDocRequest(originUri,
          destUri);
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIRequestPolicy interface
  // /////////////////////////////////////////////////////////////////////////

  prefs : null,

  getUriIdentifier : function getUriIdentifier(uri) {
    return requestpolicy.mod.DomainUtil.getIdentifier(uri,
        this._uriIdentificationLevel);
  },

  registerHistoryRequest : function(destinationUrl) {
    var destinationUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil
            .stripFragment(destinationUrl));
    this._historyRequests[destinationUrl] = true;
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "History item requested: <" + destinationUrl + ">.");
  },

  registerFormSubmitted : function registerFormSubmitted(originUrl,
      destinationUrl) {
    var originUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil.stripFragment(originUrl));
    var destinationUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil
            .stripFragment(destinationUrl));

    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Form submitted from <" + originUrl + "> to <" + destinationUrl + ">.");

    // Drop the query string from the destination url because form GET requests
    // will end up with a query string on them when shouldLoad is called, so
    // we'll need to be dropping the query string there.
    destinationUrl = destinationUrl.split("?")[0];

    if (this._submittedForms[originUrl] == undefined) {
      this._submittedForms[originUrl] = {};
    }
    if (this._submittedForms[originUrl][destinationUrl] == undefined) {
      // TODO: See timestamp note for registerLinkClicked.
      this._submittedForms[originUrl][destinationUrl] = true;
    }

    // Keep track of a destination-indexed map, as well.
    if (this._submittedFormsReverse[destinationUrl] == undefined) {
      this._submittedFormsReverse[destinationUrl] = {};
    }
    if (this._submittedFormsReverse[destinationUrl][originUrl] == undefined) {
      // TODO: See timestamp note for registerLinkClicked.
      this._submittedFormsReverse[destinationUrl][originUrl] = true;
    }
  },

  registerLinkClicked : function registerLinkClicked(originUrl, destinationUrl) {
    var originUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil.stripFragment(originUrl));
    var destinationUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil
            .stripFragment(destinationUrl));

    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Link clicked from <" + originUrl + "> to <" + destinationUrl + ">.");

    if (this._clickedLinks[originUrl] == undefined) {
      this._clickedLinks[originUrl] = {};
    }
    if (this._clickedLinks[originUrl][destinationUrl] == undefined) {
      // TODO: Possibly set the value to a timestamp that can be used elsewhere
      // to determine if this is a recent click. This is probably necessary as
      // multiple calls to shouldLoad get made and we need a way to allow
      // multiple in a short window of time. Alternately, as it seems to always
      // be in order (repeats are always the same as the last), the last one
      // could be tracked and always allowed (or allowed within a small period
      // of time). This would have the advantage that we could delete items from
      // the _clickedLinks object. One of these approaches would also reduce log
      // clutter, which would be good.
      this._clickedLinks[originUrl][destinationUrl] = true;
    }

    // Keep track of a destination-indexed map, as well.
    if (this._clickedLinksReverse[destinationUrl] == undefined) {
      this._clickedLinksReverse[destinationUrl] = {};
    }
    if (this._clickedLinksReverse[destinationUrl][originUrl] == undefined) {
      // TODO: Possibly set the value to a timestamp, as described above.
      this._clickedLinksReverse[destinationUrl][originUrl] = true;
    }
  },

  registerAllowedRedirect : function registerAllowedRedirect(originUrl,
      destinationUrl) {
    var originUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil.stripFragment(originUrl));
    var destinationUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil
            .stripFragment(destinationUrl));

    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "User-allowed redirect from <" + originUrl + "> to <" + destinationUrl
            + ">.");

    if (this._userAllowedRedirects[originUrl] == undefined) {
      this._userAllowedRedirects[originUrl] = {};
    }
    if (this._userAllowedRedirects[originUrl][destinationUrl] == undefined) {
      this._userAllowedRedirects[originUrl][destinationUrl] = true;
    }
  },

  _allowOrigin : function(host, noStore) {
    this._allowedOrigins[host] = true;
    if (!noStore) {
      this._storePreferenceList("allowedOrigins");
    }
  },

  allowOrigin : function allowOrigin(host) {
    this._allowOrigin(host, false);
  },

  allowOriginDelayStore : function allowOriginDelayStore(host) {
    this._allowOrigin(host, true);
  },

  isAllowedOrigin : function isAllowedOrigin(host) {
    return this._allowedOrigins[host] ? true : false;
  },

  temporarilyAllowOrigin : function temporarilyAllowOrigin(host) {
    if (!this._temporarilyAllowedOrigins[host]) {
      this._temporarilyAllowedOriginsCount++;
      this._temporarilyAllowedOrigins[host] = true;
    }
  },

  isTemporarilyAllowedOrigin : function isTemporarilyAllowedOrigin(host) {
    return this._temporarilyAllowedOrigins[host] ? true : false;
  },

  _allowDestination : function(host, noStore) {
    this._allowedDestinations[host] = true;
    if (!noStore) {
      this._storePreferenceList("allowedDestinations");
    }
  },

  allowDestination : function allowDestination(host) {
    this._allowDestination(host, false);
  },

  allowDestinationDelayStore : function allowDestinationDelayStore(host) {
    this._allowDestination(host, true);
  },

  isAllowedDestination : function isAllowedDestination(host) {
    return this._allowedDestinations[host] ? true : false;
  },

  temporarilyAllowDestination : function temporarilyAllowDestination(host) {
    if (!this._temporarilyAllowedDestinations[host]) {
      this._temporarilyAllowedDestinationsCount++;
      this._temporarilyAllowedDestinations[host] = true;
    }
  },

  isTemporarilyAllowedDestination : function isTemporarilyAllowedDestination(
      host) {
    return this._temporarilyAllowedDestinations[host] ? true : false;
  },

  _getCombinedOriginToDestinationIdentifier : function(originIdentifier,
      destIdentifier) {
    return originIdentifier + "|" + destIdentifier;
  },

  _combinedOriginToDestinationIdentifierHasOrigin : function(
      originToDestIdentifier, originIdentifier) {
    return originToDestIdentifier.indexOf(originIdentifier + "|") == 0;
  },

  _combinedOriginToDestinationIdentifierHasDestination : function(
      originToDestIdentifier, destIdentifier) {
    // TODO eliminate false positives
    return originToDestIdentifier.indexOf("|" + destIdentifier) != -1;
  },

  _allowOriginToDestination : function(originIdentifier, destIdentifier,
      noStore) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    this._allowOriginToDestinationByCombinedIdentifier(combinedId, noStore);
  },

  allowOriginToDestination : function allowOriginToDestination(
      originIdentifier, destIdentifier) {
    this._allowOriginToDestination(originIdentifier, destIdentifier, false);
  },

  allowOriginToDestinationDelayStore : function allowOriginToDestinationDelayStore(
      originIdentifier, destIdentifier) {
    this._allowOriginToDestination(originIdentifier, destIdentifier, true);
  },

  _allowOriginToDestinationByCombinedIdentifier : function(combinedId, noStore) {
    this._allowedOriginsToDestinations[combinedId] = true;
    if (!noStore) {
      this._storePreferenceList("allowedOriginsToDestinations");
    }
  },

  isAllowedOriginToDestination : function isAllowedOriginToDestination(
      originIdentifier, destIdentifier) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    return this._allowedOriginsToDestinations[combinedId] ? true : false;
  },

  temporarilyAllowOriginToDestination : function temporarilyAllowOriginToDestination(
      originIdentifier, destIdentifier) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    if (!this._temporarilyAllowedOriginsToDestinations[combinedId]) {
      this._temporarilyAllowedOriginsToDestinationsCount++;
      this._temporarilyAllowedOriginsToDestinations[combinedId] = true;
    }
  },

  isTemporarilyAllowedOriginToDestination : function isTemporarilyAllowedOriginToDestination(
      originIdentifier, destIdentifier) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    return this._temporarilyAllowedOriginsToDestinations[combinedId]
        ? true
        : false;
  },

  revokeTemporaryPermissions : function revokeTemporaryPermissions(host) {
    this._temporarilyAllowedOriginsCount = 0;
    this._temporarilyAllowedOrigins = {};

    this._temporarilyAllowedDestinationsCount = 0;
    this._temporarilyAllowedDestinations = {};

    this._temporarilyAllowedOriginsToDestinationsCount = 0;
    this._temporarilyAllowedOriginsToDestinations = {};

    this._blockingDisabled = false;
  },

  _forbidOrigin : function(host, noStore) {
    if (this._temporarilyAllowedOrigins[host]) {
      this._temporarilyAllowedOriginsCount--;
      delete this._temporarilyAllowedOrigins[host];
    }
    if (this._allowedOrigins[host]) {
      delete this._allowedOrigins[host];
      if (!noStore) {
        this._storePreferenceList("allowedOrigins");
      }
    }
  },

  forbidOrigin : function forbidOrigin(host) {
    this._forbidOrigin(host, false);
  },

  forbidOriginDelayStore : function forbidOriginDelayStore(host) {
    this._forbidOrigin(host, true);
  },

  _forbidDestination : function(host, noStore) {
    if (this._temporarilyAllowedDestinations[host]) {
      this._temporarilyAllowedDestinationsCount--;
      delete this._temporarilyAllowedDestinations[host];
    }
    if (this._allowedDestinations[host]) {
      delete this._allowedDestinations[host];
      if (!noStore) {
        this._storePreferenceList("allowedDestinations");
      }
    }
  },

  forbidDestination : function forbidDestination(host) {
    this._forbidDestination(host, false);
  },

  forbidDestinationDelayStore : function forbidDestinationDelayStore(host) {
    this._forbidDestination(host, true);
  },

  _forbidOriginToDestination : function(originIdentifier, destIdentifier,
      noStore) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    this._forbidOriginToDestinationByCombinedIdentifier(combinedId);
  },

  forbidOriginToDestination : function forbidOriginToDestination(
      originIdentifier, destIdentifier) {
    this._forbidOriginToDestination(originIdentifier, destIdentifier, false);
  },

  forbidOriginToDestinationDelayStore : function forbidOriginToDestinationDelayStore(
      originIdentifier, destIdentifier) {
    this._forbidOriginToDestination(originIdentifier, destIdentifier, true);
  },

  _forbidOriginToDestinationByCombinedIdentifier : function(combinedId, noStore) {
    var parts = combinedId.split('|');
    var originIdentifier = parts[0];
    var destIdentifier = parts[1];
    if (this._temporarilyAllowedOriginsToDestinations[combinedId]) {
      this._temporarilyAllowedOriginsToDestinationsCount--;
      delete this._temporarilyAllowedOriginsToDestinations[combinedId];
    }
    if (this._allowedOriginsToDestinations[combinedId]) {
      delete this._allowedOriginsToDestinations[combinedId];
      if (!noStore) {
        this._storePreferenceList("allowedOriginsToDestinations");
      }
    }
  },

  mapDestinations : function(origDestUri, newDestUri) {
    origDestUri = requestpolicy.mod.DomainUtil.stripFragment(origDestUri);
    newDestUri = requestpolicy.mod.DomainUtil.stripFragment(newDestUri);
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Mapping destination <" + origDestUri + "> to <" + newDestUri + ">.");
    if (!this._mappedDestinations[newDestUri]) {
      this._mappedDestinations[newDestUri] = {};
    }
    this._mappedDestinations[newDestUri][origDestUri] =
        requestpolicy.mod.DomainUtil.getUriObject(origDestUri);
  },

  _storePreferenceList : function(prefName) {
    var setFromObj = this._prefNameToObjectMap[prefName];
    if (setFromObj === undefined) {
      throw "Invalid prefName: " + prefName;
    }
    var value = this._objToPrefString(setFromObj);
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Setting preference <" + prefName + "> to value <" + value + ">.");

    // Not using just setCharPref because these values may contain Unicode
    // strings (e.g. for IDNs).
    var str = CC["@mozilla.org/supports-string;1"]
        .createInstance(CI.nsISupportsString);
    str.data = value;
    this.prefs.setComplexValue(prefName, CI.nsISupportsString, str);

    // Flush the prefs so that if the browser crashes, the changes aren't lost.
    // TODO: flush the file once after any changed preferences have been
    // modified, rather than once on each call to the current function.
    this._prefService.savePrefFile(null);
  },

  storeAllPreferenceLists : function() {
    for (var prefName in this._prefNameToObjectMap) {
      this._storePreferenceList(prefName);
    }
  },

  _getPreferenceObj : function(prefName) {
    // Not using just getCharPref because these values may contain Unicode
    // strings (e.g. for IDNs).
    var prefString = this.prefs.getComplexValue(prefName, CI.nsISupportsString).data;
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Loading preference <" + prefName + "> from value <" + prefString
            + ">.");
    return this._prefStringToObj(prefString);
  },

  _objToPrefString : function(obj) {
    var a = [];
    for (var i in obj) {
      a.push(i);
    }
    return a.join(" ");
  },

  _prefStringToObj : function(prefString) {
    var prefObj = {};
    var prefArray = prefString.split(" ");
    if (prefArray[0] != "") {
      for (var i in prefArray) {
        prefObj[prefArray[i]] = true;
      }
    }
    return prefObj;
  },

  isAllowedRedirect : function(originUri, destinationUri) {
    // TODO: Find a way to get rid of repitition of code between this and
    // shouldLoad().

    // Note: If changing the logic here, also make necessary changes to
    // shouldLoad().

    // This is not including link clicks, form submissions, and user-allowed
    // redirects.

    var originIdentifier = this.getUriIdentifier(originUri);
    var destIdentifier = this.getUriIdentifier(destinationUri);

    if (destIdentifier == originIdentifier) {
      return true;
    } else if (this.isTemporarilyAllowedOrigin(originIdentifier)) {
      return true;
    } else if (this.isAllowedOrigin(originIdentifier)) {
      return true;
    } else if (this.isTemporarilyAllowedDestination(destIdentifier)) {
      return true;
    } else if (this.isAllowedDestination(destIdentifier)) {
      return true;
    } else if (this.isTemporarilyAllowedOriginToDestination(originIdentifier,
        destIdentifier)) {
      return true;
    } else if (this.isAllowedOriginToDestination(originIdentifier,
        destIdentifier)) {
      return true;
    } else if (destinationUri[0] && destinationUri[0] == '/'
        || destinationUri.indexOf(":") == -1) {
      // Redirect is to a relative url.
      return true;
    }

    for (var i = 0; i < this._compatibilityRules.length; i++) {
      var rule = this._compatibilityRules[i];
      var allowOrigin = rule[0] ? originUri.indexOf(rule[0]) == 0 : true;
      var allowDest = rule[1] ? destinationUri.indexOf(rule[1]) == 0 : true;
      if (allowOrigin && allowDest) {
        // TODO: Give the reason the request was allowed.
        // return this.accept("Extension compatibility rule matched [" + rule[2]
        // + "]", arguments, true);
        return true;
      }
    }

    return false;
  },

  /**
   * Determines whether the user has granted any temporary permissions. This
   * does not include temporarily disabling all blocking.
   * 
   * @return {Boolean} true if any temporary permissions have been granted,
   *         false otherwise.
   */
  areTemporaryPermissionsGranted : function areTemporaryPermissionsGranted() {
    return this._temporarilyAllowedOriginsCount != 0
        || this._temporarilyAllowedDestinationsCount != 0
        || this._temporarilyAllowedOriginsToDestinationsCount != 0;
  },

  getConflictingExtensions : function getConflictingExtensions() {
    return this._conflictingExtensions;
  },

  getTopLevelDocTranslations : function getTopLevelDocTranslations() {
    return this._topLevelDocTranslationRules;
  },

  isPrefetchEnabled : function isPrefetchEnabled() {
    // network.dns.disablePrefetch only exists starting in Firefox 3.1
    try {
      return this._rootPrefs.getBoolPref("network.prefetch-next")
          || !this._rootPrefs.getBoolPref("network.dns.disablePrefetch");
    } catch (e) {
      return this._rootPrefs.getBoolPref("network.prefetch-next");
    }
  },

  isBlockingDisabled : function isBlockingDisabled() {
    return this._blockingDisabled;
  },

  isPrivateBrowsingEnabled : function isPrivateBrowsingEnabled() {
    return this._privateBrowsingEnabled;
  },

  originHasRejectedRequests : function(originUri) {
    return this._originHasRejectedRequestsHelper(originUri, {});
  },

  _originHasRejectedRequestsHelper : function(originUri, checkedUris) {
    if (checkedUris[originUri]) {
      return false;
    }
    checkedUris[originUri] = true;

    var rejectedRequests = this._rejectedRequests[originUri];
    if (rejectedRequests) {
      for (var i in rejectedRequests) {
        for (var j in rejectedRequests[i]) {
          if (rejectedRequests[i][j]) {
            return true;
          }
        }
      }
    }
    // If this url had an allowed redirect to another url which in turn had a
    // rejected redirect (e.g. installing extensions from AMO with full domain
    // strictness enabled), then it will show up by recursively checking each
    // allowed request.
    // I think this logic will also indicate rejected requests if this
    // origin has rejected requests from other origins within it. I don't
    // believe this will cause a problem.
    var allowedRequests = this._allowedRequests[originUri];
    if (allowedRequests) {
      for (var i in allowedRequests) {
        for (var j in allowedRequests[i]) {
          if (this._originHasRejectedRequestsHelper(j, checkedUris)) {
            return true;
          }
        }
      }
    }
    return false;
  },

  _dumpRequestTrackingObject : function(obj, name) {
    function print(msg) {
      requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
          msg);
    }
    print("--------------------------------------------");
    print(name + ":");
    for (var i in obj) {
      print("\t" + i);
      for (var j in obj[i]) {
        print("\t\t" + j);
        for (var k in obj[i][j]) {
          print("\t\t\t" + k);
        }
      }
    }
    print("--------------------------------------------");
  },

  _dumpRejectedRequests : function() {
    this
        ._dumpRequestTrackingObject(this._rejectedRequests, "Rejected requests")
  },

  _dumpAllowedRequests : function() {
    this._dumpRequestTrackingObject(this._allowedRequests, "Allowed requests")
  },

  /**
   * Add an observer to be notified of all blocked and allowed requests. TODO:
   * This should be made to accept instances of a defined interface.
   * 
   * @param {}
   *          observer
   */
  addRequestObserver : function addRequestObserver(observer) {
    if (!("observeBlockedRequest" in observer)) {
      throw "Observer passed to addRequestObserver does "
          + "not have an observeBlockedRequest() method.";
    }
    requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Adding request observer: " + observer.toString());
    this._requestObservers.push(observer);
  },

  /**
   * Remove an observer added through addRequestObserver().
   * 
   * @param {}
   *          observer
   */
  removeRequestObserver : function removeRequestObserver(observer) {
    for (var i = 0; i < this._requestObservers.length; i++) {
      if (this._requestObservers[i] == observer) {
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Removing request observer: " + observer.toString());
        delete this._requestObservers[i];
        return;
      }
    }
    requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Could not find observer to remove " + "in removeRequestObserver()");
  },

  /**
   * Handles observer notifications sent by the HTTPS Everywhere extension
   * that inform us of URIs that extension has rewritten.
   *
   * @param nsIURI oldURI
   * @param string newSpec
   */
  _handleHttpsEverywhereUriRewrite: function(oldURI, newSpec) {
    oldURI = oldURI.QueryInterface(CI.nsIURI);
    this.mapDestinations(oldURI.spec, newSpec);
  },

  _handleUninstallOrDisable : function() {
    requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
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
        this._examineHttpResponse(subject);
        break;
      case "http-on-modify-request" :
        this._examineHttpRequest(subject);
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
        this._init();
        // "profile-after-change" means that user preferences are now
        // accessible. If we tried to load preferences before this, we would get
        // default preferences rather than user preferences.
        this._syncFromPrefs();
        this._initVersionInfo();
        // Detect other installed extensions and the current application and do
        // what is needed to allow their requests.
        this._initializeExtensionCompatibility();
        this._initializeApplicationCompatibility();

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
      case "em-action-requested" :
        if ((subject instanceof CI.nsIUpdateItem)
            && subject.id == EXTENSION_ID) {
          if (data == "item-uninstalled" || data == "item-disabled") {
            this._uninstall = true;
            requestpolicy.mod.Logger.debug(
                requestpolicy.mod.Logger.TYPE_INTERNAL, "Disabled");
          } else if (data == "item-cancel-action") {
            // This turns out to be correct. Unlike with the AddonManager
            // in Firefox 4, here if the user does a "disable" followed by
            // "uninstall" followed by a single "undo", rather than the
            // "undo" triggering a"n "item-cancel-action", the first "undo"
            // appears to send an "item-disabled" and only if the user click
            // "undo" a second time does the "item-cancel-action" event occur.
            this._uninstall = false;
            requestpolicy.mod.Logger.debug(
                requestpolicy.mod.Logger.TYPE_INTERNAL, "Enabled");
          }
        }
        break;
      case "quit-application" :
        if (this._uninstall) {
          this._handleUninstallOrDisable();
        }
        break;
      default :
        requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_ERROR,
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
    this.shouldLoad = this.mainContentPolicy.shouldLoad;
    if (!this.mimeService) {
      // this.rejectCode = typeof(/ /) == "object" ? -4 : -3;
      this.rejectCode = CI.nsIContentPolicy.REJECT_SERVER;
      this.mimeService = CC['@mozilla.org/uriloader/external-helper-app-service;1']
          .getService(CI.nsIMIMEService);
    }
  },

  _argumentsToString : function(aContentType, dest, origin, aContext,
      aMimeTypeGuess, aExtra) {
    // Note: try not to cause side effects of toString() during load, so "<HTML
    // Element>" is hard-coded.
    return "type: "
        + aContentType
        + ", destination: "
        + dest
        + ", origin: "
        + origin
        + ", context: "
        + ((aContext instanceof CI.nsIDOMHTMLElement)
            ? "<HTML Element>"
            : aContext) + ", mime: " + aMimeTypeGuess + ", " + aExtra;
  },

  // We always call this from shouldLoad to reject a request.
  reject : function(reason, args) {
    requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_CONTENT,
        "** BLOCKED ** reason: "
            + reason
            + ". "
            + this._argumentsToString(args[0], args[1], args[2], args[3],
                args[4], args[5]));

    if (this._blockingDisabled) {
      return CP_OK;
    }

    var origin = args[2];
    var dest = args[1];

    // args[3] is the context
    args[3].requestpolicyBlocked = true;

    this._cacheShouldLoadResult(CP_REJECT, origin, dest);
    this._recordRejectedRequest(origin, dest);

    var aContentType = args[0];
    if (CI.nsIContentPolicy.TYPE_DOCUMENT == aContentType) {
      // This was a blocked top-level document request. This may be due to
      // a blocked attempt by javascript to set the document location.
      this._notifyBlockedTopLevelDocRequest(origin, dest);
    }

    return CP_REJECT;
  },

  _recordRejectedRequest : function(originUri, destUri) {
    var destIdentifier = this.getUriIdentifier(destUri);

    // Keep track of the rejected requests by full origin uri, then within each
    // full origin uri, organize by dest hostnames. This makes it easy to
    // determine the rejected dest hosts from a given page. The full
    // dest uri for each rejected dest is then also kept. This
    // allows showing the number of blocked unique dests to each
    // dest host.
    if (!this._rejectedRequests[originUri]) {
      this._rejectedRequests[originUri] = {};
    }
    var originRejected = this._rejectedRequests[originUri];
    if (!originRejected[destIdentifier]) {
      originRejected[destIdentifier] = {};
    }
    if (!originRejected[destIdentifier][destUri]) {
      originRejected[destIdentifier][destUri] = true;
      if (!originRejected[destIdentifier].count) {
        originRejected[destIdentifier].count = 1;
      } else {
        originRejected[destIdentifier].count++;
      }
    }

    // Remove this request from the set of allowed requests.
    if (this._allowedRequests[originUri]) {
      var originAllowed = this._allowedRequests[originUri];
      if (originAllowed[destIdentifier]) {
        delete originAllowed[destIdentifier][destUri];
        originAllowed[destIdentifier].count--;
        if (originAllowed[destIdentifier].count == 0) {
          delete originAllowed[destIdentifier];
        }
      }
    }

    this._notifyRequestObserversOfBlockedRequest(originUri, destUri);
  },

  // We only call this from shouldLoad when the request was a remote request
  // initiated by the content of a page. this is partly for efficiency. in other
  // cases we just return CP_OK rather than return this function which
  // ultimately returns CP_OK. Third param, "unforbidable", is set to true if
  // this request shouldn't be recorded as an allowed request.
  accept : function(reason, args, unforbidable) {
    requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_CONTENT,
        "** ALLOWED ** reason: "
            + reason
            + ". "
            + this._argumentsToString(args[0], args[1], args[2], args[3],
                args[4], args[5]));

    var origin = args[2];
    var dest = args[1];

    this._cacheShouldLoadResult(CP_OK, origin, dest);
    // We aren't recording the request so it doesn't show up in the menu, but we
    // want it to still show up in the request log.
    if (unforbidable) {
      this._notifyRequestObserversOfAllowedRequest(origin, dest);
    } else {
      this._recordAllowedRequest(origin, dest);
    }

    return CP_OK;
  },

  _recordAllowedRequest : function(originUri, destUri, isInsert) {
    var destIdentifier = this.getUriIdentifier(destUri);

    if (isInsert == undefined) {
      isInsert = false;
    }

    // Reset the accepted and rejected requests originating from this
    // destination. That is, if this accepts a request to a uri that may itself
    // originate further requests, reset the information about what that page is
    // accepting and rejecting.
    // If "isInsert" is set, then we don't want to clear the destUri info.
    if (!isInsert) {
      if (this._allowedRequests[destUri]) {
        delete this._allowedRequests[destUri];
      }
      if (this._rejectedRequests[destUri]) {
        delete this._rejectedRequests[destUri];
      }
    }

    // Remove this request from the set of rejected requests.
    if (this._rejectedRequests[originUri]) {
      var originRejected = this._rejectedRequests[originUri];
      if (originRejected[destIdentifier]) {
        delete originRejected[destIdentifier][destUri];
        originRejected[destIdentifier].count--;
        if (originRejected[destIdentifier].count == 0) {
          delete originRejected[destIdentifier];
        }
      }
    }

    // Keep track of the accepted requests.
    if (!this._allowedRequests[originUri]) {
      this._allowedRequests[originUri] = {};
    }
    var originAllowed = this._allowedRequests[originUri];
    if (!originAllowed[destIdentifier]) {
      originAllowed[destIdentifier] = {};
    }
    if (!originAllowed[destIdentifier][destUri]) {
      originAllowed[destIdentifier][destUri] = true;
      if (!originAllowed[destIdentifier].count) {
        originAllowed[destIdentifier].count = 1;
      } else {
        originAllowed[destIdentifier].count++;
      }
    }

    this._notifyRequestObserversOfAllowedRequest(originUri, destUri);
  },

  _cacheShouldLoadResult : function(result, originUri, destUri) {
    var date = new Date();
    this._lastShouldLoadCheck.time = date.getTime();
    this._lastShouldLoadCheck.destination = destUri;
    this._lastShouldLoadCheck.origin = originUri;
    this._lastShouldLoadCheck.result = result;
  },

  /**
   * Determines if a request is only related to internal resources.
   * 
   * @param {}
   *          aContentLocation
   * @param {}
   *          aRequestOrigin
   * @return {Boolean} true if the request is only related to internal
   *         resources.
   */
  _isInternalRequest : function(aContentLocation, aRequestOrigin) {
    // Note: Don't OK the origin scheme "moz-nullprincipal" without further
    // understanding. It appears to be the source when test8.html is used. That
    // is, javascript redirect to a "javascript:" url that creates the entire
    // page's content which includes a form that it submits. Maybe
    // "moz-nullprincipal" always shows up when using "document.location"?

    // Not cross-site requests.
    if (aContentLocation.scheme == "resource"
        || aContentLocation.scheme == "about"
        || aContentLocation.scheme == "data"
        || aContentLocation.scheme == "chrome"
        || aContentLocation.scheme == "moz-icon"
        || aContentLocation.scheme == "moz-filedata"
        || aContentLocation.scheme == "blob"
        || aContentLocation.scheme == "wyciwyg"
        || aContentLocation.scheme == "javascript") {
      return true;
    }

    if (aRequestOrigin == undefined || aRequestOrigin == null) {
      return true;
    }

    try {
      // The asciiHost values will exist but be empty strings for the "file"
      // scheme, so we don't want to allow just because they are empty strings,
      // only if not set at all.
      aRequestOrigin.asciiHost;
      aContentLocation.asciiHost;
      // The spec can be empty if odd things are going on, like the Refcontrol
      // extension causing back/forward button-initiated requests to have
      // aRequestOrigin be a virtually empty nsIURL object.
      var missingSpecOrHost = aRequestOrigin.spec === "";
    } catch (e) {
      missingSpecOrHost = true;
    }

    if (missingSpecOrHost) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_CONTENT,
          "No asciiHost or empty spec on either aRequestOrigin <"
              + aRequestOrigin.spec + "> or aContentLocation <"
              + aContentLocation.spec + ">");
      return true;
    }

    var destHost = aContentLocation.asciiHost;

    // "global" dest are [some sort of interal requests]
    // "browser" dest are [???]
    if (destHost == "global" || destHost == "browser") {
      return true;
    }

    if (aRequestOrigin.scheme == 'about'
        && aRequestOrigin.spec.indexOf("about:neterror?") == 0) {
      return true;
    }

    // If there are entities in the document, they may trigger a local file
    // request. We'll only allow requests to .dtd files, though, so we don't
    // open up all file:// destinations.
    if (aContentLocation.scheme == "file"
        && /.\.dtd$/.test(aContentLocation.path)) {
      return true;
    }

    return false;
  },

  /**
   * Determines if a request is a duplicate of the last call to shouldLoad(). If
   * it is, the cached result in _lastShouldLoadCheck.result can be used. Not
   * sure why, it seems that there are duplicates so using this simple cache of
   * the last call to shouldLoad() keeps duplicates out of log data.
   * 
   * @param {}
   *          aContentLocation
   * @param {}
   *          aRequestOrigin
   * @return {Boolean} true if the request a duplicate.
   */
  _isDuplicateRequest : function(dest, origin) {

    if (this._lastShouldLoadCheck.origin == origin
        && this._lastShouldLoadCheck.destination == dest) {
      var date = new Date();
      if (date.getTime() - this._lastShouldLoadCheck.time < this._lastShouldLoadCheckTimeout) {
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_CONTENT,
            "Using cached shouldLoad() result of "
                + this._lastShouldLoadCheck.result + " for request to <" + dest
                + "> from <" + origin + ">.");
        return true;
      } else {
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_CONTENT,
            "shouldLoad() cache expired for result of "
                + this._lastShouldLoadCheck.result + " for request to <" + dest
                + "> from <" + origin + ">.");
      }
    }
    return false;
  },

  // the content policy that does something useful
  mainContentPolicy : {

    // https://developer.mozilla.org/en/nsIContentPolicy
    shouldLoad : function(aContentType, aContentLocation, aRequestOrigin,
        aContext, aMimeTypeGuess, aExtra, aRequestPrincipal) {
      try {

        if (this._isInternalRequest(aContentLocation, aRequestOrigin)) {
          return CP_OK;
        }

        // We don't need to worry about ACE formatted IDNs because it seems
        // that they'll automatically be converted to UTF8 format before we
        // even get here, as long as they're valid and Mozilla allows the TLD
        // to have UTF8 formatted IDNs.
        var origin = requestpolicy.mod.DomainUtil
            .stripFragment(aRequestOrigin.spec);
        var dest = requestpolicy.mod.DomainUtil
            .stripFragment(aContentLocation.spec);

        // Fx 16 changed the following: 1) we should be able to count on the
        // referrer (aRequestOrigin) being set to something besides
        // moz-nullprincipal when there is a referrer, and 2) the new argument
        // aRequestPrincipal is provided. This means our hackery to set the
        // referrer based on aContext when aRequestOrigin is moz-nullprincipal
        // is now causing requests that don't have a referrer (namely, URLs
        // entered in the address bar) to be blocked and trigger a top-level
        // document redirect notification.
        if (aRequestOrigin.scheme == "moz-nullprincipal" && aRequestPrincipal) {
          requestpolicy.mod.Logger.warning(
              requestpolicy.mod.Logger.TYPE_CONTENT,
              "Allowing request that appears to be a URL entered in the "
                  + "location bar or some other good explanation: " + dest);
          return CP_OK;
        }

        // Note: Assuming the Fx 16 moz-nullprincipal+aRequestPrincipal check
        // above is correct, this should be able to be removed when Fx < 16 is
        // no longer supported.
        if (aRequestOrigin.scheme == "moz-nullprincipal" && aContext) {
          var newOrigin = requestpolicy.mod.DomainUtil
                .stripFragment(aContext.contentDocument.documentURI);
          requestpolicy.mod.Logger.info(
              requestpolicy.mod.Logger.TYPE_CONTENT,
              "Considering moz-nullprincipal origin <"
                  + origin + "> to be origin <" + newOrigin + ">");
          origin = newOrigin;
          aRequestOrigin = requestpolicy.mod.DomainUtil.getUriObject(origin);
        }

        if (aRequestOrigin.scheme == "view-source") {
          var newOrigin = origin.split(":").slice(1).join(":");
          requestpolicy.mod.Logger.info(
            requestpolicy.mod.Logger.TYPE_CONTENT,
            "Considering view-source origin <"
              + origin + "> to be origin <" + newOrigin + ">");
          origin = newOrigin;
          aRequestOrigin = requestpolicy.mod.DomainUtil.getUriObject(origin);
        }

        if (aContentLocation.scheme == "view-source") {
          var newDest = dest.split(":").slice(1).join(":");
          requestpolicy.mod.Logger.info(
              requestpolicy.mod.Logger.TYPE_CONTENT,
              "Considering view-source destination <"
                  + dest + "> to be destination <" + newDest + ">");
          dest = newDest;
          aContentLocation = requestpolicy.mod.DomainUtil.getUriObject(dest);
        }

        if (origin == "about:blank" && aContext) {
          var newOrigin;
          if (aContext.documentURI && aContext.documentURI != "about:blank") {
            newOrigin = aContext.documentURI;
          } else if (aContext.ownerDocument &&
                     aContext.ownerDocument.documentURI &&
                     aContext.ownerDocument.documentURI != "about:blank") {
            newOrigin = aContext.ownerDocument.documentURI;
          }
          if (newOrigin) {
            newOrigin = requestpolicy.mod.DomainUtil.stripFragment(newOrigin);
            requestpolicy.mod.Logger.info(
                requestpolicy.mod.Logger.TYPE_CONTENT, "Considering origin <"
                    + origin + "> to be origin <" + newOrigin + ">");
            origin = newOrigin;
            aRequestOrigin = requestpolicy.mod.DomainUtil.getUriObject(origin);
          }
        }

        if (this._isDuplicateRequest(dest, origin)) {
          return this._lastShouldLoadCheck.result;
        }

        // Sometimes, clicking a link to a fragment will result in a request
        // where the origin is the same as the destination, but none of the
        // additional content of the page is again requested. The result is that
        // nothing ends up showing for blocked or allowed destinations because
        // all of that data was cleared due to the new request.
        // Example to test with: Click on "expand all" at
        // http://code.google.com/p/SOME_PROJECT/source/detail?r=SOME_REVISION
        if (origin == dest) {
          requestpolicy.mod.Logger.warning(
              requestpolicy.mod.Logger.TYPE_CONTENT,
              "Allowing (but not recording) request "
                  + "where origin is the same as the destination: " + origin);
          return CP_OK;
        }

        var args = [aContentType, dest, origin, aContext, aMimeTypeGuess,
            aExtra];

        if (aContext && aContext.nodeName == "LINK" &&
            (aContext.rel == "icon" || aContext.rel == "shortcut icon")) {
          this._faviconRequests[dest] = true;
        }

        // Note: If changing the logic here, also make necessary changes to
        // isAllowedRedirect).

        // Checking for link clicks, form submissions, and history requests
        // should be done before other checks. Specifically, when link clicks
        // were done after allowed-origin and other checks, then links that
        // were allowed due to other checks would end up recorded in the origin
        // url's allowed requests, and woud then show up on one tab if link
        // was opened in a new tab but that link would have been allowed
        // regardless of the link click. The original tab would then show it
        // in its menu.
        if (this._clickedLinks[origin] && this._clickedLinks[origin][dest]) {
          // Don't delete the _clickedLinks item. We need it for if the user
          // goes back/forward through their history.
          // delete this._clickedLinks[origin][dest];
          return this
              .accept("User-initiated request by link click", args, true);

        } else if (this._submittedForms[origin]
            && this._submittedForms[origin][dest.split("?")[0]]) {
          // Note: we dropped the query string from the dest because form GET
          // requests will have that added on here but the original action of
          // the form may not have had it.
          // Don't delete the _clickedLinks item. We need it for if the user
          // goes back/forward through their history.
          // delete this._submittedForms[origin][dest.split("?")[0]];
          return this.accept("User-initiated request by form submission", args,
              true);

        } else if (this._historyRequests[dest]) {
          // When the user goes back and forward in their history, a request for
          // the url comes through but is not followed by requests for any of
          // the page's content. Therefore, we make sure that our cache of
          // blocked requests isn't removed in this case.
          delete this._historyRequests[dest];
          return this.accept("History request", args, true);
        } else if (this._userAllowedRedirects[origin]
            && this._userAllowedRedirects[origin][dest]) {
          // shouldLoad is called by location.href in overlay.js as of Fx
          // 3.7a5pre and SeaMonkey 2.1a.
          return this.accept("User-allowed redirect", args, true);
        }

        var originIdentifier = this.getUriIdentifier(origin);
        var destIdentifier = this.getUriIdentifier(dest);

        if (destIdentifier == originIdentifier) {
          return this.accept("same host (at current domain strictness level)",
              args);
        }

        if (this.isAllowedOriginToDestination(originIdentifier, destIdentifier)) {
          return this.accept("Allowed origin to destination", args);
        }

        if (this.isAllowedOrigin(originIdentifier)) {
          return this.accept("Allowed origin", args);
        }

        if (this.isAllowedDestination(destIdentifier)) {
          return this.accept("Allowed destination", args);
        }

        if (this.isTemporarilyAllowedOriginToDestination(originIdentifier,
            destIdentifier)) {
          return this.accept("Temporarily allowed origin to destination", args);
        }

        if (this.isTemporarilyAllowedOrigin(originIdentifier)) {
          return this.accept("Temporarily allowed origin", args);
        }

        if (this.isTemporarilyAllowedDestination(destIdentifier)) {
          return this.accept("Temporarily allowed destination", args);
        }

        if (aRequestOrigin.scheme == "chrome") {
          if (aRequestOrigin.asciiHost == "browser") {
            // "browser" origin shows up for favicon.ico and an address entered
            // in address bar.
            return this.accept(
                "User action (e.g. address entered in address bar) or other good "
                    + "explanation (e.g. new window/tab opened)", args);
          } else {
            // TODO: It seems sketchy to allow all requests from chrome. If I
            // had to put my money on a possible bug (in terms of not blocking
            // requests that should be), I'd put it here. Doing this, however,
            // saves a lot of blocking of legitimate requests from extensions
            // that originate from their xul files. If you're reading this and
            // you know of a way to use this to evade RequestPolicy, please let
            // me know, I will be very grateful.
            return this.accept(
                "User action (e.g. address entered in address bar) or other good "
                    + "explanation (e.g. new window/tab opened)", args);
          }
        }

        // This is mostly here for the case of popup windows where the user has
        // allowed popups for the domain. In that case, the window.open() call
        // that made the popup isn't calling the wrapped version of
        // window.open() and we can't find a better way to register the source
        // and destination before the request is made. This should be able to be
        // removed if we can find a better solution for the allowed popup case.
        if (aContext && aContext.nodeName == "xul:browser" && aContext.currentURI
            && aContext.currentURI.spec == "about:blank") {
          return this
              .accept(
                  "New window (should probably only be an allowed popup's initial request)",
                  args, true);
        }

        // XMLHttpRequests made within chrome's context have these origins.
        // Greasemonkey uses such a method to provide their cross-site xhr.
        if (origin == "resource://gre/res/hiddenWindow.html" ||
            origin == "resource://gre-resources/hiddenWindow.html") {
          return this.accept(
              "Privileged request (possibly a cross-site XMLHttpRequest)",
              args, true);
        }

        for (var i = 0; i < this._compatibilityRules.length; i++) {
          var rule = this._compatibilityRules[i];
          var allowOrigin = rule[0] ? origin.indexOf(rule[0]) == 0 : true;
          var allowDest = rule[1] ? dest.indexOf(rule[1]) == 0 : true;
          if (allowOrigin && allowDest) {
            return this.accept(
                "Extension/application compatibility rule matched [" + rule[2]
                    + "]", args, true);
          }
        }

        // If the destination has a mapping (i.e. it was originally a different
        // destination but was changed into the current one), accept this
        // request if the original destination would have been accepted.
        // Check aExtra against CP_MAPPEDDESTINATION to stop further recursion.
        if (aExtra != CP_MAPPEDDESTINATION && this._mappedDestinations[dest]) {
          for (var mappedDest in this._mappedDestinations[dest]) {
            var mappedDestUriObj = this._mappedDestinations[dest][mappedDest];
            requestpolicy.mod.Logger.warning(
                requestpolicy.mod.Logger.TYPE_CONTENT,
                "Checking mapped destination: " + mappedDest);
            var mappedResult = this.shouldLoad(aContentType, mappedDestUriObj,
                aRequestOrigin, aContext, aMimeTypeGuess, CP_MAPPEDDESTINATION);
            if (mappedResult == CP_OK) {
              return CP_OK;
            }
          }
        }

        // We didn't match any of the conditions in which to allow the request,
        // so reject it.
        return aExtra == CP_MAPPEDDESTINATION ? CP_REJECT :
            this.reject("hosts don't match", args);

      } catch (e) {
        requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
            "Fatal Error, " + e + ", stack was: " + e.stack);
        requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_CONTENT,
            "Rejecting request due to internal error.");
        return this._blockingDisabled ? CP_OK : CP_REJECT;
      }

    } // end shouldLoad

  } // end mainContentPolicy

  // /////////////////////////////////////////////////////////////////////////
  // end nsIContentPolicy interface
  // /////////////////////////////////////////////////////////////////////////
};

/**
 * XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
 * XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
 */
if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([RequestPolicyService]);
else
  var NSGetModule = XPCOMUtils.generateNSGetModule([RequestPolicyService]);
