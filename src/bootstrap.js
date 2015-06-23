/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

var mod = {};
const envURI = "chrome://rpcontinued/content/lib/environment.jsm";

/**
 * If any Exception gets into bootstrap.js, it will be a severe error.
 * The Logger can't be used, as it might not be available.
 */
function logSevereError(msg, e) {
  dump("[RequestPolicy] [SEVERE] [ERROR] " + msg + " " + e +
       (e.stack ? ", stack was: " + e.stack : "") + "\n");
  Cu.reportError(e);
}

function startup(data, reason) {
  try {
    // Import the ProcessEnvironment and call its startup() function.
    Cu.import(envURI, mod);
    mod.ProcessEnvironment.startup(arguments);
  } catch(e) {
    logSevereError("startup() failed!", e);
  }
}

function shutdown(data, reason) {

  try {
    // shutdown, unset and unload.
    mod.ProcessEnvironment.shutdown(arguments);
    mod = {};
    Cu.unload(envURI);
  } catch(e) {
    logSevereError("shutdown() failed!", e);
  }
}

function install(data, reason) {
  // note: the addon might be not activated when this function gets called

  // HACK WARNING: The Addon Manager does not properly clear all addon
  //               related caches on update; in order to fully update
  //               images and locales, their caches are flushed.
  // Note: Due to Bug 1144248 this has to be done in the
  //       `install` function.
  Components.utils.import("resource://gre/modules/Services.jsm");
  Services.obs.notifyObservers(null, "chrome-flush-caches", null);
}

function uninstall(data, reason) {
  // note: the addon might be not activated when this function gets called
}
