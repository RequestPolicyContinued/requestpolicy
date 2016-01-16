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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;


function startup(data, reason) {
  Cu.import("chrome://rpc-dev-helper/content/console-observer.jsm");
  ConsoleObserver.startup();
  Cu.import("chrome://rpc-dev-helper/content/logging-observer.jsm");
  LoggingObserver.startup();
  Cu.import("chrome://rpc-dev-helper/content/rpc-uri.jsm");
  CustomUri.startup();
}

function shutdown(data, reason) {
  CustomUri.shutdown();
  Cu.unload("chrome://rpc-dev-helper/content/rpc-uri.jsm");
  LoggingObserver.shutdown();
  Cu.unload("chrome://rpc-dev-helper/content/logging-observer.jsm");
  ConsoleObserver.shutdown();
  Cu.unload("chrome://rpc-dev-helper/content/console-observer.jsm");
}

function install(data, reason) {
}

function uninstall(data, reason) {
}
