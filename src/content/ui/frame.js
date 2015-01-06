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
Components.utils.import("chrome://requestpolicy/content/lib/script-loader.jsm");

ScriptLoader.importModule("lib/utils/constants", this);



/**
 * This function gets a Environment variable that has the same lifespan like
 * the content window, i.e. the Environment's shutdown() function will be called
 * when the content window is unloaded.
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
var WinEnv = (function getWindowEnvironment() {
  var {ProcessEnvironment} = ScriptLoader.importModule("lib/process-environment");

  let env;

  // Check if this is the main process.
  if (ProcessEnvironment.isMainProcess === true) {
    // This is the main process. The `ProcessEnvironment` can't be used as the
    // content window's Environment, so a new Environment has to be created.
    let {Environment} = ScriptLoader.importModules(["lib/environment"]);
    env = new Environment();
  } else {
    // This is a child process. The `ProcessEnvironment` can be used for this
    // window's Environment.
    env = ProcessEnvironment;
  }

  // Tell the Environment to shut down when the content window is unloaded.
  // Note that this is necessary in any of the above cases.
  env.shutdownOnWindowUnload(content);

  return env;
}());



// fixme: It's unclear whether it's necessary to listen for *any* click in
//        the window. Originally the following code has been part of
//        overlay.onLoad and has been moved here in order to support e10s.
/*
  // Listen for click events so that we can allow requests that result from
  // user-initiated link clicks and form submissions.
  addEventListener("click", function(event) {
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
      sendSyncMessage(C.MMID + ":notifyLinkClicked",
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
      sendSyncMessage(C.MMID + ":registerFormSubmitted",
                      {origin: event.target.ownerDocument.URL,
                       dest: event.target.form.action});
      return;
    }
  }, true);*/

WinEnv.enqueueStartupFunction(function() {
  addMessageListener(C.MMID + ":reload", function() {
    content.document.location.reload(false);
  });

  addMessageListener(C.MMID + ":setLocation", function(message) {
    content.document.location.href = message.data.uri;
  });
});


WinEnv.enqueueStartupFunction(function() {
  Services.scriptloader.loadSubScript(
      'chrome://requestpolicy/content/ui/frame.blocked-content.js');
  Services.scriptloader.loadSubScript(
      'chrome://requestpolicy/content/ui/frame.dom-content-loaded.js');
  Services.scriptloader.loadSubScript(
      'chrome://requestpolicy/content/ui/frame.doc-manager.js');
});

WinEnv.startup();
