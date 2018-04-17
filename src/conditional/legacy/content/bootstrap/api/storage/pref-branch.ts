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

import { JSMs, XPCOM } from "bootstrap/api/interfaces";

declare const Ci: XPCOM.nsXPCComponents_Interfaces;

export type PrefType = "BoolPref" | "CharPref" | "IntPref";
type GetterFnName = "getBoolPref" | "getCharPref" | "getIntPref";
type SetterFnName = "setBoolPref" | "setCharPref" | "setIntPref";

export interface IPrefNamesToTypes {
  [key: string]: PrefType;
}

export interface IPrefBranchSpec {
  branchRoot: string;
  namesToTypes: IPrefNamesToTypes;
}

/**
 * @param {string} aBranchRoot
 * @param {Object} aPrefNameToTypeMap A map from Pref Names to Pref Types.
 *     Pref Types are "BoolPref", "CharPref", "IntPref", "ComplexValue".
 */
export class PrefBranch {
  public readonly branch = this.prefsService.getBranch(this.branchRoot).
      QueryInterface<XPCOM.nsIPrefBranch2>(Ci.nsIPrefBranch2);

  constructor(
      private prefsService: JSMs.Services["prefs"],
      public readonly branchRoot: string,
      // How should a pref name "foo.bar.baz" be translated to
      // "getBoolPref" or "setIntPref"?
      private namesToTypesMap: IPrefNamesToTypes,
  ) {}

  public getAll() {
    const allPrefs: {[key: string]: any} = {};
    Object.keys(this.namesToTypesMap).forEach((prefName) => {
      allPrefs[prefName] = this.get(prefName);
    });
    return allPrefs;
  }

  public get<T extends string | number | boolean>(
      aPrefName: string,
  ): T {
    const getterFnName = `get${this.type(aPrefName)}` as GetterFnName;
    return (
      this.branch[getterFnName] as
      (prefName: string) => T
    )(aPrefName);
  }

  // sorry for this very ugly-looking function
  public set<T extends string | number | boolean>(
      aPrefName: string,
      aValue: T,
  ): void {
    const setterFnName = `set${this.type(aPrefName)}` as SetterFnName;
    (
      this.branch[setterFnName] as
      (prefName: string, value: T) => void
    )(aPrefName, aValue);
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

  private type(aPrefName: string): PrefType {
    if (!(aPrefName in this.namesToTypesMap)) {
      throw new Error(`Unknown pref "${aPrefName}"`);
    }
    return this.namesToTypesMap[aPrefName];
  }
}
