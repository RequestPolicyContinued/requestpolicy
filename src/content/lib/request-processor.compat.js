/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

Cu.import("resource://gre/modules/AddonManager.jsm");

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/logger",
  "lib/utils",
  "lib/environment"
], this);



let RequestProcessor = (function(self) {
  let internal = Utils.moduleInternal(self);


  let conflictingExtensions = [];
  let compatibilityRules = [];
  let topLevelDocTranslationRules = {};

  // TODO: update compatibility rules etc. when addons are enabled/disabled
  let addonListener = {
    onDisabling : function(addon, needsRestart) {},
    onUninstalling : function(addon, needsRestart) {},
    onOperationCancelled : function(addon, needsRestart) {}
  };

  function init() {
    // Detect other installed extensions and the current application and do
    // what is needed to allow their requests.
    initializeExtensionCompatibility();
    initializeApplicationCompatibility();

    AddonManager.addAddonListener(addonListener);
  }

  // stop observers / listeners
  function cleanup() {
    AddonManager.removeAddonListener(addonListener);
  }

  ProcessEnvironment.addStartupFunction(Environment.LEVELS.BACKEND, init);
  ProcessEnvironment.addShutdownFunction(Environment.LEVELS.BACKEND, cleanup);


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
        topLevelDocTranslationRules[orig] = translated;
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




  self.getCompatibilityRules = function() {
    return compatibilityRules;
  };

  self.getConflictingExtensions = function() {
    return conflictingExtensions;
  };

  self.getTopLevelDocTranslation = function(uri) {
    // We're not sure if the array will be fully populated during init. This
    // is especially a concern given the async addon manager API in Firefox 4.
    return topLevelDocTranslationRules[uri] || null;
  };

  return self;
}(RequestProcessor || {}));
