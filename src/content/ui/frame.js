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

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  let {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  //let {RPService2: {console}} = importModule("main/rp-service-2");
  let {C} = importModule("lib/utils/constants");
  let {Environment, FrameScriptEnvironment} = importModule("lib/environment");
  let {FramescriptToOverlayCommunication} = importModule(
      "lib/framescript-to-overlay-communication");

  // the ContentFrameMessageManager of this framescript
  let mm = this;
  let {content, sendSyncMessage} = mm;

  //============================================================================

  //console.debug('[RPC] new framescript loading...');

  let framescriptEnv = new FrameScriptEnvironment(mm);
  let mlManager = framescriptEnv.mlManager;
  let overlayComm = new FramescriptToOverlayCommunication(framescriptEnv);

  // Create a scope for the sub-scripts, which also can
  // be removed easily when the framescript gets unloaded.
  var framescriptScope = {
    mm: mm,
    framescriptEnv: framescriptEnv,
    mlManager: mlManager,
    overlayComm: overlayComm
  };

  function loadSubScripts() {
    Services.scriptloader.loadSubScript(
        "chrome://rpcontinued/content/ui/frame.blocked-content.js",
        framescriptScope);
    Services.scriptloader.loadSubScript(
        "chrome://rpcontinued/content/ui/frame.dom-content-loaded.js",
        framescriptScope);
  }
  framescriptEnv.addStartupFunction(Environment.LEVELS.ESSENTIAL,
                                    loadSubScripts);

  framescriptEnv.addShutdownFunction(Environment.LEVELS.ESSENTIAL, function() {
    //console.debug("removing framescriptScope '" + framescriptEnv.uid + "'");
    framescriptScope = null;
  });

  function reloadDocument() {
    content.document.location.reload(false);
  }
  mlManager.addListener("reload", reloadDocument);

  function setLocation(aUri) {
    content.document.location.href = aUri;
  }
  mlManager.addListener("setLocation", function(message) {
    setLocation(message.data.uri);
  });

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
    if (event.button !== 0) {
      return;
    }
    // Link clicked.
    // I believe an empty href always gets filled in with the current URL so
    // it will never actually be empty. However, I don't know this for certain.
    if (event.target.nodeName.toLowerCase() === "a" && event.target.href) {
      overlayComm.run(function() {
        sendSyncMessage(C.MM_PREFIX + "notifyLinkClicked",
                        {origin: event.target.ownerDocument.URL,
                         dest: event.target.href});
      });
      return;
    }
    // Form submit button clicked. This can either be directly (e.g. mouseclick,
    // enter/space while the the submit button has focus) or indirectly (e.g.
    // pressing enter when a text input has focus).
    if (event.target.nodeName.toLowerCase() === "input" &&
        event.target.type.toLowerCase() === "submit" &&
        event.target.form && event.target.form.action) {
      overlayComm.run(function() {
        sendSyncMessage(C.MM_PREFIX + "registerFormSubmitted",
                        {origin: event.target.ownerDocument.URL,
                         dest: event.target.form.action});
      });
      return;
    }
  }

  framescriptEnv.addStartupFunction(Environment.LEVELS.INTERFACE, function() {
    framescriptEnv.elManager.addListener(mm, "click", mouseClicked, true);
  });

  // start up the framescript's environment
  framescriptEnv.startup();
}());
