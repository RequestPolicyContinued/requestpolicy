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


let globalScope = globalScope || this;


let EnvironmentManager = (function(self) {

  // Object for holding imported modules, especilly the mod.ScriptLoader.
  let mod = {};

  let scriptLoaderURI = "chrome://requestpolicy/content/lib/script-loader.jsm";

  let ScriptLoader = null;


  /**
   * Ignore any calls to `registerFramescript` completely; the
   * `ContentFrameMessageManager` handed over is needed only in child proceses.
   */
  self.registerFramescript = function(aContentFrameMessageManager) {
    // do nothing.
  };



  /**
   * This is the first function to be called by the EnvironmentManager's
   * startup() function.
   *
   * This function imports essential modules which depend recursively on
   * other modules, so that finally, after this function has finished,
   * all modules will be available to be imported by any other module.
   */
  self.doStartupTasks = function() {
    // =======================================
    // Manually load the ScriptLoader.
    // ---------------------------------------
    // ( It has to be unloaded manually as well! The shutdown function is
    //   defined below. )
    Cu.import(scriptLoaderURI, mod);
    // =======================================


    // Create a dummy scope for modules that have to be imported but not
    // remembered by EnvironmentManager. As the scope is a local variable,
    // it will be removed after the function has finished.
    // However, the main modules register their startup and shutdown functions
    // anyway.
    let dummyScope = {};


    /**
     * The following section is not optimal – read on…
     */
    {
      // Load and init PrefManager before anything else is loaded!
      // The reason is that the Logger, which is imported by many modules,
      // expects the prefs to be initialized and available already.
      let {PrefManager} = mod.ScriptLoader.importModule("main/pref-manager");
      PrefManager.init();

      // TODO: use the Browser Console for logging, see #563.
      //       *Then* it's no longer necessary to load and init PrefManager
      //       first. PrefManager will then be loaded and initialized when all
      //       other back end modules are loaded / initialized.
    }

    // import main modules:
    mod.ScriptLoader.importModules([
      "main/requestpolicy-service",
      "lib/content-policy",
      "main/window-manager",
      "main/about-uri"
    ], dummyScope);
  }



  /**
   * On shutdown, this function is the last one to be called.
   */
  self.doShutdownTasks = function() {
    // HACK WARNING: The Addon Manager does not properly clear all addon
    //               related caches on update; in order to fully update
    //               images and locales, their caches need clearing here.
    Services.obs.notifyObservers(null, "chrome-flush-caches", null);

    // "shutdown" and unload the mod.ScriptLoader *manually*
    mod.ScriptLoader.doShutdownTasks();
    mod = {};
    Cu.unload(scriptLoaderURI);
  }

  return self;
}(EnvironmentManager || {}));
