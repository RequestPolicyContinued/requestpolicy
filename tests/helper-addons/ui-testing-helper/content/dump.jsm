/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RPC Dev Helper - A helper add-on for RequestPolicy development.
 * Copyright (c) 2017 Martin Kimmerle
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

/* global Components, dump */
const {utils: Cu} = Components;

/* exported Dump */
this.EXPORTED_SYMBOLS = ["Dump"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

// =============================================================================
// Dump
// =============================================================================

var Dump = (function() {
  let self = {};

  const topic = "requestpolicy-dump-string";

  self.startup = function() {
    Services.obs.addObserver(self, topic, false);
  };

  self.shutdown = function() {
    Services.obs.removeObserver(self, topic);
  };

  self.observe = function(aSubject, aTopic, aData) {
    dump(aData + "\n");
  };

  return self;
}());
