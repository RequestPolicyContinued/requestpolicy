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

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
//Cu.import("resource://gre/modules/devtools/Console.jsm");


let EnvironmentManager = (function(self) {
  // Manually import the scriptloader without waiting for the startup.
  let mod = {};
  let scriptLoaderURI = "chrome://requestpolicy/content/lib/script-loader.jsm";
  Cu.import(scriptLoaderURI, mod);
  mod.ScriptLoader.defineLazyModuleGetters({
    "lib/utils/constants": ["C"]
  }, mod);


  // ================================
  // variables set by `registerFramescript`:
  // ---------------------------------------
  // the content frame's message manager
  let mm = null;

  // The framescript's URI will be checked against the URI in the
  // message to ensure there is no conflics between old and new framescripts
  // in case the addon is disabled and enabled in quick succession.
  // For details see:
  // https://palant.de/2014/11/19/unloading-frame-scripts-in-restartless-extensions
  let framescriptURI = null;
  // ================================


  let shutdownMessageName = mod.C.MM_PREFIX + "shutdown";

  function shutDownEnvMan(message) {
    if (message.data.uri == framescriptURI) {
      //console.log("[RPC] Child EnvironmentManager received `shutdown` " +
      //            'message. Going to shut down all environments.');

      /**
       * cleanup
       */
      {
        mm.removeMessageListener(shutdownMessageName, shutDownEnvMan);
        framescriptURI = null;
        // remove the reference to the message manager
        mm = null;
      }

      /**
       * shut down all environments
       */
      {
        self.shutdown();
        // if shutdown() arguments would be needed, the following could be used:
        //self.shutdown.apply(self, message.data.arguments);
      }
    }
  };


  /**
   * Each framescript instance registers itself to EnvironmentManager. The
   * purpose is that Environment Managers in child process listen to the
   * "shutdown" message. When that message is received, the child's
   * EnvironmentManager shuts down.
   *
   * Note: framescripts might also be in the *main* process, but then it's not
   *       necessary to listen for "shutdown" as each environment in the
   *       framescript's has direct access to the *main* EnvironmentManager.
   */
  self.registerFramescript = function(aContentFrameMessageManager) {
    // ensure that `registerFramescript` is called only once
    if (mm === null) {
      //console.log("a framescript has registered");
      // remember the MM
      mm = aContentFrameMessageManager;
      // set the framescriptURI
      framescriptURI = Components.stack.caller.filename;
      // manually add a Message Listener (without a ManagerForMessageListeners)
      mm.addMessageListener(shutdownMessageName, shutDownEnvMan);
    }
  };



  self.doShutdownTasks = function() {
    // "shutdown" and unload the mod.ScriptLoader *manually*
    mod.ScriptLoader.doShutdownTasks();
    mod = {};
    Cu.unload(scriptLoaderURI);
  }


  return self;
}(EnvironmentManager || {}));
