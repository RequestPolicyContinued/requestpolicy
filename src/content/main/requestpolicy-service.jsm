/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
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

/* global Components */
const {utils: Cu} = Components;

/* exported rpService */
this.EXPORTED_SYMBOLS = ["rpService"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
let {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {Logger} = importModule("lib/logger");
let {Prefs} = importModule("models/prefs");
let {PolicyManager} = importModule("lib/policy-manager");
let {UserSubscriptions, SUBSCRIPTION_UPDATED_TOPIC, SUBSCRIPTION_ADDED_TOPIC,
     SUBSCRIPTION_REMOVED_TOPIC} = importModule("lib/subscription");
let {Environment, ProcessEnvironment} = importModule("lib/environment");
let {WindowUtils} = importModule("lib/utils/windows");
let {Info} = importModule("lib/utils/info");

//==============================================================================
// rpService
//==============================================================================

var rpService = (function() {
  let self = {};

  //----------------------------------------------------------------------------
  // Internal Data
  //----------------------------------------------------------------------------

  let subscriptions = null;

  //----------------------------------------------------------------------------
  // Utility
  //----------------------------------------------------------------------------

  function loadConfigAndRules() {
    subscriptions = new UserSubscriptions();
    PolicyManager.loadUserRules();

    let failures = PolicyManager.loadSubscriptionRules(
        subscriptions.getSubscriptionInfo());
    // TODO: check a preference that indicates the last time we checked for
    // updates. Don't do it if we've done it too recently.
    // TODO: Maybe we should probably ship snapshot versions of the official
    // rulesets so that they can be available immediately after installation.
    let serials = {};
    for (let listName in failures) {
      serials[listName] = {};
      for (let subName in failures[listName]) {
        serials[listName][subName] = -1;
      }
    }
    var loadedSubs = PolicyManager.getSubscriptionRulesets();
    for (let listName in loadedSubs) {
      for (let subName in loadedSubs[listName]) {
        if (!serials[listName]) {
          serials[listName] = {};
        }
        let rawRuleset = loadedSubs[listName][subName].rawRuleset;
        serials[listName][subName] = rawRuleset._metadata.serial;
      }
    }
    function updateCompleted(result) {
      Logger.info(Logger.TYPE_INTERNAL,
          "Subscription updates completed: " + result);
    }
    subscriptions.update(updateCompleted, serials);
  }

  // TODO: move to window manager
  function maybeShowSetupTab() {
    if (!Prefs.get("welcomeWindowShown")) {
      var url = "about:requestpolicy?setup";

      let win = WindowUtils.getMostRecentBrowserWindow();
      if (win === null) {
        return;
      }
      let tabbrowser = win.getBrowser();
      if (typeof tabbrowser.addTab !== "function") {
        return;
      }

      if (Info.isRPUpgrade) {
        // If the use has just upgraded from an 0.x version, set the
        // default-policy preferences based on the old preferences.
        Prefs.set("defaultPolicy.allow", false);
        if (Prefs.isSet("uriIdentificationLevel")) {
          let identLevel = Prefs.get("uriIdentificationLevel");
          Prefs.set("defaultPolicy.allowSameDomain",
              identLevel === 1);
        }
        Services.prefs.savePrefFile(null);
      }

      tabbrowser.selectedTab = tabbrowser.addTab(url);

      Prefs.set("welcomeWindowShown", true);
      Services.prefs.savePrefFile(null);
    }
  }

  /**
   * Module for detecting installations of other RequestPolicy versions,
   * which have a different extension ID.
   */
  var DetectorForOtherInstallations = (function() {
    const NOTICE_URL = "chrome://rpcontinued/content/" +
        "multiple-installations.html";

    // The other extension IDs of RequestPolicy.
    var addonIDs = Object.freeze([
      // Detect the "original" add-on (v0.5; released on AMO).
      "requestpolicy@requestpolicy.com",
      // Detect "RPC Legacy" (v0.5; AMO version).
      "rpcontinued@requestpolicy.org",
      // #ifdef AMO
      // In the AMO version the non-AMO version needs to be detected.
      "rpcontinued@non-amo.requestpolicy.org",
      // #else
      // In the non-AMO version the AMO version needs to be detected.
      "rpcontinued@amo.requestpolicy.org",
      // #endif
    ]);

    var addonListener = {
      onEnabled: checkAddon,
      onInstalled: checkAddon
    };

    function checkAddon(addon) {
      for (let id of addonIDs) {
        if (addon.id === id) {
          openTab();
          return;
        }
      }
    }

    ProcessEnvironment.addStartupFunction(Environment.LEVELS.UI, function() {
      AddonManager.addAddonListener(addonListener);
    });

    ProcessEnvironment.addShutdownFunction(Environment.LEVELS.UI, function() {
      AddonManager.removeAddonListener(addonListener);
    });

    /**
     * Open the tab with the 'multiple installations' notice.
     *
     * @return {Boolean} whether opening the tab was successful
     */
    function openTab() {
      let win = WindowUtils.getMostRecentBrowserWindow();
      if (win === null) {
        return;
      }
      let tabbrowser = win.getBrowser();
      if (typeof tabbrowser.addTab !== "function") {
        return;
      }

      tabbrowser.selectedTab = tabbrowser.addTab(NOTICE_URL);

      return true;
    }

    function isAddonActive(addon) {
      if (addon === null) {
        return false;
      }

      return addon.isActive;
    }

    // On startup, the tab should be opened only once.
    var initialCheckDone = false;

    function addonListCallback(addons) {
      var activeAddons = addons.filter(isAddonActive);
      if (activeAddons.length === 0) {
        // no other RequestPolicy version is active
        return;
      }

      if (initialCheckDone === true) {
        return;
      }

      var rv = openTab();

      if (rv === true) {
        initialCheckDone = true;
      }
    }

    /**
     * Check if other RequestPolicy versions (with other extension IDs)
     * are installed. If so, a tab with a notice will be opened.
     */
    function maybeShowMultipleInstallationsWarning() {
      if (initialCheckDone === true) {
        return;
      }

      AddonManager.getAddonsByIDs(addonIDs, addonListCallback);
    }

    return {
      maybeShowMultipleInstallationsWarning:
          maybeShowMultipleInstallationsWarning
    };
  }());

  //----------------------------------------------------------------------------
  // startup and shutdown functions
  //----------------------------------------------------------------------------

  // prepare back-end
  ProcessEnvironment.addStartupFunction(Environment.LEVELS.BACKEND,
                                        loadConfigAndRules);

  function registerObservers() {
    ProcessEnvironment.obMan.observe([
      "sessionstore-windows-restored",
      SUBSCRIPTION_UPDATED_TOPIC,
      SUBSCRIPTION_ADDED_TOPIC,
      SUBSCRIPTION_REMOVED_TOPIC,

      // support for old browsers (Firefox <20)
      // TODO: support per-window temporary rules
      //       see https://github.com/RequestPolicyContinued/requestpolicy/issues/533#issuecomment-68851396
      "private-browsing"
    ], self.observe);
  }
  ProcessEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        registerObservers);

  ProcessEnvironment.addStartupFunction(
      Environment.LEVELS.UI,
      function(data, reason) {
        // In case of the app's startup and if they fail now, they
        // will be successful when they are called by the
        // "sessionstore-windows-restored" observer.
        maybeShowSetupTab();
        DetectorForOtherInstallations.maybeShowMultipleInstallationsWarning();
      });

  self.getSubscriptions = function() {
    return subscriptions;
  };

  //----------------------------------------------------------------------------
  // nsIObserver interface
  //----------------------------------------------------------------------------

  self.observe = function(subject, topic, data) {
    switch (topic) {

      // FIXME: The subscription logic should reside in the
      // subscription module.

      case SUBSCRIPTION_UPDATED_TOPIC: {
        Logger.debug(Logger.TYPE_INTERNAL, "XXX updated: " + data);
        // TODO: check if the subscription is enabled. The user might have
        // disabled it between the time the update started and when it
        // completed.
        let subInfo = JSON.parse(data);
        PolicyManager.loadSubscriptionRules(subInfo);
        break;
      }

      case SUBSCRIPTION_ADDED_TOPIC: {
        Logger.debug(Logger.TYPE_INTERNAL, "XXX added: " + data);
        let subInfo = JSON.parse(data);
        let failures = PolicyManager.loadSubscriptionRules(subInfo);
        let failed = Object.getOwnPropertyNames(failures).length > 0;
        if (failed) {
          let serials = {};
          for (let listName in subInfo) {
            if (!serials[listName]) {
              serials[listName] = {};
            }
            for (let subName in subInfo[listName]) {
              serials[listName][subName] = -1;
            }
          }
          let updateCompleted = function(result) {
            Logger.info(Logger.TYPE_INTERNAL,
                "Subscription update completed: " + result);
          };
          subscriptions.update(updateCompleted, serials);
        }
        break;
      }

      case SUBSCRIPTION_REMOVED_TOPIC: {
        Logger.debug(Logger.TYPE_INTERNAL, "YYY: " + data);
        let subInfo = JSON.parse(data);
        PolicyManager.unloadSubscriptionRules(subInfo);
        break;
      }

      case "sessionstore-windows-restored":
        maybeShowSetupTab();
        DetectorForOtherInstallations.maybeShowMultipleInstallationsWarning();
        break;

      // support for old browsers (Firefox <20)
      case "private-browsing":
        if (data === "exit") {
          PolicyManager.revokeTemporaryRules();
        }
        break;

      default:
        Logger.warning(Logger.TYPE_ERROR, "unknown topic observed: " + topic);
    }
  };

  return self;
}());
