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

import {Storage as StorageClass} from "content/lib/classes/storage";

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
