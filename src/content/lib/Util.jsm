/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

var EXPORTED_SYMBOLS = ["Util"];

const Ci = Components.interfaces;
const CC = Components.classes;

const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";

var Util = {
  _versionComparator : CC["@mozilla.org/xpcom/version-comparator;1"]
      .getService(Ci.nsIVersionComparator),

  appInfo : CC["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo),

  // These need to be set externally. Right now they're set from
  // RequestPolicyService._initVersionInfo().
  curVersion : "0.0",
  lastVersion : "0.0",
  lastAppVersion : "0.0",

  // This is initialized by calling Util.initCurAppVersion().
  curAppVersion : "0.0",

  initCurAppVersion : function() {
    this.curAppVersion = this.appInfo.version;
  },

  compareVersions : function(v1, v2) {
    return this._versionComparator.compare(v1, v2);
  },

  isFirefox : function() {
    return this.appInfo.ID == FIREFOX_ID;
  },

  getChromeWindow : function(aContentWindow) {
    return aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIWebNavigation)
                         .QueryInterface(Ci.nsIDocShellTreeItem)
                         .rootTreeItem
                         .QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIDOMWindow);
  }
}
