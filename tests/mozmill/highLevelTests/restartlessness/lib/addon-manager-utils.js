/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with self
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var addons = require(rootDir + "lib/addons");
var modalDialog = require(rootDir + "lib/modal-dialog");
var prefs = require(rootDir + "lib/prefs");
var tabs = require(rootDir + "firefox/lib/tabs");

var rpUtils = require(rpRootDir + "lib/rp-utils");



const PREF_INSTALL_DIALOG = "security.dialog_enable_delay";
const PREF_NEW_CONFIRMATION_UI = "xpinstall.customConfirmationUI";

const INSTALL_DIALOG_DELAY = 1000;
const TIMEOUT_DOWNLOAD = 25000;


function AMHelper(aController, aAddonsManager) {
  var self = this;
  self.controller = aController;
  self.addonsManager = aAddonsManager;
  self.tabBrowser = new tabs.tabBrowser(self.controller);
}


AMHelper.prototype.onSetupModule = function(aModule) {
  var self = this;
  prefs.setPref(PREF_INSTALL_DIALOG, INSTALL_DIALOG_DELAY);
  addons.setDiscoveryPaneURL("about:home");
  prefs.setPref(PREF_NEW_CONFIRMATION_UI, false);
};

AMHelper.prototype.onSetupTest = function(aModule) {
  var self = this;
}

AMHelper.prototype.onTeardownTest = function(aModule) {
  var self = this;
}

AMHelper.prototype.onTeardownModule = function(aModule) {
  var self = this;
  prefs.clearUserPref(PREF_INSTALL_DIALOG);
  addons.resetDiscoveryPaneURL();
  prefs.clearUserPref(PREF_NEW_CONFIRMATION_UI);
}



AMHelper.prototype.forEachTab = function(callback) {
  var self = this;
  for (let i = 0, len = self.tabBrowser.length; i < len; ++i) {
    let tab = self.tabBrowser.getTab(i);
    callback(tab, i);
  }
}

AMHelper.prototype.forEachTabReverse = function(callback) {
  var self = this;
  for (let i = self.tabBrowser.length - 1; i >= 0; --i) {
    let tab = self.tabBrowser.getTab(i);
    callback(tab, i);
  }
}

AMHelper.prototype.findTabIndex = function(callback) {
  var self = this;
  var tabIndex;

  try {
    self.forEachTab(function(tab, index) {
      if (callback.apply(null, arguments) === true) {
        tabIndex = index;
        throw "found";
      }
    });
  } catch (e if e === "found") {
    return tabIndex;
  }

  return -1;
}

AMHelper.prototype.getTabHref = function(tab) {
  var self = this;
  return tab.getNode().linkedBrowser.contentWindow.location.href;
}

AMHelper.prototype.openAddonManager = function() {
  var self = this;
  var tabIndex = self.findTabIndex(function(tab) {
    return self.getTabHref(tab) === "about:addons";
  });

  if (tabIndex === -1) {
    self.addonsManager.open();
  }
}

AMHelper.prototype.openOnlyAddonManager = function() {
  var self = this;
  // Note: Sometimes when open() is called, open() needs
  //       several seconds to finish. This is because there is no
  //       "TabOpen" event in `tabBrowser._waitForTabOpened()`.
  //
  //       More specifically, self happens when
  //         (a) the addon manager is already opened
  //         (b) there is only one tab opened, which is `about:blank`
  self.openAddonManager();

  // close all tabs except `about:addons`.
  // iterate frome high indexes to low indexes.
  self.forEachTabReverse(function(tab, index) {
    if (self.getTabHref(tab) !== "about:addons") {
      self.tabBrowser.closeTab({method: "middleClick", index: index});
    }
  });

  assert.equal(self.tabBrowser.length, 1, "There is only one tab left.");
}

AMHelper.prototype.getAddon = function() {
  var self = this;
  var addonList = self.addonsManager.getAddons({attribute: "value",
                                               value: rpConst.ADDON_ID});
  return addonList.length === 0 ? null : addonList[0];
}

AMHelper.prototype.getSetupTabIndex = function() {
  var self = this;
  return self.findTabIndex(function(tab) {
    return self.getTabHref(tab) === "about:requestpolicy?setup";
  });
}


AMHelper.prototype.installAddon = function(xpiUrl) {
  var self = this;
  assert.ok(xpiUrl, "The XPI's URL has been specified.");
  var md = new modalDialog.modalDialog(self.addonsManager.controller.window);

  // Install the add-on
  md.start(addons.handleInstallAddonDialog);
  self.controller.open(xpiUrl);
  md.waitForDialog(TIMEOUT_DOWNLOAD);
}


exports.AMHelper = AMHelper;
