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


// ProcessEnvironment is either a ParentProcessEnvironment or
// a ChildProcessEnvironment.
let ProcessEnvironment = (function() {


  // determine if this is the main process
  let isMainProcess = (function isMainProcess() {
    let xulRuntime = Cc["@mozilla.org/xre/app-info;1"]
        .getService(Ci.nsIXULRuntime);
    // The "default" type means that it's the main process,
    // the chrome process. This is relevant for multiprocess
    // firefox aka Electrolysis (e10s).
    return xulRuntime.processType === xulRuntime.PROCESS_TYPE_DEFAULT;
  }());


  const shutdownMessage = C.MM_PREFIX + "shutdown";

  /**
   * @constructor
   * @extends {Environment}
   * @param {string=} aName - the environment's name, passed to the superclass.
   */
  function ProcessEnvironmentBase(aName="Process Environment") {
    let self = this;

    // Process environments are the outermost environment in each process.
    let outerEnv = null;

    Environment.call(self, outerEnv, aName);

    self.isMainProcess = isMainProcess;
  }
  ProcessEnvironmentBase.prototype = Object.create(Environment.prototype);
  ProcessEnvironmentBase.prototype.constructor = Environment;




  /**
   * @constructor
   * @extends {ProcessEnvironmentBase}
   * @param {string=} aName - the environment's name, passed to the superclass.
   */
  function ParentProcessEnvironment(aName="Parent Process Environment") {
    let self = this;
    ProcessEnvironmentBase.call(self, aName);


    function sendShutdownMessageToChildren() {
      let parentMM = Cc["@mozilla.org/parentprocessmessagemanager;1"]
          .getService(Ci.nsIMessageBroadcaster);
      parentMM.broadcastAsyncMessage(shutdownMessage);
    };

    // Very important: The shutdown message must be sent *after*
    //     calling `removeDelayedFrameScript`, which is done in
    //     the LEVELS.INTERFACE level.
    self.addShutdownFunction(Environment.LEVELS.BACKEND,
                             sendShutdownMessageToChildren);
  }
  ParentProcessEnvironment.prototype = Object.create(ProcessEnvironmentBase.prototype);
  ParentProcessEnvironment.prototype.constructor = ProcessEnvironmentBase;



  /**
   * @override
   */
  ParentProcessEnvironment.prototype.startup = function() {
    let self = this;

    // Create a dummy scope for modules that have to be imported
    // but not remembered. As the scope is a local variable,
    // it will be removed after the function has finished.
    // However, the main modules register their startup and
    // shutdown functions anyway.
    let dummyScope = {};


    /**
     * The following section is not optimal – read on…
     */
    {
      // Load and init PrefManager before anything else is loaded!
      // The reason is that the Logger, which is imported by many modules,
      // expects the prefs to be initialized and available already.
      let {PrefManager} = ScriptLoader.importModule("main/pref-manager");
      PrefManager.init();

      // TODO: use the Browser Console for logging, see #563.
      //       *Then* it's no longer necessary to load and init PrefManager
      //       first. PrefManager will then be loaded and initialized when all
      //       other back end modules are loaded / initialized.
    }

    // import main modules:
    ScriptLoader.importModules([
      "main/requestpolicy-service",
      "main/content-policy",
      "main/window-manager",
      "main/about-uri"
    ], dummyScope);

    ProcessEnvironmentBase.prototype.startup.apply(self, arguments);
  };


  /**
   * @override
   */
  ParentProcessEnvironment.prototype.shutdown = function() {
    let self = this;

    ProcessEnvironmentBase.prototype.shutdown.apply(self, arguments);

    ScriptLoader.doShutdownTasks();
    Cu.unload("chrome://rpcontinued/content/lib/script-loader.jsm");
  };




  /**
   * @constructor
   * @extends {ProcessEnvironmentBase}
   * @param {string=} aName - the environment's name, passed to the superclass.
   */
  function ChildProcessEnvironment(aName="Child Process Environment") {
    let self = this;
    ProcessEnvironmentBase.call(self, aName);

    let childMM = Cc["@mozilla.org/childprocessmessagemanager;1"]
        .getService(Ci.nsISyncMessageSender);

    /**
     * This function will be called when the paren process
     * sends the shutdown message. After this function has
     * finished, RequestPolicy has cleaned up itself from
     * that child process.
     */
    function receiveShutdownMessage() {
      childMM.removeMessageListener(shutdownMessage, receiveShutdownMessage);
      self.shutdown();

      // Unloading `environment.jsm` has to be the last task.
      // After that task, any global object, such as
      // `Environment` or `Cu` is not available anymore.
      //console.debug("unloading environment.jsm");
      Cu.unload("chrome://rpcontinued/content/lib/environment.jsm");
    };

    childMM.addMessageListener(shutdownMessage, receiveShutdownMessage);
  }
  ChildProcessEnvironment.prototype = Object.create(ProcessEnvironmentBase.prototype);
  ChildProcessEnvironment.prototype.constructor = ProcessEnvironmentBase;


  /**
   * @override
   */
  ChildProcessEnvironment.prototype.shutdown = function() {
    let self = this;

    ProcessEnvironmentBase.prototype.shutdown.apply(self, arguments);

    ScriptLoader.doShutdownTasks();
    Cu.unload("chrome://rpcontinued/content/lib/script-loader.jsm");
  };

  ChildProcessEnvironment.prototype.registerInnerEnvironment = function(aEnv) {
    let self = this;
    if (self.envState === ENV_STATES.NOT_STARTED) {
      // The child Process Environment needs to start up when
      // the first framescript in that child is loading.
      //console.debug("[RPC] Going to start up Child Process Environment.");
      self.startup();
    }
    ProcessEnvironmentBase.prototype.registerInnerEnvironment.apply(self,
                                                                    arguments);
  };




  if (isMainProcess === true) {
    return new ParentProcessEnvironment();
  } else {
    return new ChildProcessEnvironment();
  }

})();
