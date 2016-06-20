/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2016 Martin Kimmerle
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
const {utils: Cu} = Components;

/* exported rpService */
this.EXPORTED_SYMBOLS = ["RPService2"];

// NOTICE: This file should NOT import any of RP's modules when it is loaded!
//         This module will be the new "root module", being the only module
//         imported by bootstrap.js.
let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
let {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

//==============================================================================
// RPService2
//==============================================================================

var RPService2 = (function() {
  let self = {};

  XPCOMUtils.defineLazyGetter(self, "console", function() {
    if (self.info.isGeckoVersionAtLeast("44")) {
      return Cu.import("resource://gre/modules/Console.jsm", {}).console;
    } else {
      return Cu.import("resource://gre/modules/devtools/Console.jsm", {}).
          console;
    }
  });

  return self;
}());

RPService2.info = (function() {
  let self = {};

  let {name: appName, platformVersion} = Services.appinfo;
  self.isGecko = appName !== "Pale Moon";

  self.isGeckoVersionAtLeast = function(aMinVersion) {
    return self.isGecko &&
        Services.vc.compare(platformVersion, aMinVersion) >= 0;
  };

  return self;
}());
