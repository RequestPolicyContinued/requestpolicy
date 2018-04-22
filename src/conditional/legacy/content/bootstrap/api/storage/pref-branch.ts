/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2015 Martin Kimmerle
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

import { API, JSMs, XPCOM } from "bootstrap/api/interfaces";

export type PrefType = "Bool" | "Char" | "Int";

export interface IPrefNamesToTypes {
  [key: string]: PrefType;
}

export class PrefBranch implements API.storage.IPrefBranch {
  private static PREF_INVALID = 0;
  private static PREF_STRING = 32;
  private static PREF_INT = 64;
  private static PREF_BOOL = 128;

  public readonly branch = this.prefsService.getBranch(this.branchRoot).
      QueryInterface<XPCOM.nsIPrefBranch2>(this.ci.nsIPrefBranch2);

  constructor(
      private ci: XPCOM.nsXPCComponents_Interfaces,
      private prefsService: JSMs.Services["prefs"],
      private xpcService: API.IXPConnectService,
      public readonly branchRoot: string,
  ) {}

  public getAll() {
    const allPrefs: {[key: string]: any} = {};
    const childList = this.prefsService.getChildList("");
    childList.forEach((prefName) => {
      allPrefs[prefName] = this.get(prefName);
    });
    return allPrefs;
  }

  public get(
      aPrefName: string,
  ): string | number | boolean | undefined {
    if (!this.isSet(aPrefName)) return undefined;
    const type = this.branch.getPrefType(aPrefName);
    switch (type) {
      case PrefBranch.PREF_STRING:
        return this.branch.getComplexValue<XPCOM.nsISupportsString>(
            aPrefName, this.ci.nsISupportsString,
        ).data;
      case PrefBranch.PREF_INT:
        return this.branch.getIntPref(aPrefName);
      case PrefBranch.PREF_BOOL:
        return this.branch.getBoolPref(aPrefName);

      case PrefBranch.PREF_INVALID: /* falls through */
      default:
        throw new Error(`Unknown type <${type}> of pref "${aPrefName}"`);
    }
  }

  public set<T extends string | number | boolean>(
      aPrefName: string,
      aValue: T,
  ): void {
    const type = typeof aValue;
    switch (type) {
      case "string":
        const str = this.xpcService.createSupportsStringInstance();
        str.data = aValue as string;
        this.branch.setComplexValue(aPrefName, this.ci.nsISupportsString, str);
        break;
      case "number":
        this.branch.setIntPref(aPrefName, aValue as number);
        break;
      case "boolean":
        this.branch.setBoolPref(aPrefName, aValue as boolean);
        break;

      default:
        throw new Error(`Invalid type <${type}>. Value is "${aValue}".`);
    }
  }

  public reset(aPrefName: string) {
    this.branch.clearUserPref(aPrefName);
  }

  public isSet(aPrefName: string) {
    return this.branch.prefHasUserValue(aPrefName);
  }

  public addObserver(
      aDomain: string,
      aObserver: XPCOM.nsIObserver_without_nsISupports,
      aHoldWeak?: boolean,
  ) {
    return this.branch.addObserver(aDomain, aObserver, !!aHoldWeak);
  }

  public removeObserver(
      aDomain: string,
      aObserver: XPCOM.nsIObserver_without_nsISupports,
  ) {
    return this.branch.removeObserver(aDomain, aObserver);
  }
}
