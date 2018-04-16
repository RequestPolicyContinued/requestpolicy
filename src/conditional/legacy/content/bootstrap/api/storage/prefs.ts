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

import { API, JSMs } from "bootstrap/api/interfaces";

// =============================================================================
// Prefs
// =============================================================================

export class Prefs {
  public branches = {
    root: this.prefBranchFactory("", {
      "network.dns.disablePrefetch": "BoolPref",
      "network.dns.disablePrefetchFromHTTPS": "BoolPref",
      "network.http.speculative-parallel-limit": "IntPref",
      "network.prefetch-next": "BoolPref",
    }),

    rp: this.prefBranchFactory("extensions.requestpolicy.", {
      "autoReload": "BoolPref",
      "confirmSiteInfo": "BoolPref",
      "contextMenu": "BoolPref",
      "defaultPolicy.allow": "BoolPref",
      "defaultPolicy.allowSameDomain": "BoolPref",
      "defaultPolicy.allowTopLevel": "BoolPref",
      "indicateBlacklistedObjects": "BoolPref",
      "indicateBlockedObjects": "BoolPref",
      "keyboardShortcuts.openMenu.combo": "CharPref",
      "keyboardShortcuts.openMenu.enabled": "BoolPref",
      "keyboardShortcuts.openRequestLog.combo": "CharPref",
      "keyboardShortcuts.openRequestLog.enabled": "BoolPref",
      "lastAppVersion": "CharPref",
      "lastVersion": "CharPref",
      "log": "BoolPref",
      "log.level": "IntPref",
      "menu.info.showNumRequests": "BoolPref",
      "menu.sorting": "CharPref",
      "prefetch.dns.disableOnStartup": "BoolPref",
      "prefetch.dns.restoreDefaultOnUninstall": "BoolPref",
      "prefetch.link.disableOnStartup": "BoolPref",
      "prefetch.link.restoreDefaultOnUninstall": "BoolPref",
      "prefetch.preconnections.disableOnStartup": "BoolPref",
      "prefetch.preconnections.restoreDefaultOnUninstall": "BoolPref",
      "privateBrowsingPermanentWhitelisting": "BoolPref",
      "startWithAllowAllEnabled": "BoolPref",
      "welcomeWindowShown": "BoolPref",
    }),
  };

  constructor(
      private prefsService: JSMs.Services["prefs"],
      private prefBranchFactory: API.storage.PrefBranchFactory,
  ) {}

  public save() {
    this.prefsService.savePrefFile(null);
  }

  public get<T extends string | number | boolean>(aFakePrefName: string) {
    const {branch, name} = this.getBranchAndRealName(aFakePrefName);
    return branch.get<T>(name);
  }

  public set<T extends string | number | boolean>(
      aFakePrefName: string,
      aValue: T,
  ): void {
    const {branch, name} = this.getBranchAndRealName(aFakePrefName);
    return branch.set<T>(name, aValue);
  }

  public reset(aFakePrefName: string) {
    const {branch, name} = this.getBranchAndRealName(aFakePrefName);
    return branch.reset(name);
  }

  public isSet(aFakePrefName: string) {
    const {branch, name} = this.getBranchAndRealName(aFakePrefName);
    return branch.isSet(name);
  }

  // ---------------------------------------------------------------------------
  // Observer functions
  // ---------------------------------------------------------------------------

  /**
   * Notes about addObserver and removeObserver:
   *
   * The functions take fake domain names, but the actual observers
   * will get the "real" pref names / domain names. If translation
   * of names is needed, the two functions could be replaced by
   * "addListener" and "removeListener" functions. In other words,
   * the "domainsToObservers" object in "PrefObserver" could be moved
   * here, and "PrefObserver" would only manage the listeners per
   * environment.
   *
   * The addObserver and removeObserver functions are preixed with
   * an underscore because they shouldn't be used directly, only
   * by PrefObserver.
   */

  public _addObserver(
      aFakeDomain: string,
      aObserver: any,
      aHoldWeak?: boolean,
  ) {
    const {branch, name: domain} = this.getBranchAndRealName(aFakeDomain);
    return branch.addObserver(domain, aObserver, !!aHoldWeak);
  }

  public _removeObserver(aFakeDomain: string, aObserver: any) {
    const {branch, name: domain} = this.getBranchAndRealName(aFakeDomain);
    return branch.removeObserver(domain, aObserver);
  }

  // ===========================================================================
  // Helper functions
  // ===========================================================================

  /**
   * Translate an alias into a real prefName, and also return the branch.
   *
   * Valid "fake pref names" are:
   *   - "root/ network.prefetch-next" (root pref branch)
   *   - "welcomeWindowShown" (RequestPolicy pref branch)
   */
  private getBranchAndRealName(aFakePrefName: string) {
    if (aFakePrefName.startsWith("root/ ")) {
      return {
        branch: this.branches.root,
        name: aFakePrefName.slice(6),
      };
    }
    return {
      branch: this.branches.rp,
      name: aFakePrefName,
    };
  }
}
