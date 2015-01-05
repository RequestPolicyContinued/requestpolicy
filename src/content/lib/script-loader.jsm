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

let EXPORTED_SYMBOLS = ["ScriptLoader"];

// import some modules
// NOTICE: This file should NOT import any of RP's modules when it is loaded!
//         Doing so would be a bad practice, and might produce import() loops
//         when the module to be imported wants to import ScriptLoader.
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");


const rpChromeContentURI = 'chrome://requestpolicy/content/';

function getModuleURI(id) {
  return rpChromeContentURI + id + ".jsm";
}

/**
 * If the ScriptLoader catches an Exception, it will be a severe error.
 */
function logSevereError(msg, stack) {
  dump("[RequestPolicy] [SEVERE] [ERROR] " + msg +
       (stack ? ", stack was: " + stack : "") + "\n");
}



let ScriptLoader = (function() {

  let importedModuleURIs = {};

  // contains the module IDs that are currently being imported initially and
  // have not finished importing yet.
  let modulesCurrentlyBeingImported = {};


  let self = {
    /**
     * Unload all modules that have been imported.
     * See https://developer.mozilla.org/en-US/docs/Components.utils.unload
     * The Process Environment of the main process takes care of calling this
     * function.
     */
    unloadAllModules: function() {
      for (let uri in importedModuleURIs) {
        if (importedModuleURIs.hasOwnProperty(uri)) {
          Cu.unload(uri);
          delete importedModuleURIs[uri];
        }
      }
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

      let uri = getModuleURI(moduleID);
      try {
        if (!(uri in importedModuleURIs)) {
          // the module hasn't been imported yet
          modulesCurrentlyBeingImported[moduleID] = true;
        }

        Cu.import(uri, scope);
        importedModuleURIs[uri] = true;

        if (moduleID in modulesCurrentlyBeingImported) {
          delete modulesCurrentlyBeingImported[moduleID];
        }
      } catch (e) {
        logSevereError("Failed to import module \"" + moduleID + "\": " + e,
                       e.stack);
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
