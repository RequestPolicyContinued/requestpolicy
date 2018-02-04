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

import {createListenersMap} from "content/lib/utils/listener-factories";
import {PrefObserver} from "bootstrap/lib/classes/pref-observer";
import {Bootstrap} from "bootstrap/models/bootstrap";
import * as LegacyMiscInfos from "bootstrap/models/legacy-misc-infos";
import {Log} from "content/models/log";
import {Manifest} from "bootstrap/models/manifest";
import {Prefs} from "bootstrap/models/prefs";
import {StorageApi} from "bootstrap/models/storage-api";
import {Runtime, ContentRuntime} from "bootstrap/models/browser/runtime";
import {ContentI18n, I18n} from "bootstrap/models/browser/i18n";
import * as L10nUtils from "bootstrap/lib/utils/l10n-utils";

let {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm", {});

// =============================================================================
// utilities
// =============================================================================

const log = Log.instance.extend({name: "API"});

function genErrorCallback(message) {
  return log.error.bind(null, message);
}

function promiseCatch(promise, message) {
  return promise.catch(genErrorCallback(message));
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
    i18n: new I18n(),
    management: {},
    runtime: Runtime.instance,
    storage: StorageApi,
  },

  LegacyApi: {
    L10nUtils,
    miscInfos: LegacyMiscInfos,
    PrefObserver: PrefObserver,
    prefs: Prefs,
    storage: {},
  },

  get subModels() {
    return [
      Api.browser.i18n,
    ];
  },

  get whenReady() {
    return Promise.all(this.subModels.map(
        (model) => model.whenReady)
    );
  },

  init() {
    const p = Promise.all(this.subModels.map(
        (model) => model.init()
    ));
    p.catch((e) => {
      console.error("Api init() error:");
      console.dir(e);
    });
    return p;
  },
};

export const ContentScriptsApi = {
  browser: {
    extension: {
      getURL: null,
      inIncognitoContext: null,
    },
    runtime: ContentRuntime.instance,
    i18n: new ContentI18n(Api.browser.i18n),
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

  const managementEventListenersMap = {};
  createListenersMap(MANAGEMENT_EVENTS, {
    assignListenersTo: managementEventListenersMap,
    assignInterfacesTo: Api.browser.management,
  });

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
    managementEventListenersMap[webextEventName].emit(extensionInfo);
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
