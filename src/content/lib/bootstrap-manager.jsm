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

let EXPORTED_SYMBOLS = ["BootstrapManager"];

Cu.import("resource://gre/modules/Services.jsm");

let globalScope = this;
let scriptLoaderURI = "chrome://requestpolicy/content/lib/script-loader.jsm";
let ScriptLoader = null;
let Logger = null;
let rpService = null;
let WindowManager = null;
// TODO: implement. see https://github.com/RequestPolicyContinued/requestpolicy/issues/486
//let SevereErrorHandler = {};




let BootstrapManager = (function() {
  let self = {};

  let managers = {
    // id     :   object name of the manager
    'requestpolicy-service': 'rpService',
    'window-manager': 'rpWindowManager',
    'about-uri': 'AboutRequestPolicy'
  };

  //let startupFunctions = [];
  //let shutdownFunctions = [];

  /**
   * this function calls another function with functionName
   */
  function callBootstrapFunction(managerID, functionName, data, reason) {
    let scope = {};
    let managerName = managers[managerID];
    //let manager = ScriptLoader.require(managerID)[managerName];
    //let manager = ScriptLoader.importModule(managerID, scope)[managerName];
    let manager = globalScope[managerName];

    // if manager (e.g. "rpService") doesn't exist or doesn't have the function to be
    // called, just skip without an error
    if (manager && manager[functionName] &&
        (typeof manager[functionName]) == 'function') {
      manager[functionName](data, reason);
    }
  };
  function forEachManager(functionToCall, args) {
    for (let managerID in managers) {
      if (!managers.hasOwnProperty(managerID)) {
        continue;
      }
      try {
        let functionArgs = [managerID].concat(args);
        functionToCall.apply(null, functionArgs);
      } catch (e) {
        Logger.severeError("error catched in bootstrap script: " + e, e);
      }
    }
  };







  function importScriptLoader() {
    Cu.import(scriptLoaderURI, globalScope);
  }

  function init() {
    importScriptLoader();
    ScriptLoader.importModule("logger", globalScope);
    ScriptLoader.importModule("requestpolicy-service", globalScope);
    ScriptLoader.importModule("window-manager", globalScope);
    ScriptLoader.importModule("about-uri", globalScope);
  }

  function finish() {
    // HACK WARNING: The Addon Manager does not properly clear all addon
    //               related caches on update; in order to fully update
    //               images and locales, their caches need clearing here.
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);

    ScriptLoader.unloadAllLibraries();
    ScriptLoader.unloadAllModules();

    Cu.unload(scriptLoaderURI);
    ScriptLoader = null;
    Logger = null;
    rpService = null;
    WindowManager = null;
  }

  function startupManagers(data, reason) {
    // call the startup function of all managers
    forEachManager(callBootstrapFunction, ['startup', data, reason]);
  }

  function shutdownManagers(data, reason) {
    forEachManager(callBootstrapFunction, ['shutdown', data, reason]);
  }



  self.startup = function(data, reason) {
    init();
    startupManagers(data, reason);
  };

  self.shutdown = function(data, reason) {
    shutdownManagers(data, reason);
    finish();
  };

  return self;
}());
