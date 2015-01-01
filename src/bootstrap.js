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

const bootstrapManagerURI = "chrome://requestpolicy/content/lib/" +
    "bootstrap-manager.jsm";

/**
 * If any Exception gets into bootstrap.js, it will be a severe error.
 * The Logger can't be used, as it might not be available.
 */
function logSevereError(msg, stack) {
  dump("[RequestPolicy] [SEVERE] [ERROR] " + msg +
       (stack ? ", stack was: " + stack : ""));
}

function startup(data, reason) {
  // if the Browser Toolbox is open when enabling RP, stop here.
  // uncomment to enable this functionality.
  // see also https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger
  //debugger;

  try {
    // Import the BootstrapManager and call its startup() function, that's all
    // what has to be done here.
    // It is IMPORTANT that BootstrapManager is the FIRST module that is
    // imported! The reason is that many modules call
    // `BootstrapManager.registerStartupFunction()` at **load-time**, so
    // BootstrapManager has to be available.
    Cu.import(bootstrapManagerURI);
    BootstrapManager.startup(data, reason);
  } catch(e) {
    logSevereError("startup() failed! " + e, e.stack);
  }
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }

  try {
    BootstrapManager.shutdown(data, reason);
    Cu.unload(bootstrapManagerURI);
  } catch(e) {
    logSevereError("shutdown() failed! " + e, e.stack);
  }
}

function install(data, reason) {
  // note: the addon might be not activated when this function gets called
}

function uninstall(data, reason) {
  // note: the addon might be not activated when this function gets called
}
