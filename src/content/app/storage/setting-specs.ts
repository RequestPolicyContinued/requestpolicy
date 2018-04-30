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

const boolAliases: Array<[string, string]> = [
  ["defaultPolicy.allow", "DefaultAllow"],
  ["defaultPolicy.allowSameDomain", "DefaultAllowSameDomain"],
  ["defaultPolicy.allowTopLevel", "DefaultAllowTopLevel"],
  ["startWithAllowAllEnabled", "BlockingDisabled"],
];

type tDefaultValue = boolean | number | string;

const keys: {
  [key: string]: {
    cached: boolean,
    defaultValue?: tDefaultValue,
  },
} = {
  "autoReload": {
    cached: true, defaultValue: true,
  },
  "browserSettings.disableNetworkPrediction": {
    cached: true, defaultValue: true,
  },
  "confirmSiteInfo": {
    cached: true, defaultValue: true,
  },
  "contextMenu": {
    cached: true, defaultValue: true,
  },
  "defaultPolicy.allow": {
    cached: true, defaultValue: false,
  },
  "defaultPolicy.allowSameDomain": {
    cached: true, defaultValue: true,
  },
  "defaultPolicy.allowTopLevel": {
    cached: true, defaultValue: false,
  },
  "indicateBlacklistedObjects": {
    cached: true, defaultValue: false,
  },
  "indicateBlockedObjects": {
    cached: true, defaultValue: true,
  },
  "keyboardShortcuts.openMenu.combo": {
    cached: true, defaultValue: "default",
  },
  "keyboardShortcuts.openMenu.enabled": {
    cached: true, defaultValue: true,
  },
  "keyboardShortcuts.openRequestLog.combo": {
    cached: true, defaultValue: "default",
  },
  "keyboardShortcuts.openRequestLog.enabled": {
    cached: true, defaultValue: true,
  },
  "lastAppVersion": {
    cached: true, defaultValue: "0.0",
  },
  "lastVersion": {
    cached: true, defaultValue: "0.0",
  },
  "log": {
    cached: true, defaultValue: false,
  },
  "log.level": {
    cached: true, defaultValue: 0,
  },
  "menu.info.showNumRequests": {
    cached: true, defaultValue: true,
  },
  "menu.sorting": {
    cached: true, defaultValue: "numRequests",
  },
  "privateBrowsingPermanentWhitelisting": {
    cached: true, defaultValue: false,
  },
  "startWithAllowAllEnabled": {
    cached: true, defaultValue: false,
  },
  "welcomeWindowShown": {
    cached: true, defaultValue: false,
  },

  // @if BUILD_ALIAS='ui-testing'
  // tslint:disable-next-line:object-literal-sort-keys
  "unitTesting.consoleErrors.counter": {cached: true},
  "unitTesting.loggingErrors.counter": {cached: true},
  // @endif
};

const cachedKeys: string[] = [];
const defaultValues: {[key: string]: tDefaultValue} = {};

Object.keys(keys).forEach((key) => {
  const spec = keys[key];
  if (spec.cached) cachedKeys.push(key);
  if (spec.hasOwnProperty("defaultValue")) {
    defaultValues[key] = spec.defaultValue!;
  }
});

export const SETTING_SPECS = {
  boolAliases,
  cachedKeys,
  defaultValues,
};
