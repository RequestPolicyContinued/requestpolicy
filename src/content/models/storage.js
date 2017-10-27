/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

// =============================================================================
// Storage class
// =============================================================================

export function StorageClass({cachedKeys, boolAliases}) {
  this._cachedKeys = Object.freeze(cachedKeys);
  this._cachedKeysSet = Object.freeze(new Set(cachedKeys));

  boolAliases.forEach(([storageKey, alias]) => {
    this[`is${alias}`] = () => this.get(storageKey);
    this[`set${alias}`] = (value) => this.set({[storageKey]: value});
  });
}

StorageClass.prototype.isKeyCached = function(aKey) {
  return this._cachedKeysSet.has(aKey);
};

StorageClass.prototype.get = function(aKeys) {
  if (typeof aKeys === "string") {
    let key = aKeys;
    if (!this.isKeyCached(key)) {
      console.error(`Key "${key} is not cached in Storage!`);
      return;
    }
    return LegacyApi.prefs.get(key);
  }
  if (!Array.isArray(aKeys)) {
    return aKeys.reduce((rv, key) => {
      rv[key] = LegacyApi.prefs.get(key);
      return rv;
    }, {});
  }
  return this.get(this._cachedKeys);
};

StorageClass.prototype.set = function(aKeys) {
  try {
    Object.keys(aKeys).forEach(key => {
      LegacyApi.prefs.set(key, aKeys[key]);
    });
    LegacyApi.prefs.save();
    return Promise.resolve();
  } catch (error) {
    console.error("Error when saving to storage! Details:");
    console.dir(aKeys);
    console.dir(error);
    return Promise.reject(error);
  }
};

// =============================================================================
// Storage
// =============================================================================

export const Storage = new StorageClass({
  cachedKeys: [
    "autoReload",
    "confirmSiteInfo",
    "contextMenu",
    "defaultPolicy.allow",
    "defaultPolicy.allowSameDomain",
    "defaultPolicy.allowTopLevel",
    "indicateBlacklistedObjects",
    "indicateBlockedObjects",
    "keyboardShortcuts.openMenu.enabled",
    "keyboardShortcuts.openMenu.combo",
    "keyboardShortcuts.openRequestLog.enabled",
    "keyboardShortcuts.openRequestLog.combo",
    "lastAppVersion",
    "lastVersion",
    "log",
    "log.level",
    "menu.info.showNumRequests",
    "menu.sorting",
    "prefetch.dns.disableOnStartup",
    "prefetch.dns.restoreDefaultOnUninstall",
    "prefetch.link.disableOnStartup",
    "prefetch.link.restoreDefaultOnUninstall",
    "prefetch.preconnections.disableOnStartup",
    "prefetch.preconnections.restoreDefaultOnUninstall",
    "privateBrowsingPermanentWhitelisting",
    "startWithAllowAllEnabled",
    "welcomeWindowShown",
    // @if BUILD_ALIAS='ui-testing'
    "unitTesting.consoleErrors.counter",
    "unitTesting.loggingErrors.counter",
    // @endif
  ],
  boolAliases: [
    ["defaultPolicy.allow", "DefaultAllow"],
    ["defaultPolicy.allowSameDomain", "DefaultAllowSameDomain"],
    ["defaultPolicy.allowTopLevel", "DefaultAllowTopLevel"],
    ["startWithAllowAllEnabled", "BlockingDisabled"],
  ],
});
