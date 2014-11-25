// see https://developer.mozilla.org/en-US/Add-ons/Bootstrapped_extensions
// #Bootstrap_entry_points

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

let globalScope = this;
let scriptLoaderURI = "chrome://requestpolicy/content/lib/script-loader.jsm";
let ScriptLoader = null;
let Logger = null;
let rpService = null;
let WindowManager = null;
// TODO: implement. see https://github.com/RequestPolicyContinued/requestpolicy/issues/486
//let SevereErrorHandler = {};


let bootstrapper = (function() {
  let managers = {
    // id     :   object name of the manager
    'requestpolicy-service': 'rpService',
    'window-manager': 'rpWindowManager'
  };

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
  }
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
  }





  let self = {

    importScriptLoader: function() {
      Cu.import(scriptLoaderURI, globalScope);
    },

    init: function() {
      self.importScriptLoader();
      ScriptLoader.importModule("logger", globalScope);
      ScriptLoader.importModule("requestpolicy-service", globalScope);
      ScriptLoader.importModule("window-manager", globalScope);
    },

    finish: function() {
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
    },

    startupManagers: function(data, reason) {
      // call the startup function of all managers
      forEachManager(callBootstrapFunction, ['startup', data, reason]);
    },

    shutdownManagers: function(data, reason) {
      forEachManager(callBootstrapFunction, ['shutdown', data, reason]);
    }
  };

  return self;
}());




function startup(data, reason) {
  // if the Browser Toolbox is open when enabling RP, stop here.
  // uncomment to enable this functionality.
  // see also https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger
  //debugger;

  try {
    bootstrapper.init();
    bootstrapper.startupManagers(data, reason);
  } catch(e) {
    let msg = "startup() failed! " + e;
    if (Logger) {
      Logger.severeError(msg, e);
    } else {
      dump("[RequestPolicy] [SEVERE] [ERROR] " + msg +
          (e.stack ? ", stack was: " + e.stack : ""));
    }
  }
}
function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }

  try {
    bootstrapper.shutdownManagers(data, reason);
    bootstrapper.finish();
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
