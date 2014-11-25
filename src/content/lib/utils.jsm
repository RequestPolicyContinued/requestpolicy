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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["Utils"];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules(["prefs", "constants"], this);





let Utils = (function() {
  // private variables and functions

  let self = {};

  XPCOMUtils.defineLazyGetter(self, "strbundle", function() {
    return loadPropertiesFile(
        "chrome://requestpolicy/locale/requestpolicy.properties");
  });
  // from https://developer.mozilla.org/en-US/Add-ons/
  // How_to_convert_an_overlay_extension_to_restartless
  // #Step_10.3A_Bypass_cache_when_loading_properties_files
  function loadPropertiesFile(path)
  {
    /* HACK: The string bundle cache is cleared on addon shutdown, however it
     * doesn't appear to do so reliably. Errors can erratically happen on next
     * load of the same file in certain instances. (at minimum, when strings are
     * added/removed) The apparently accepted solution to reliably load new
     * versions is to always create bundles with a unique URL so as to bypass the
     * cache. This is accomplished by passing a random number in a parameter after
     * a '?'. (this random ID is otherwise ignored) The loaded string bundle is
     * still cached on startup and should still be cleared out of the cache on
     * addon shutdown. This just bypasses the built-in cache for repeated loads of
     * the same path so that a newly installed update loads cleanly. */
    return Services.strings.createBundle(path + "?" + Math.random());
  }


  /**
   * (taken from Adblock Plus, see
   *  https://hg.adblockplus.org/adblockplus/file/0d76ad7eb80b/lib/utils.js)
   * Posts an action to the event queue of the current thread to run it
   * asynchronously. Any additional parameters to this function are passed
   * as parameters to the callback.
   */
  self.runAsync = function(/**Function*/ callback, /**Object*/ thisPtr) {
    let params = Array.prototype.slice.call(arguments, 2);
    let runnable = {
      run: function() {
        callback.apply(thisPtr, params);
      }
    };
    self.threadManager.currentThread.dispatch(runnable,
        Ci.nsIEventTarget.DISPATCH_NORMAL);
  };
  XPCOMUtils.defineLazyServiceGetter(self, "categoryManager",
      "@mozilla.org/categorymanager;1", "nsICategoryManager");
  XPCOMUtils.defineLazyServiceGetter(self, "threadManager",
      "@mozilla.org/thread-manager;1", "nsIThreadManager");




  self.info = {};

  // get/set last/current RP version
  {
    self.info.lastRPVersion = Prefs.prefs.getCharPref("lastVersion");

    self.info.curRPVersion = "0.0";
    // curRPVersion needs to be set asynchronously
    AddonManager.getAddonByID(EXTENSION_ID, function(addon) {
      Prefs.prefs.setCharPref("lastVersion", addon.version);
      self.info.curRPVersion = addon.version;
      if (self.info.lastRPVersion != self.info.curRPVersion) {
        Services.prefs.savePrefFile(null);
      }
    });
  }

  // get/set last/current app (e.g. firefox) version
  {
    self.info.lastAppVersion = Prefs.prefs.getCharPref("lastAppVersion");

    let curAppVersion = Services.appinfo.version;
    self.info.curAppVersion = curAppVersion;
    Prefs.prefs.setCharPref("lastAppVersion", curAppVersion);

    if (self.info.lastAppVersion != self.info.curAppVersion) {
      Services.prefs.savePrefFile(null);
    }
  }

  self.info.isFirefox = Services.appinfo.ID == FIREFOX_ID;
  self.info.isAustralis = self.info.isFirefox &&
      Services.vc.compare(Services.appinfo.platformVersion, '29') >= 0;

  self.getChromeWindow = function(aContentWindow) {
    return aContentWindow.QueryInterface(CI.nsIInterfaceRequestor)
                         .getInterface(CI.nsIWebNavigation)
                         .QueryInterface(CI.nsIDocShellTreeItem)
                         .rootTreeItem
                         .QueryInterface(CI.nsIInterfaceRequestor)
                         .getInterface(CI.nsIDOMWindow);
  };

  return self;
}());
