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

let EXPORTED_SYMBOLS = ["ProcessEnvironment", "Environment"];

Cu.import("resource://gre/modules/Services.jsm");

let globalScope = this;
let scriptLoaderURI = "chrome://requestpolicy/content/lib/script-loader.jsm";


// In the main process this module is the first one to be loaded and the last to
// be unloded. So this file defines what is done on the extension's startup.
// These are the steps for the main process:
//  1. the script loader is loaded *manually* (!)
//  2. the module containing the Environment class is loaded
//  3. create a new ProcessEnvironment (the Main Process Environment)
//  4. define the startup function
//     --> It loads all essential modules.
//         This implicitely and recursively loads all other modules.
//  5. define the shutdown function
//     5.1. As the ScriptLoader must not load any of RP's modules, its
//          Main Process shutdown function will be called from here.
//     5.2. As this the ScriptLoader has been loaded manually, it has to be
//          unloded manually as well!


// =======================================
// Step 1: Manually load the ScriptLoader.
// ---------------------------------------
// ( If this is the main process, it has to be unaloded manually as well! The
//   shutdown function is defined below. )
Cu.import(scriptLoaderURI, globalScope);
// =======================================


// =======================================
// Step 2: load the Environment class
// ----------------------------------
ScriptLoader.importModule("lib/environment", globalScope);
// =======================================


// =======================================
// Step 3: create a new Environment
// --------------------------------
let ProcessEnvironment = new Environment();
// =======================================


// determine if this is the main process
ProcessEnvironment.isMainProcess = (function isMainProcess() {
  let xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
  // The "default" type means that we're on the main process, the chrome process.
  // This is relevant for multiprocessor firefox aka Electrolysis (e10s).
  return xulRuntime.processType === xulRuntime.PROCESS_TYPE_DEFAULT;
}());



if (ProcessEnvironment.isMainProcess) {
  // The following startup functions should be defined only in the main process.

  // =======================================
  // Step 4: define the startup function
  // -----------------------------------
  /**
   * Import main modules on startup. This will be the first function that will
   * be called. It imports essential modules which depend recursively on other
   * modules. This means that when the second startup function is being called,
   * all modules will already be loaded.
   */
  ProcessEnvironment.enqueueStartupFunction(function() {
    // Import essential modules. Dependencies will be imported as well.
    //
    // IMPORTANT note:
    //     Those modules have to be imported in a startup-function and NOT at
    //     the time the `ProcessEnvironment` module itself is being loaded.
    // In detail:
    //     `ProcessEnvironment.enqueueStartupFunction()` is called by many
    //     modules at load-time. If those modules would be loaded when
    //     `process-environment.jsm` wasn't already loaded completely, the
    //     `ProcessEnvironment` wouldn't be available. This would be an
    //     "import()-loop".
    // Illustration:
    //     bootstrap.js  calls  load(ProcessEnvironment)
    //         ProcessEnvironment  calls  load(moduleXY)
    //             moduleXY  calls  load(ProcessEnvironment)
    //                 ProcessEnvironment says "You can't load me, I didn't
    //                 finish yet!"
    {
      // =======================================================================
      // The following section is not optimal – read on…
      // -----------------------------------------------

      // load init PrefManager before anything else is loaded!
      // the reason is that the Logger expects the prefs to be initialized
      // and available already.
      let {PrefManager} = ScriptLoader.importModule("main/pref-manager");
      PrefManager.init();

      // TODO: use the Browser Console for logging, see #563.
      //       *Then* it's no longer necessary to load and init PrefManager
      //       first. PrefManager will then be loaded and initialized when all
      //       other back end modules are loaded / initialized.

      // import the Logger as the first module so that its startup-function
      // will be called after this one
      ScriptLoader.importModule("lib/logger", globalScope);
      // =======================================================================

      // import main modules:
      ScriptLoader.importModules([
        "main/requestpolicy-service",
        "lib/content-policy",
        "main/window-manager",
        "main/about-uri"
      ], globalScope);
    }
  });
  // =======================================


  // =======================================
  // Step 5: define the shutdown function
  // ------------------------------------
  ProcessEnvironment.pushShutdownFunction(function() {
    // HACK WARNING: The Addon Manager does not properly clear all addon
    //               related caches on update; in order to fully update
    //               images and locales, their caches need clearing here.
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);


    // Step 5.1: call ScriptLoader's Main Process shutdown functions
    ScriptLoader.unloadAllLibraries();
    ScriptLoader.unloadAllModules();

    // Step 5.2: manually unload the ScriptLoader
    Cu.unload(scriptLoaderURI);
  });
  // =======================================
}
