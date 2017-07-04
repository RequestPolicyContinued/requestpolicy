/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

/* exported EXPORTED_SYMBOLS, FakeWebExt */
var EXPORTED_SYMBOLS = [
  "FakeWebExt",
];

//============================================================================
// constants
//============================================================================

var {
  classes: Cc,
  interfaces: Ci,
  manager: Cm,
  results: Cr,
  utils: Cu,
} = Components;

var RUN_ID = Math.random();

//============================================================================
// modules
//============================================================================

var {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
var {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

var {Loader} = Cu.import(
    "resource://gre/modules/commonjs/toolkit/loader.js", {});

var console = (function() {
  let {name: appName, platformVersion} = Services.appinfo;
  let isGecko = appName !== "Pale Moon";

  function isVersionAtLeast(aMinVersion) {
    return Services.vc.compare(platformVersion, aMinVersion) >= 0;
  }

  const uri = isGecko && isVersionAtLeast("44") ?
              "resource://gre/modules/Console.jsm" :
              "resource://gre/modules/devtools/Console.jsm";
  return Cu.import(uri, {}).console;
})();

//==============================================================================
// Globals
//==============================================================================

function getGlobals() {
  return {
    Cc, Ci, Cm, Cr, Cu,
    ComponentsID: Components.ID,
    console,
    RUN_ID,
    Services,
    XPCOMUtils,
  };
}

//==============================================================================
// CommonJS
//==============================================================================

function createCommonjsEnv() {
  let loaderWrapper = {};
  let main;

  return {
    load: function load(aMainFile, aAdditionalGlobals=[]) {
      let globals = getGlobals();
      aAdditionalGlobals.forEach(([key, val]) => {
        globals[key] = val;
      });
      loaderWrapper.loader = Loader.Loader({
        paths: {
          "toolkit/": "resource://gre/modules/commonjs/toolkit/",
          "": "chrome://rpcontinued/content/",
        },
        globals,
      });
      main = Loader.main(loaderWrapper.loader, aMainFile);
      return main;
    },
    unload: (function(Loader, loaderWrapper) {
      return function unload(aReason) {
        Loader.unload(loaderWrapper.loader, aReason);
      };
    })(Loader, loaderWrapper),
  };
}

//==============================================================================
// FakeWebExt
//==============================================================================

var FakeWebExt = (function() {
  let FakeWebExt = {
    createCommonjsEnv,
    getGlobals,
  };

  let bootstrapFunctions = {
    onStartup: [],
    onShutdown: [],
  };

  const FIFO_ADD = "push";
  const LIFO_ADD = "unshift";

  /**
   * @param {String} aEvent "onStartup" or "onShutdown"
   * @param {String} aArrayAddFn "push" or "unshift"
   * @param {Function} aFn
   */
  function addBootstrapFn(aEvent, aArrayAddFn, aFn) {
    bootstrapFunctions[aEvent][aArrayAddFn](aFn);
  }

  FakeWebExt.onStartup = addBootstrapFn.bind(null, "onStartup", FIFO_ADD);
  FakeWebExt.onShutdown = addBootstrapFn.bind(null, "onShutdown", LIFO_ADD);

  function onBootstrapEvent(aEvent) {
    bootstrapFunctions[aEvent].forEach(fn => {
      fn.call(null);
    });
  }

  FakeWebExt.startup = onBootstrapEvent.bind(null, "onStartup");
  FakeWebExt.shutdown = onBootstrapEvent.bind(null, "onShutdown");

  return FakeWebExt;
}());

//==============================================================================
// Api
//==============================================================================

(function() {
  let commonjsEnv = createCommonjsEnv();
  const Bootstrap = {
    onStartup: FakeWebExt.onStartup,
    onShutdown: FakeWebExt.onShutdown,
  };
  Bootstrap.onShutdown(() => {
    commonjsEnv.unload();
    commonjsEnv = undefined;
  });
  const exports = commonjsEnv.load("web-extension-fake-api/main", [
    ["Bootstrap", Bootstrap],
  ]);

  FakeWebExt.Api = exports.Api;
  FakeWebExt.ContentScriptsApi = exports.ContentScriptsApi;
  FakeWebExt.Manifest = exports.Manifest;
}());
