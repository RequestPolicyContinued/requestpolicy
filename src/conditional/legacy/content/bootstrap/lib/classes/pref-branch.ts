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

declare const Ci: any;
declare const Services: any;

export type PrefTypes = "BoolPref" | "CharPref" | "IntPref";
type GetterFnName = "getBoolPref" | "getCharPref" | "getIntPref";
type SetterFnName = "setBoolPref" | "setCharPref" | "setIntPref";

// =============================================================================
// PrefBranch
// =============================================================================

/**
 * @param {string} aBranchRoot
 * @param {Object} aPrefNameToTypeMap A map from Pref Names to Pref Types.
 *     Pref Types are "BoolPref", "CharPref", "IntPref", "ComplexValue".
 */
export class PrefBranch {
  public readonly branch = Services.prefs.getBranch(this.branchRoot).
      QueryInterface(Ci.nsIPrefBranch2);

constructor(
    public readonly branchRoot: string,
    // How should a pref name "foo.bar.baz" be translated to
    // "getBoolPref" or "setIntPref"?
    private _namesToTypesMap: {[key: string]: PrefTypes},
) {}

private _type(aPrefName: string): PrefTypes {
  if (!(aPrefName in this._namesToTypesMap)) {
    throw new Error(`Unknown pref "${aPrefName}"`);
  }
  return this._namesToTypesMap[aPrefName];
}

// tslint:disable:member-ordering
public getAll() {
  return Object.keys(this._namesToTypesMap).
      map((prefName) => this.get(prefName));
}

public get<T extends string | number | boolean>(
    aPrefName: string,
): T {
  const getterFnName = `get${this._type(aPrefName)}` as GetterFnName;
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
  const setterFnName = `set${this._type(aPrefName)}` as SetterFnName;
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

public addObserver(aDomain: string, aObserver: any, aHoldWeak: boolean) {
  return this.branch.addObserver(aDomain, aObserver, aHoldWeak);
}

public removeObserver(aDomain: string, aObserver: any) {
  return this.branch.removeObserver(aDomain, aObserver);
}
}
