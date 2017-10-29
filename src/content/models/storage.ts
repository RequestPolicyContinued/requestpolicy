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

declare const LegacyApi: any;

// =============================================================================
// Storage class
// =============================================================================

export class StorageClass {
  public readonly alias: {[a: string]: (...keys: any[]) => any} = {};
  public pReady: Promise<void>;
  private cachedKeys: string[];
  private cachedKeysSet: Set<string>;

  constructor({
      cachedKeys,
      boolAliases,
  }: {
      cachedKeys: string[],
      boolAliases: Array<[string, string]>,
  }) {
    this.cachedKeys = cachedKeys;
    this.cachedKeysSet = new Set(cachedKeys);

    boolAliases.forEach(([storageKey, alias]) => {
      this.alias[`is${alias}`] = () => this.get(storageKey);
      this.alias[`set${alias}`] = (value) => this.set({[storageKey]: value});
    });

    this.pReady = Promise.resolve();
  }

  public isKeyCached(aKey: string) {
    return this.cachedKeysSet.has(aKey);
  }

  public get(aKeys: "" | string | string[] | null | undefined): any {
    if (aKeys === "") return {};
    if (aKeys === null || aKeys === undefined) {
      return this.get(this.cachedKeys);
    }
    if (typeof aKeys === "string") {
      const key = aKeys;
      if (!this.isKeyCached(key)) {
        console.error(`Key "${key} is not cached in Storage!`);
        return;
      }
      return LegacyApi.prefs.get(key);
    }
    if (Array.isArray(aKeys)) {
      const result: {[key: string]: any} = {};
      aKeys.forEach((key) => {
        result[key] = LegacyApi.prefs.get(key);
      });
      return result;
    }
    console.error();
  }

  public set(aKeys: {[key: string]: any}) {
    try {
      Object.keys(aKeys).forEach((key) => {
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
  }
}

// =============================================================================
// Storage
// =============================================================================

export const Storage = new StorageClass({
  boolAliases: [
    ["defaultPolicy.allow", "DefaultAllow"],
    ["defaultPolicy.allowSameDomain", "DefaultAllowSameDomain"],
    ["defaultPolicy.allowTopLevel", "DefaultAllowTopLevel"],
    ["startWithAllowAllEnabled", "BlockingDisabled"],
  ],
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
});
