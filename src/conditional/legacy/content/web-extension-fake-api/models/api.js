/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

import * as Utils from "content/web-extension-fake-api/lib/utils/webext-utils";
import {Bootstrap} from "content/web-extension-fake-api/models/bootstrap";
import {Manifest} from "content/web-extension-fake-api/models/manifest";
import {Prefs} from "content/web-extension-fake-api/models/prefs";

let {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm", {});

// =============================================================================
// utilities
// =============================================================================

const log = {
  error: function(message, error) {
    console.error("[API] " + message);
    if (error) {
      console.dir(error);
    }
  },
};

function genErrorCallback(message) {
  return log.error.bind(null, message);
}

function promiseCatch(promise, message) {
  return promise.catch(genErrorCallback(message));
}

function genNewPromise(promiseExecutor, onErrorMessage) {
  let p = new Promise(promiseExecutor);
  promiseCatch(p, onErrorMessage);
  return p;
}

function manifestHasPermission(perm) {
  return Manifest.permissions.includes(perm);
}

// =============================================================================
// API
// =============================================================================

export const Api = {
  browser: {
    extension: {},
    management: {},
    runtime: {},
    storage: {
      local: {},
    },
  },
  LegacyApi: {
    storage: {},
  },
};

export const ContentScriptsApi = {
  browser: {
    extension: {
      getURL: null,
      inIncognitoContext: null,
    },
    runtime: {
      connect: null,
      getManifest: null,
      getURL: null,
      onConnect: null,
      onMessage: null,
      sendMessage: null,
    },
    i18n: {
      getMessage: null,
      getAcceptLanguages: null,
      getUILanguage: null,
      detectLanguage: null,
    },
    storage: Api.browser.storage,
  },
};

// =============================================================================
// browser.extension
// =============================================================================

(function() {
  let backgroundPage = null;

  Api._setBackgroundPage = function(aObject) {
    backgroundPage = aObject;
  };

  Api.browser.extension.getBackgroundPage = function() {
    return backgroundPage;
  };
})();

// =============================================================================
// browser.management
// =============================================================================

(function() {
  if (!manifestHasPermission("management")) {
    return;
  }

  // ---------------------------------------------------------------------------
  // utils
  // ---------------------------------------------------------------------------

  /**
   * @param {Addon} aAddon
   * @return {ExtensionInfo}
   */
  function mapAddonInfoToWebextExtensionInfo(aAddon) {
    let {
      id,
      isActive: enabled,
      name,
      version,
    } = aAddon;

    return Object.freeze({
      enabled,
      id,
      name,
      version,
    });
  }

  // ---------------------------------------------------------------------------
  // onEnabled, onDisabled, onInstalled, onUninstalled
  // ---------------------------------------------------------------------------

  const MANAGEMENT_EVENTS = Object.freeze([
    "onEnabled",
    "onDisabled",
    "onInstalled",
    "onUninstalled",
  ]);

  const managementListeners = Utils.
      createWebextOnEventApi(Api.browser.management, MANAGEMENT_EVENTS);

  function mapAddonListenerCallbackToManagementEventName(aCallbackName) {
    switch (aCallbackName) {
      case "onEnabled": return "onEnabled";
      case "onDisabled": return "onDisabled";
      case "onInstalled": return "onInstalled";
      case "onUninstalled": return "onUninstalled";
      // eslint-disable-next-line no-throw-literal
      default: throw `Unhandled callback name "${aCallbackName}".`;
    }
  }

  function onAddonListenerEvent(aALCallbackName, aAddon) {
    let webextEventName =
        mapAddonListenerCallbackToManagementEventName(aALCallbackName);
    let extensionInfo = mapAddonInfoToWebextExtensionInfo(aAddon);
    managementListeners[webextEventName].forEach(listener => {
      listener.call(null, extensionInfo);
    });
  }

  let addonListener = {};
  MANAGEMENT_EVENTS.forEach(aEvent => {
    addonListener[aEvent] = onAddonListenerEvent.bind(null, aEvent);
  });

  Bootstrap.onStartup(() => {
    AddonManager.addAddonListener(addonListener);
  });
  Bootstrap.onShutdown(() => {
    AddonManager.removeAddonListener(addonListener);
  });

  // ---------------------------------------------------------------------------
  // get(), getAll(), getSelf()
  // ---------------------------------------------------------------------------

  Api.browser.management.get = function(aId) {
    let p = new Promise((resolve, reject) => {
      AddonManager.getAddonByID(aId, addon => {
        try {
          if (addon) {
            resolve(mapAddonInfoToWebextExtensionInfo(addon));
          } else {
            reject();
          }
        } catch (e) {
          console.error("browser.management.get()");
          console.dir(e);
          reject(e);
        }
      });
    });
    p.catch(e => {
      if (!e) {
        // the extension does not exist
        return;
      }
      log.error("browser.management.get", e);
    });
    return p;
  };

  Api.browser.management.getAll = function() {
    let pExtensionInfo =
        (new Promise(resolve => AddonManager.getAllAddons(resolve))).
            then(addons => addons.map(mapAddonInfoToWebextExtensionInfo));
    promiseCatch(pExtensionInfo, "browser.management.getAll");
    return pExtensionInfo;
  };

  Api.browser.management.getSelf =
      Api.browser.management.get.bind(null, "/* @echo EXTENSION_ID */");
})();

// =============================================================================
// browser.runtime
// =============================================================================

(function() {
  Api.browser.runtime.getBrowserInfo = function() {
    let {name, vendor, version, appBuildID: buildID} = Services.appinfo;
    return Promise.resolve({name, vendor, version, buildID});
  };

  /**
   * Map a relative path to manifest.json to a legacy path (XUL/XPCOM).
   * All paths pointing to a html file in /content/settings/ are mapped into
   * about:requestpolicy?, other paths are mapped into chrome://rpcontinued/ :
   *  - /content/settings/filename.html will become about:requestpolicy?filename
   *  - /foo/bar.file.css will become chrome://rpcontinued/foo/bar.file.css
   * Leading / or ./ are ignored and the path is case sensitive.
   *
   * @param {string} path
   * @return {string}
   */
  Api.browser.runtime.getURL = function(path) {
    // Pattern to match mapping into about:requestpolicy?file
    // 1) ^(?:\.\/|\/)? : matches even if path starts with "content/"
    // or "./content"
    // 2) content\/settings\/ : checks path (case sensitive)
    // 3) ([^\/]+) : capturing group for the filename
    // 4) \.[hH][tT][mM][lL]$ : matches html extension (case insensitive)
    // Disable max-length line lint on this one because using new RegExp
    // to split it isn't recommended if the pattern doesn't change
    // eslint-disable-next-line max-len
    let patternAbout = /^(?:\.\/|\/)?content\/settings\/([^/]+)\.[hH][tT][mM][lL]$/mg;

    // Pattern to match prepending with chrome://rpcontinued/
    // 1) ^(?:\.\/|\/)? : non capturing group for leading "/" or "./"
    let patternChrome = /^(?:\.\/|\/)?(.+)$/mg;

    let legacyPath = null;

    if (patternAbout.test(path)) {
      legacyPath = path.replace(patternAbout, "about:requestpolicy?$1");
    } else {
      legacyPath = path.replace(patternChrome, "chrome://rpcontinued/$1");
    }

    return legacyPath;
  };

  const listeners = {
    backgroundPage: Utils.createWebextOnEventApi(
        Api.browser.runtime, ["onMessage"]),
  };

  ContentScriptsApi.browser.runtime.sendMessage = function(aMessage) {
    return genNewPromise((resolve, reject) => {
      let response;
      const callback = (aResponse) => {
        response = aResponse;
      };
      for (let listener of listeners.backgroundPage.onMessage) {
        const rv = listener(aMessage, null, callback);
        if (response !== undefined) {
          resolve(response);
          return;
        }
        if (rv !== undefined) {
          // ...
        }
      }
    }, "browser.runtime.sendMessage");
  };
})();

// =============================================================================
// browser.storage
// =============================================================================

(function() {
  if (!manifestHasPermission("storage")) {
    return;
  }

  /* let onStorageChangedListener = */ Utils.
      createWebextOnEventApi(Api.browser.storage, ["onChanged"]);

  // ---------------------------------------------------------------------------
  // get(), set()
  // ---------------------------------------------------------------------------

  Api.browser.storage.local.get = function(aKeys) {
    if (typeof aKeys === "string") {
      return Promise.resolve(Prefs.get(aKeys));
    }
    let keys;
    if (Array.isArray(aKeys)) {
      keys = aKeys;
    } else if (typeof aKeys === "object") {
      keys = Object.keys(aKeys);
    } else {
      keys = Prefs.ALL_KEYS;
    }
    let results = {};
    keys.forEach(key => {
      results[key] = Prefs.get(key);
    });
    return Promise.resolve(results);
  };

  Api.browser.storage.local.set = function(aKeys) {
    if (typeof aKeys !== "object") {
      let msg = "browser.storage.local.set(): aKeys must be an object!";
      log.error(msg, aKeys);
      return Promise.reject(new Error(msg));
    }
    Object.keys(aKeys).forEach(key => {
      Prefs.set(key, aKeys[key]);
    });
    Prefs.save();
    return Promise.resolve();
  };

  Api.LegacyApi.prefs = Prefs;
})();
