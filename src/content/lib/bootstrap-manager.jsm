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
// TODO: implement. see https://github.com/RequestPolicyContinued/requestpolicy/issues/486
//let SevereErrorHandler = {};



let BootstrapManager = (function() {
  let self = {};


  let startupFunctionStack = [];
  let shutdownFunctionStack = [];
  //let installFunctionStack = [];
  //let uninstallFunctionStack = [];

  /**
   * The functions in one of the arrays above will be called. Not that the list
   * itself might get even more entries while it is being called; therefore
   * pop() is used.
   */
  let callBootstrapFunctions = function(functions, data, reason) {
    // pop the topmost function as long as there is one.
    //
    // The combination of push() and pop() leads to FILO (first in, last out)
    // for the shutdown process. In other words, it's a stack
    for (let f = functions.pop(); !!f; f = functions.pop()) {
      f(data, reason);
    }
  };
  let callStartupFunctions = callBootstrapFunctions.bind(this, startupFunctionStack);
  let callShutdownFunctions = callBootstrapFunctions.bind(this, shutdownFunctionStack);
  //let callInstallFunctions = callBootstrapFunctions.bind(this, installFunctionStack);
  //let callUninstallFunctions = callBootstrapFunctions.bind(this, uninstallFunctionStack);

  /**
   * This set of functions can be used for adding startup/shutdown functions.
   * Note: the first startup function to be executed will import all modules so
   * that all subsequent startup-functions get called *after* all modules have
   * been loaded.
   */
  let registerFunction = function(target, f) {
    target.push(f);
  };
  self.registerStartupFunction = registerFunction.bind(this, startupFunctionStack);
  self.registerShutdownFunction = registerFunction.bind(this, shutdownFunctionStack);
  //self.registerInstallFunction = registerFunction.bind(this, installFunctionStack);
  //self.registerUninstallFunction = registerFunction.bind(this, uninstallFunctionStack);



  /**
   * Import main modules on startup. This will be the first function that will
   * be called, and as the modules depend on all other modules recursively, all
   * modules will be loaded already when the second startup function gets
   * called.
   */
  self.registerStartupFunction(function() {
    // Manually load the ScriptLoader. It has to be unloded manually as well!
    Cu.import(scriptLoaderURI, globalScope);

    // Next, import essential modules. Dependencies will be imported as well.
    //
    // It's IMPORTANT that those modules are imported in a startup-function
    // and NOT when BootstrapManager itself gets loaded. The reason is that many
    // modules call `BootstrapManager.registerStartupFunction()` at load-time,
    // which wouldn't be available if BootstrapManager is *itself* still being
    // loaded. This would be an "import()-loop".
    {
      // import the Logger first so that its startup-function will be called
      // after this one
      ScriptLoader.importModule("logger");
      ScriptLoader.importModules(["requestpolicy-service", "window-manager",
                                  "about-uri"], globalScope);
    }
  });

  self.registerShutdownFunction(function() {
    // HACK WARNING: The Addon Manager does not properly clear all addon
    //               related caches on update; in order to fully update
    //               images and locales, their caches need clearing here.
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);

    // manually unload the ScriptLoader
    Cu.unload(scriptLoaderURI);
  });



  // when startup() and shutdown() are called, simply call all
  self.startup = callStartupFunctions.bind(this);
  self.shutdown = callShutdownFunctions.bind(this);

  return self;
}());
