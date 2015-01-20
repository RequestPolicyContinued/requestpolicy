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

let EXPORTED_SYMBOLS = ["EnvironmentManager"];

let globalScope = this;

Cu.import("resource://gre/modules/Services.jsm");
//Cu.import("resource://gre/modules/devtools/Console.jsm");


/**
 * EnvironmentManager is one of the central modules relevant for the
 * extension's bootstrapping process. However, this is documented elsewhere,
 * possibly in the developer wiki.
 */
let EnvironmentManager = (function(self) {

  // determine if this is the main process
  self.isMainProcess = (function isMainProcess() {
    let xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    // The "default" type means that we're on the main process, the chrome process.
    // This is relevant for multiprocessor firefox aka Electrolysis (e10s).
    return xulRuntime.processType === xulRuntime.PROCESS_TYPE_DEFAULT;
  }());

  let procString = (self.isMainProcess ? "parent" : "child") + " process";

  //console.debug("[RPC] creating new EnvironmentManager (" + procString + ")");


  self.environments = new Set();

  self.registerEnvironment = function(aEnv) {
    self.environments.add(aEnv);
  };
  self.unregisterEnvironment = function(aEnv) {
    self.environments.delete(aEnv);
  };


  // Ensure that `doStartupTasks` and `doShutdownTasks` exist. They can be
  // overwritten.
  self.doStartupTasks = self.doStartupTasks || function() {};
  self.doShutdownTasks = self.doShutdownTasks || function() {};


  /**
   */
  self.startup = function() {
    //console.debug("[RPC] EnvironmentManager ("+procString+") is going to " +
    //              "start up the Process Environment...");
    self.doStartupTasks();

    // on startup, only the Process Environment is started.
    Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
    ScriptLoader.importModule("lib/process-environment")
        .ProcessEnvironment.startup();
  };

  self.shutdown = function(fnArgsToApply) {
    // remove the comments in this function for debugging.
    //console.debug("[RPC] EnvironmentManager ("+procString+") is going to " +
    //              "shut down all registered Environments...");
    //if (self.isMainProcess) {
    //  // only group in the main process -- some loggings of the child process
    //  // might not reach the parent. In case the `groupEnd()` does not reach
    //  // the parent, the Group will live for the whole browser session!
    //  console.group();
    //}

    Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
    let {Environment} = ScriptLoader.importModule("lib/environment");
    let sequence = Environment.shutdownSequence;

    // prepare shutdown
    self.environments.forEach(function(env) {
      env.envState = Environment.SHUTTING_DOWN;
    });
    // shut down
    Environment.iterateShutdownLevels(function (level) {
      //console.debug("[RPC] reaching level "+level+" ...");
      self.environments.forEach(function(env) {
        env.callShutdownFunctions(level, fnArgsToApply);
      });
    });
    // finishing tasks
    self.environments.forEach(function(env) {
      env.envState = Environment.SHUT_DOWN;
      self.unregisterEnvironment(env);
    });

    // final tasks
    //console.debug("[RPC] reaching level 0 ...");
    self.doShutdownTasks();

    // remove the references to all environments
    self.environments = new Set();

    //console.debug("[RPC] EnvironmentManager ("+procString+") finished " +
    //              "shutting down all registered Environments.");
    //if (self.isMainProcess) {
    //  console.groupEnd();
    //}
  };

  return self;
}(EnvironmentManager || {}));


// load parent- or child-specific parts
let subScriptURI = EnvironmentManager.isMainProcess === true ?
    "chrome://requestpolicy/content/main/environment-manager-parent.js" :
    "chrome://requestpolicy/content/main/environment-manager-child.js";
Services.scriptloader.loadSubScriptWithOptions(subScriptURI,
                                               {/*ignoreCache: true*/});
