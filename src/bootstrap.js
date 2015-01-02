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

const procEnvURI = "chrome://requestpolicy/content/lib/" +
    "process-environment.jsm";

/**
 * If any Exception gets into bootstrap.js, it will be a severe error.
 * The Logger can't be used, as it might not be available.
 */
function logSevereError(msg, stack) {
  dump("[RequestPolicy] [SEVERE] [ERROR] " + msg +
       (stack ? ", stack was: " + stack : "") + "\n");
}

function startup(data, reason) {
  // if the Browser Toolbox is open when enabling RP, stop here.
  // uncomment to enable this functionality.
  // see also https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger
  //debugger;

  try {
    // Import the ProcessEnvironment and call its startup() function.
    // Note: It is IMPORTANT that ProcessEnvironment is the FIRST module to be
    //       imported! The reason is that many modules call
    //       `ProcessEnvironment.enqueueStartupFunction()` at *load-time*, so
    //       ProcessEnvironment has to be available.
    Cu.import(procEnvURI);
    ProcessEnvironment.startup(data, reason);
  } catch(e) {
    logSevereError("startup() failed! " + e, e.stack);
  }
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }

  try {
    // shutdown, unset and unload.
    ProcessEnvironment.shutdown(data, reason);
    ProcessEnvironment = null;
    Cu.unload(procEnvURI);
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
