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

/* global Components */
const {interfaces: Ci, utils: Cu} = Components;

/* exported PrefBranch */
this.EXPORTED_SYMBOLS = ["PrefBranch"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

//==============================================================================
// PrefBranch
//==============================================================================

/**
 * @param {string} aBranchRoot
 * @param {Object} aPrefNameToTypeMap A map from Pref Names to Pref Types.
 *     Pref Types are "BoolPref", "CharPref", "IntPref", "ComplexValue".
 */
function PrefBranch(aBranchRoot, aPrefNameToTypeMap) {
  this.branchRoot = aBranchRoot;
  this.branch = Services.prefs.getBranch(aBranchRoot).
      QueryInterface(Ci.nsIPrefBranch2);

  // How should a pref name "foo.bar.baz" be translated to
  // "getBoolPref" or "setIntPref"?
  this._namesToTypesMap = aPrefNameToTypeMap;
}

PrefBranch.prototype._type = function(aPrefName) {
  return this._namesToTypesMap[aPrefName];
};

PrefBranch.prototype.get = function(aPrefName) {
  let getterFnName = "get" + this._type(aPrefName);
  return this.branch[getterFnName](aPrefName);
};

PrefBranch.prototype.set = function(aPrefName, aValue) {
  let setterFnName = "set" + this._type(aPrefName);
  return this.branch[setterFnName](aPrefName, aValue);
};

PrefBranch.prototype.reset = function(aPrefName) {
  this.branch.clearUserPref(aPrefName);
};

PrefBranch.prototype.isSet = function(aPrefName) {
  return this.branch.prefHasUserValue(aPrefName);
};

PrefBranch.prototype.addObserver = function(aDomain, aObserver, aHoldWeak) {
  return this.branch.addObserver(aDomain, aObserver, aHoldWeak);
};

PrefBranch.prototype.removeObserver = function(aDomain, aObserver) {
  return this.branch.removeObserver(aDomain, aObserver);
};
