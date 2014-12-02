/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["ScriptLoader"];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const rpChromeContentURI = 'chrome://requestpolicy/content/';

function getModuleURI(id) {
  return rpChromeContentURI + "lib/" + id + ".jsm";
}

let loggerURI = getModuleURI("logger");
Cu.import(loggerURI);

/*
// remove

might be helpful. This will import an arbitrary module into a
singleton object, which it returns. If the argument is not an
absolute path, the module is imported relative to the caller's
filename.

function module(uri) {
  if (!/^[a-z-]+:/.exec(uri)) {
    uri = /([^ ]+\/)[^\/]+$/.exec(Components.stack.caller.filename)[1] + uri + ".jsm";
  }

  let obj = {};
  Components.utils.import(uri, obj);
  return obj;
}

*/

let ScriptLoader = (function() {
  /*let modules = [
    "content-policy",
    "domain-util",
    "file-util",
    "gui-location",
    "logger",
    "policy-manager",
    "prefs",
    "request-processor",
    "request-result",
    "request-set",
    "request",
    "requestpolicy-service",
    "ruleset-storage",
    "ruleset",
    "subscription",
    "utils",
    "window-manager",
    "xul-utils"
  ];*/

  // the logger is always imported
  let importedModuleURIs = {};
  importedModuleURIs[loggerURI] = true;

  let scopes = {};

  // contains the module IDs that are currently being imported initially and
  // have not finished importing yet.
  let modulesCurrentlyBeingImported = {};


  let self = {
    // public attributes and methods

    unloadAllLibraries: function() {
      scopes = {};
    },

    unloadAllModules: function() {
      for (let uri in importedModuleURIs) {
        if (importedModuleURIs.hasOwnProperty(uri)) {
          //dump("unloading " + uri + "  ...  ");
          Cu.unload(uri);
          //dump("ok.\n");
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
        Logger.severeError("Failed to import module \"" + moduleID + "\": " + e,
                           e);
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
    },

    /*require: function(id) {
      try {
        if (!scriptFilenames[id]) {
          throw new Error("the script does not exist");
        }
        if (!scopes[id]) {
          scopes[id] = {
            exports: {},
            require: self.require,
            Ci: Ci, Cc: Cc, Cu: Cu,
            scriptFinishedLoading: false
          };
          let uri = rpChromeContentURI + 'lib/' + scriptFilenames[id] + '.js';
          try {
            Services.scriptloader.loadSubScript(uri, scopes[id]);
          } catch (e) {
            throw new Error('loadSubScript("' + uri + '", scope) failed!' +
                (e ? " Error was: " + e : ""));
          }
          scopes[id].scriptFinishedLoading = true;
        } else if (scopes[id].scriptFinishedLoading === false) {
          throw new Error('Loop detected! "' + id + '" is required but is' +
              ' itself still loading!');
        }
        return scopes[id].exports;
      } catch (e) {
        // Indicate the filename because the exception doesn't have that
        // in the string.
        Logger.severeError("require(" + id + ") failed: " + (e ? e : ""), e);
        // TODO: indicate to the user that RP's broken.
        delete scopes[id];
        return {};
      }
    }*/
  };

  return self;
}());
