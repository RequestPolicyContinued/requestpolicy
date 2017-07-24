/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RPC Dev Helper - A helper add-on for RequestPolicy development.
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

/* exported startup, shutdown, install, uninstall */

/* global Components */
const {utils: Cu} = Components;

//==============================================================================
// utilities
//==============================================================================

function getModules() {
  return [
    {
      uri: "chrome://rpc-dev-helper/content/dump.jsm",
      name: "Dump"
    }, {
      uri: "chrome://rpc-dev-helper/content/rpc-uri.jsm",
      name: "CustomUri"
    }
  ];
}

function callBootstrapFn(uri, moduleName, fnName) {
  Cu.import(uri, {})[moduleName][fnName]();
}

//==============================================================================
// bootstrap functions
//==============================================================================

function startup(data, reason) {
  for (let {uri, name} of getModules()) {
    callBootstrapFn(uri, name, "startup");
  }
}

function shutdown(data, reason) {
  for (let {uri, name} of getModules().reverse()) {
    callBootstrapFn(uri, name, "shutdown");
    Cu.unload(uri);
  }
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
