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

/* eslint-disable no-var */

/* global Components */

/* exported EXPORTED_SYMBOLS, FakeWebExt */
var EXPORTED_SYMBOLS = [
  "FakeWebExt",
];

// ===========================================================================
// constants
// ===========================================================================

var {
  classes: Cc,
  interfaces: Ci,
  manager: Cm,
  results: Cr,
  utils: Cu,
} = Components;

var RUN_ID = Math.random();

// ===========================================================================
// modules
// ===========================================================================

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

// =============================================================================
// Globals
// =============================================================================

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

// =============================================================================
// CommonJS
// =============================================================================

function createCommonjsEnv() {
  let loaderWrapper = {};
  let main;

  return {
    load: function load(aMainFile, aAdditionalGlobals=[]) {
      let globals = getGlobals();
      aAdditionalGlobals.forEach(([key, val]) => {
        globals[key] = val;
      });
      // eslint-disable-next-line new-cap
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

// =============================================================================
// FakeWebExt
// =============================================================================

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

  function runBootstrapFunctions(aEvent) {
    bootstrapFunctions[aEvent].forEach(fn => {
      fn.call(null);
    });
  }

  let fakeEnv = {
    commonjsEnv: null,
    exports: null,
  };
  let addon = {
    commonjsEnv: null,
  };

  FakeWebExt.Api = null;

  // ---------------------------------------------------------------------------
  // startup
  // ---------------------------------------------------------------------------

  FakeWebExt.startup = function() {
    // eslint-disable-next-line no-console
    console.debug("starting up");

    // create the fake environment
    fakeEnv.commonjsEnv = createCommonjsEnv();
    fakeEnv.exports = fakeEnv.commonjsEnv.load("web-extension-fake-api/main", [
      ["Bootstrap", {
        onStartup: FakeWebExt.onStartup,
        onShutdown: FakeWebExt.onShutdown,
      }],
    ]);

    // "export" fake environment Api (for usage by UI tests)
    FakeWebExt.Api = fakeEnv.exports.Api;

    // initialize the fake environment
    runBootstrapFunctions("onStartup");

    // start up the add-on
    const {Api, Manifest} = fakeEnv.exports;
    addon.commonjsEnv = createCommonjsEnv();
    addon.commonjsEnv.load(Manifest.background.scripts[0], [
      ["browser", Api.browser],
      ["LegacyApi", Api.LegacyApi],
      ["_setBackgroundPage", Api._setBackgroundPage],
    ]);
  };

  // ---------------------------------------------------------------------------
  // shutdown
  // ---------------------------------------------------------------------------

  FakeWebExt.shutdown = function(aReason) {
    // eslint-disable-next-line no-console
    console.debug("shutting down");

    // shut down the add-on
    addon.commonjsEnv.unload(aReason);
    addon.commonjsEnv = null;

    // shut down the fake environment
    runBootstrapFunctions("onShutdown");
    fakeEnv.commonjsEnv.unload();

    // clean up
    fakeEnv.commonjsEnv = null;
    fakeEnv.exports = null;
    FakeWebExt.Api = null;
  };

  // ---------------------------------------------------------------------------
  // startupFramescript
  // ---------------------------------------------------------------------------

  const mmShutdownMessage = "/* @echo EXTENSION_ID */" + ":shutdown";

  FakeWebExt.startupFramescript = function(cfmm) {
    const {ContentScriptsApi} = fakeEnv.exports;

    const commonjsEnv = createCommonjsEnv();
    commonjsEnv.load("framescripts/main", [
      ["cfmm", cfmm],
      ["browser", ContentScriptsApi.browser],
    ]);

    function unload() {
      commonjsEnv.unload();
    }
    function onShutdownMessage() {
      cfmm.removeMessageListener(mmShutdownMessage, onShutdownMessage);
      unload();
    }
    function onDocumentUnload() {
      cfmm.removeEventListener("unload", onDocumentUnload);
      unload();
    }
    cfmm.addMessageListener(mmShutdownMessage, onShutdownMessage);
    cfmm.addEventListener("unload", onDocumentUnload);
  };

  // ---------------------------------------------------------------------------
  // startupSettingsPage
  // ---------------------------------------------------------------------------

  FakeWebExt.startupSettingsPage = function(window) {
    const {document, $} = window;
    const {Api} = fakeEnv.exports;

    const commonjsEnv = createCommonjsEnv();

    function onDOMContentLoaded() {
      document.removeEventListener("DOMContentLoaded", onDOMContentLoaded);
      const pageName = document.documentElement.id;
      commonjsEnv.load("settings/" + pageName, [
        ["$", $],
        ["window", window],
        ["document", document],
        ["browser", Api.browser],
      ]);
    }
    document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
  };

  // ---------------------------------------------------------------------------
  // startupRequestLog
  // ---------------------------------------------------------------------------

  FakeWebExt.startupRequestLog = function(window) {
    let {Api} = fakeEnv.exports;

    const commonjsEnv = createCommonjsEnv();

    commonjsEnv.load("ui/request-log/main", [
      ["window", window],
      ["browser", Api.browser],
    ]);
  };

  return FakeWebExt;
})();
