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

let {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm", {});

const rpPrefBranch = Services.prefs.getBranch("extensions.requestpolicy.").
      QueryInterface(Ci.nsIPrefBranch2);

//==============================================================================
// utilities
//==============================================================================

const log = {
  error: function(message, error) {
    console.error("[API] " + message);
    if (error) {
      console.dir(error);
    }
  }
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

//==============================================================================
// API
//==============================================================================

export var Api = {
  browser: {
    extension: {},
    management: {},
    runtime: {
      onMessage: {}
    },
    storage: {
      local: {},
      onChanged: {},
    },
  },
};

export var ContentScriptsApi = {
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

//==============================================================================
// browser.extension
//==============================================================================

(function() {
  let backgroundPage = null;

  Api._setBackgroundPage = function(aObject) {
    backgroundPage = aObject;
  };

  Api.browser.extension.getBackgroundPage = function() {
    return backgroundPage;
  };
}());

//==============================================================================
// browser.management
//==============================================================================

(function() {
  const MANAGEMENT_EVENTS = Object.freeze([
    "onEnabled",
    "onDisabled",
    "onInstalled",
    "onUninstalled",
  ]);

  let managementListeners = {};
  for (let event of MANAGEMENT_EVENTS) {
    managementListeners[event] = new Set();
  }

  function onAddonListenerEvent(aEvent, aAddon) {
    managementListeners[aEvent].forEach(listener => {
      listener.call(null, aAddon);
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

  /**
   * @param {Addon} aAddon
   * @return {ExtensionInfo}
   */
  function getExtensionInfo(aAddon) {
    let {
      id,
      isActive: enabled,
      name,
      version,
    } = aAddon;

    return {
      enabled,
      id,
      name,
      version,
    };
  }

  Api.browser.management.get = function(aId) {
    let p = new Promise((resolve, reject) => {
      AddonManager.getAddonByID(aId, addon => {
        try {
          if (addon) {
            resolve(getExtensionInfo(addon));
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
            then(addons => addons.map(getExtensionInfo));
    promiseCatch(pExtensionInfo, "browser.management.getAll");
    return pExtensionInfo;
  };

  Api.browser.management.getSelf =
      Api.browser.management.get.bind(null, "/* @echo EXTENSION_ID */");

  function addManagementListener(aEvent, aListener) {
    managementListeners[aEvent].add(aListener);
  }
  function removeManagementListener(aEvent, aListener) {
    managementListeners[aEvent].delete(aListener);
  }

  MANAGEMENT_EVENTS.forEach(aEvent => {
    Api.browser.management[aEvent] = {
      addListener: addManagementListener.bind(null, aEvent),
      removeListener: removeManagementListener.bind(null, aEvent),
    };
  });
}());

//==============================================================================
// browser.runtime
//==============================================================================

(function() {
  Api.browser.runtime.getBrowserInfo = function() {
    let {name, vendor, version, appBuildID: buildID} = Services.appinfo;
    return Promise.resolve({name, vendor, version, buildID});
  };

  const listeners = {
    backgroundPage: {
      onMessage: new Set(),
    },
  };

  Api.browser.runtime.onMessage.addListener = function(aListener) {
    listeners.backgroundPage.onMessage.add(aListener);
  };

  Api.browser.runtime.onMessage.removeListener = function(aListener) {
    listeners.backgroundPage.onMessage.delete(aListener);
  };

  Api.browser.runtime.onMessage.hasListener = function(aListener) {
    return listeners.backgroundPage.onMessage.has(aListener);
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
}());

//==============================================================================
// browser.storage
//==============================================================================

(function() {
  Api.browser.storage.local.get = function(aKeys) {
    let results = {};
    ["log", "log.level"].
        filter(prefName => prefName in aKeys).
        forEach(prefName => {
          results[prefName] = rpPrefBranch.getBoolPref(prefName);
        });
    return Promise.resolve(results);
  };

  Api.browser.storage.local.set = function() {
  };

  Api.browser.storage.onChanged._listeners = new Set();

  Api.browser.storage.onChanged.addListener = function(aListener) {
    Api.browser.storage.onChanged._listeners.add(aListener);
  };

  Api.browser.storage.onChanged.removeListener = function(aListener) {
    Api.browser.storage.onChanged._listeners.delete(aListener);
  };

  Api.browser.storage.onChanged.hasListener = function(aListener) {
    return Api.browser.storage.onChanged._listeners.has(aListener);
  };
}());
