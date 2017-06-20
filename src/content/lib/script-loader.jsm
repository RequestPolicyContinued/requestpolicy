/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

"use strict";

/* global Components */
const {results: Cr, utils: Cu} = Components;

/* exported ScriptLoader */
/* exported EXPORTED_SYMBOLS */
var EXPORTED_SYMBOLS = ["ScriptLoader"];

/* global dump */

// import some modules
// NOTICE: This file should NOT import any of RP's modules when it is loaded!
//         Doing so would be a bad practice, and might produce import() loops
//         when the module to be imported wants to import ScriptLoader.
let {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});
let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

//==============================================================================
// utilities
//==============================================================================

const RP_CHROME_CONTENT_URI = "chrome://rpcontinued/content/";

function getModuleURI(id) {
  return RP_CHROME_CONTENT_URI + id + ".jsm";
}

/**
 * If the ScriptLoader catches an Exception, it will be a severe error.
 */
function logSevereError(aMessage, aError) {
  let msg = "[RequestPolicy] [SEVERE] [ERROR] " + aMessage + " " + aError +
       (aError.stack ? ", stack was: " + aError.stack : "");
  dump(msg + "\n");
  Cu.reportError(aError);
}

// FIXME: Integrate ScriptLoader into RPService2, and use Console.jsm then.
let console = {
  debug: Services.console.logStringMessage,
  error: Services.console.logStringMessage
};

//==============================================================================
// ScriptLoader
//==============================================================================

var ScriptLoader = (function() {
  let importedModuleURIs = {};

  // URIs in that variable will not be unloaded
  let moduleUnloadExceptions = {};
  // a module shouldn't unload itself
  moduleUnloadExceptions[getModuleURI("lib/script-loader")] = true;
  // EnvironmentManager has to be unloaded even later than ScriptLoader
  moduleUnloadExceptions[getModuleURI("lib/environment")] = true;

  // contains the module IDs that are currently being imported initially and
  // have not finished importing yet.
  let modulesCurrentlyBeingImported = {};

  let self = {
    /**
     * Unload all modules that have been imported.
     * See https://developer.mozilla.org/en-US/docs/Components.utils.unload
     */
    unloadAllModules: function() {
      for (let uri in importedModuleURIs) {
        if (importedModuleURIs.hasOwnProperty(uri) &&
            moduleUnloadExceptions.hasOwnProperty(uri) === false) {
          // @ifdef LOG_SCRIPTLOADER
          console.debug("[RPC] [ScriptLoader] Cu.unload(\"" + uri + "\");");
          // @endif
          try {
            Cu.unload(uri);
          } catch (e) {
            console.error("[RPC] [ScriptLoader] failed to unload \"" + uri +
                "\"");
            Cu.reportError(e);
          }
          delete importedModuleURIs[uri];
        }
      }
    },

    /**
     * Function called by EnvironmentManager before ScriptLoader is being
     * unloaded.
     */
    doShutdownTasks: function() {
      self.unloadAllModules();
    },

    /**
     * @param {Array} moduleID
     *        the moduleID of the module to import
     * @param {Object} scope
     *        (optional) if not specified, one will be created.
     *
     * @return {Object} the scope
     */
    importModule: function(moduleID, scope) {
      scope = scope || {};

      // avoid import loops.
      if (moduleID in modulesCurrentlyBeingImported) {
        return scope;
      }

      // @ifdef LOG_SCRIPTLOADER
      console.debug("[RPC] [ScriptLoader] importModule(\"" + moduleID +
          "\") called.");
      // @endif

      let uri = getModuleURI(moduleID);
      try {
        if (!(uri in importedModuleURIs)) {
          // the module hasn't been imported yet
          modulesCurrentlyBeingImported[moduleID] = true;
        }

        // @ifdef LOG_SCRIPTLOADER
        console.debug("[RPC] [ScriptLoader] Cu.import(\"" + uri + "\");");
        // @endif
        Cu.import(uri, scope);
        importedModuleURIs[uri] = true;

        if (moduleID in modulesCurrentlyBeingImported) {
          delete modulesCurrentlyBeingImported[moduleID];
        }
      } catch (e) {
        if (e.result === Cr.NS_ERROR_FILE_NOT_FOUND) {
          logSevereError("Failed to import module with ID \"" + moduleID +
              "\", the file was not found!", e);
        } else {
          logSevereError("Failed to import module with ID \"" + moduleID +
              "\".", e);
        }
      }
      return scope;
    },

    /**
     * @param {Array} moduleIDs
     *        the moduleIDs of the modules to import
     * @param {Object} scope
     *        (optional) if not specified, one will be created.
     *
     * @return {Object} the scope
     */
    importModules: function(moduleIDs, scope) {
      scope = scope || {};

      // caution: the modules should be imported in the order specified!
      for (let i = 0, len = moduleIDs.length; i < len; ++i) {
        self.importModule(moduleIDs[i], scope);
      }

      return scope;
    },

    /**
     * @param {String} moduleID
     * @param {Array} names
     *                the names of the symbols to import
     * @param {Object} scope
     *        (optional) if not specified, one will be created.
     *
     * @return {Object} the scope
     */
    defineLazyModuleGetter: function(moduleID, names, scope) {
      scope = scope || {};

      // @ifdef LOG_SCRIPTLOADER
      console.debug("[RPC] [ScriptLoader] " +
          "defineLazyModuleGetter(\"" + moduleID + "\") called.");
      // @endif
      let uri = getModuleURI(moduleID);
      for (let i in names) {
        let name = names[i];
        // @ifndef LOG_SCRIPTLOADER
        XPCOMUtils.defineLazyModuleGetter(scope, name, uri);
        // @endif
        // @ifdef LOG_SCRIPTLOADER
        /* jshint -W083 */ // "don't make functions within a loop"
        XPCOMUtils.defineLazyModuleGetter(scope, name, uri, null, function() {
          console.debug("[RPC] [ScriptLoader] lazily imported \"" + name +
              "\"");
        });
        /* jshint +W083 */
        // @endif
      }
      importedModuleURIs[uri] = true;

      return scope;
    },

    /**
     * @param {Object} modules
     *        An object with  moduleID:names  attributes which will be given to
     *        self.defineLazyModuleGetter()
     * @param {Object} scope
     *        (optional) if not specified, one will be created.
     *
     * @return {Object} the scope
     */
    defineLazyModuleGetters: function(modules, scope) {
      scope = scope || {};

      for (let id in modules) {
        if (modules.hasOwnProperty(id)) {
          self.defineLazyModuleGetter(id, modules[id], scope);
        }
      }

      return scope;
    }
  };

  return self;
}());
