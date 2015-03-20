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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["rpService"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/logger",
  "lib/prefs",
  "lib/utils/domains",
  "lib/policy-manager",
  "lib/subscription",
  "lib/utils",
  "lib/utils/constants",
  "lib/environment"
], this);



let rpService = (function() {
  let self = {};

  // /////////////////////////////////////////////////////////////////////////
  // Internal Data
  // /////////////////////////////////////////////////////////////////////////

  let subscriptions = null;


  // /////////////////////////////////////////////////////////////////////////
  // Utility
  // /////////////////////////////////////////////////////////////////////////


  function loadConfigAndRules() {
    subscriptions = new UserSubscriptions();
    PolicyManager.loadUserRules();

    var defaultPolicy = Prefs.isDefaultAllow() ? "allow" : "deny";

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

  // TODO: move to window manager
  function showWelcomeWindow() {
    if (!rpPrefBranch.getBoolPref("welcomeWindowShown")) {
      var url = "about:requestpolicy?setup";

      var wm = Cc['@mozilla.org/appshell/window-mediator;1'].
          getService(Ci.nsIWindowMediator);
      var windowtype = 'navigator:browser';
      var mostRecentWindow  = wm.getMostRecentWindow(windowtype);

      // the gBrowser object of the firefox window
      var _gBrowser = mostRecentWindow.getBrowser();

      if (typeof(_gBrowser.addTab) != "function") return;

      _gBrowser.selectedTab = _gBrowser.addTab(url);

      rpPrefBranch.setBoolPref("welcomeWindowShown", true);
      Services.prefs.savePrefFile(null);
    }
  }





  // /////////////////////////////////////////////////////////////////////////
  // startup and shutdown functions
  // /////////////////////////////////////////////////////////////////////////

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
        if (reason !== C.APP_STARTUP) {
          // In case of the app's startup `showWelcomeWindow()` will be
          // called when "sessionstore-windows-restored" is observed.
          showWelcomeWindow();
        }
      });





  self.getSubscriptions = function() {
    return subscriptions;
  };




  // /////////////////////////////////////////////////////////////////////////
  // nsIObserver interface
  // /////////////////////////////////////////////////////////////////////////

  self.observe = function(subject, topic, data) {
    switch (topic) {
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

      case "sessionstore-windows-restored":
        showWelcomeWindow();
        break;

      // support for old browsers (Firefox <20)
      case "private-browsing" :
        if (data == "exit") {
          PolicyManager.revokeTemporaryRules();
        }
        break;

      default :
        Logger.warning(Logger.TYPE_ERROR, "unknown topic observed: " + topic);
    }
  };

  return self;
}());
