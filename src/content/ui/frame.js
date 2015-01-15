/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

Components.utils.import("resource://gre/modules/Services.jsm");
//Components.utils.import("resource://gre/modules/devtools/Console.jsm");

/**
 * This anonymous function is needed because of Mozilla Bug 673569, fixed in
 * Firefox 29 / Gecko 29.
 * The bug means that all frame scripts run in the same shared scope. The
 * anonymous function ensures that the framescripts do not overwrite
 * one another.
 */
(function () {
  //console.debug('[RPC] new framescript loading...');

  // the ContentFrameMessageManager of this framescript
  let mm = this;

  // Create a new scope that can be removed easily when the framescript has to
  // be unloaded.
  var FrameScriptScope = {
    mm: mm,
    content: mm.content,
    Components: mm.Components,

    Ci: mm.Components.interfaces,
    Cc: mm.Components.classes,
    Cu: mm.Components.utils
  };

  const Cu = Components.utils;
  Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm",
            FrameScriptScope);
  let ScriptLoader = FrameScriptScope.ScriptLoader;

  ScriptLoader.importModules([
    "lib/utils/constants",
    "lib/environment",
    "main/environment-manager"
  ], FrameScriptScope);
  let C = FrameScriptScope.C;
  let Environment = FrameScriptScope.Environment;
  let EnvironmentManager = FrameScriptScope.EnvironmentManager;


  /**
   * This function gets a Environment variable that has the same lifespan as
   * the framescript. , i.e. the Environment's shutdown() function will be called
   * when the Tab is  is unloaded.
   *
   * There are two cases:
   *
   * If this is the main process:
   *     A new Environment is created.
   *
   * If this is *not* the main process:
   *     `ProcessEnvironment` will be used. This ensures that this script will
   *     have the same Environment as the modules that will be loaded.
   */
  FrameScriptScope.FrameScriptEnv = (function getFrameScriptEnv() {
    // Check if this is the main process.
    if (EnvironmentManager.isMainProcess === true) {
      //console.debug('[RPC] the framescript is in the main process. ' +
      //              'Creating a new environment...');
      // This is the main process. The `ProcessEnvironment` can't be used as the
      // content window's Environment, so a new Environment has to be created.
      let {Environment} = ScriptLoader.importModules(["lib/environment"]);
      return new Environment("FrameScriptEnv (main process)");
    } else {
      //console.debug('[RPC] the framescript is in a child process. ' +
      //              "Going to use the child's ProcEnv...");
      // This is a child process. The `ProcessEnvironment` can be used for this
      // window's Environment.
      return ScriptLoader.importModule("lib/process-environment")
                         .ProcessEnvironment;
    }
  }());

  let FrameScriptEnv = FrameScriptScope.FrameScriptEnv;

  FrameScriptEnv.addShutdownFunction(Environment.LEVELS.ESSENTIAL, function() {
    //console.debug("removing FrameScriptScope");
    FrameScriptScope = null;
  });


  let {ManagerForMessageListeners} = ScriptLoader.importModule(
      "lib/manager-for-message-listeners");
  FrameScriptScope.mlManager = new ManagerForMessageListeners(
      FrameScriptEnv, mm);
  let mlManager = FrameScriptScope.mlManager;



  /**
   * Ensure that the framescript is „shut down“ when the addon gets disabled.
   *
   * TODO: use the Child Message Manager instead!
   *       https://developer.mozilla.org/en-US/Firefox/Multiprocess_Firefox/The_message_manager#Process_Message_Managers
   */
  {
    // Hand over the ContentFrameMessageManager of this framescript to the
    // EnvironmentManager. The EnvironmentManager then shuts down all environments
    // in the child process when the "shutdown" message is received. If this
    // framescript is in the *chrome* process (aka. main process / parent process)
    // then EnvironmentManager will simply ignore this function call.
    EnvironmentManager.registerFramescript(mm);
  }

  /**
   * Ensure that the framescript is „shut down“ when the correspondung Tab gets
   * closed.
   */
  {
    FrameScriptEnv.elManager.addListener(mm, "unload", function() {
      FrameScriptEnv.shutdown();
    }, false);
  }

  /**
   * Ensure that EnvironmentManager is unloaded in a child process. If it
   * wouldn't be unloaded, the EnvironmentManager might be the same one the
   * next time the addon gets enabled.
   *
   * The unload can't be done from EnvironmentManager itself, as due to Mozilla
   * Bug 769253 a module cannot unload itself. This is also the reason why
   * the unload is done async -- the shutdown functions are called by
   * EnvironmentManager.
   */
  function unloadEnvMan() {
    // The runnable (nsIRunnable) that will be executed asynchronously.
    let runnableForUnloadingEnvMan = {
      run: function() {
        Components.utils.unload("chrome://requestpolicy/content/" +
                                "main/environment-manager.jsm");
      }
    };

    // tell the current thread to run the `unloadEnvMan` runnable async.
    Components.classes["@mozilla.org/thread-manager;1"]
        .getService(Components.interfaces.nsIThreadManager)
        .currentThread
        .dispatch(runnableForUnloadingEnvMan,
                  Components.interfaces.nsIEventTarget.DISPATCH_NORMAL);
  }
  if (EnvironmentManager.isMainProcess === false) {
    FrameScriptEnv.addShutdownFunction(Environment.LEVELS.ESSENTIAL,
                                       unloadEnvMan);
  }


  function reloadDocument() {
    content.document.location.reload(false);
  }
  mlManager.addListener("reload", reloadDocument);

  function setLocation(aUri) {
    content.document.location.href = aUri;
  }
  mlManager.addListener("setLocation", function (message) {
    setLocation(message.data.uri);
  });

  function loadSubScripts() {
    Services.scriptloader.loadSubScriptWithOptions(
        'chrome://requestpolicy/content/ui/frame.blocked-content.js',
        {target: FrameScriptScope/*, ignoreCache: true*/});
    Services.scriptloader.loadSubScriptWithOptions(
        'chrome://requestpolicy/content/ui/frame.dom-content-loaded.js',
        {target: FrameScriptScope/*, ignoreCache: true*/});
    Services.scriptloader.loadSubScriptWithOptions(
        'chrome://requestpolicy/content/ui/frame.doc-manager.js',
        {target: FrameScriptScope/*, ignoreCache: true*/});
  }
  FrameScriptEnv.addStartupFunction(Environment.LEVELS.BACKEND,
                                    loadSubScripts);

  FrameScriptEnv.startup();



  // Listen for click events so that we can allow requests that result from
  // user-initiated link clicks and form submissions.
  function mouseClicked(event) {
    // If mozInputSource is undefined or zero, then this was a javascript-generated event.
    // If there is a way to forge mozInputSource from javascript, then that could be used
    // to bypass RequestPolicy.
    if (!event.mozInputSource) {
      return;
    }
    // The following show up as button value 0 for links and form input submit buttons:
    // * left-clicks
    // * enter key while focused
    // * space bar while focused (no event sent for links in this case)
    if (event.button != 0) {
      return;
    }
    // Link clicked.
    // I believe an empty href always gets filled in with the current URL so
    // it will never actually be empty. However, I don't know this for certain.
    if (event.target.nodeName.toLowerCase() == "a" && event.target.href) {
      sendSyncMessage(C.MM_PREFIX + "notifyLinkClicked",
                      {origin: event.target.ownerDocument.URL,
                       dest: event.target.href});
      return;
    }
    // Form submit button clicked. This can either be directly (e.g. mouseclick,
    // enter/space while the the submit button has focus) or indirectly (e.g.
    // pressing enter when a text input has focus).
    if (event.target.nodeName.toLowerCase() == "input" &&
        event.target.type.toLowerCase() == "submit" &&
        event.target.form && event.target.form.action) {
      sendSyncMessage(C.MM_PREFIX + "registerFormSubmitted",
                      {origin: event.target.ownerDocument.URL,
                       dest: event.target.form.action});
      return;
    }
  };
  FrameScriptEnv.addStartupFunction(Environment.LEVELS.INTERFACE, function() {
    FrameScriptEnv.elManager.addListener(mm, "click", mouseClicked, true);
  });
}());
