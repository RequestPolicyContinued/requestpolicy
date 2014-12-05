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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

const bootstrapManagerURI = "chrome://requestpolicy/content/lib/" +
    "bootstrap-manager.jsm";


function startup(data, reason) {
  // if the Browser Toolbox is open when enabling RP, stop here.
  // uncomment to enable this functionality.
  // see also https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger
  //debugger;

  try {
    Cu.import(bootstrapManagerURI);
    BootstrapManager.init();
    BootstrapManager.startupManagers(data, reason);
  } catch(e) {
    let msg = "startup() failed! " + e;
    dump("[RequestPolicy] [SEVERE] [ERROR] " + msg +
        (e.stack ? ", stack was: " + e.stack : ""));
  }
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }

  try {
    BootstrapManager.shutdownManagers(data, reason);
    BootstrapManager.finish();
    Cu.unload(bootstrapManagerURI);
  } catch(e) {
    let msg = "shutdown() failed! " + e;
    dump("[RequestPolicy] [SEVERE] [ERROR] " + msg +
        (e.stack ? ", stack was: " + e.stack : ""));
  }
}

function install(data, reason) {
  // do not call managers, as the addon might be not activated
}

function uninstall(data, reason) {
  // do not call managers, as the addon might be not activated
}
