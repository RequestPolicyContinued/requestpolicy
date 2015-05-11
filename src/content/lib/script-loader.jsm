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
const Cr = Components.results;

let EXPORTED_SYMBOLS = ["ScriptLoader"];

// import some modules
// NOTICE: This file should NOT import any of RP's modules when it is loaded!
//         Doing so would be a bad practice, and might produce import() loops
//         when the module to be imported wants to import ScriptLoader.
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/devtools/Console.jsm");


const rpChromeContentURI = 'chrome://rpcontinued/content/';

function getModuleURI(id) {
  return rpChromeContentURI + id + ".jsm";
}

/**
 * If the ScriptLoader catches an Exception, it will be a severe error.
 */
function logSevereError(msg, e) {
  dump("[RequestPolicy] [SEVERE] [ERROR] " + msg + " " + e +
       (e.stack ? ", stack was: " + e.stack : "") + "\n");
}



let ScriptLoader = (function() {

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
          //console.debug("[RPC] Unloading module "+uri);
          try {
            Cu.unload(uri);
          } catch(e) {
            console.error("[RPC] Failed to unload module "+uri);
            Components.utils.reportError(e);
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

      //console.debug("[RPC] `importModule` called for "+moduleID);

      let uri = getModuleURI(moduleID);
      try {
        if (!(uri in importedModuleURIs)) {
          // the module hasn't been imported yet
          modulesCurrentlyBeingImported[moduleID] = true;
          //console.debug("[RPC] importing " + moduleID);
        }

        Cu.import(uri, scope);
        importedModuleURIs[uri] = true;

        if (moduleID in modulesCurrentlyBeingImported) {
          delete modulesCurrentlyBeingImported[moduleID];
        }
      } catch (e if e.result === Cr.NS_ERROR_FILE_NOT_FOUND) {
        logSevereError('Failed to import module with ID "' + moduleID +
                       '", the file was not found!', e);
      } catch (e) {
        logSevereError('Failed to import module with ID "' + moduleID +
                       '".', e);
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

      //console.debug("[RPC] defining lazy module getter(s) for " + moduleID);
      let uri = getModuleURI(moduleID);
      for (let i in names) {
        let name = names[i];
        XPCOMUtils.defineLazyModuleGetter(scope, name, uri);
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
