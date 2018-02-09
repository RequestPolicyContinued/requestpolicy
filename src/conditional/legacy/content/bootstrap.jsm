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
    "resource://gre/modules/commonjs/toolkit/loader.js", {}
);

var console = (function() {
  let {name: appName, platformVersion} = Services.appinfo;
  let isGecko = appName !== "Pale Moon";

  function isVersionAtLeast(aMinVersion) {
    return Services.vc.compare(platformVersion, aMinVersion) >= 0;
  }

  const uri =
      isGecko && isVersionAtLeast("44") ?
        "resource://gre/modules/Console.jsm" :
        "resource://gre/modules/devtools/Console.jsm";
  return Cu.import(uri, {}).console;
})();

var {clearTimeout, setTimeout} = Cu.import("resource://gre/modules/Timer.jsm");

// =============================================================================
// Globals
// =============================================================================

function getGlobals() {
  return {
    Cc, Ci, Cm, Cr, Cu,
    ComponentsID: Components.ID,
    RUN_ID,
    Services,
    XPCOMUtils,

    clearTimeout,
    console,
    setTimeout,
  };
}

// =============================================================================
// CommonJS
// =============================================================================

function createCommonjsEnv() {
  let loaderWrapper = {};
  let main;

  return {
    load: function load(aOptions) {
      const {
        mainFile, additionalGlobals, additionalPaths,
      } = Object.assign({
        additionalGlobals: [],
        additionalPaths: {},
      }, aOptions);

      let globals = getGlobals();
      additionalGlobals.forEach(([key, val]) => {
        globals[key] = val;
      });
      // eslint-disable-next-line new-cap
      loaderWrapper.loader = Loader.Loader({
        paths: Object.assign({
          "toolkit/": "resource://gre/modules/commonjs/toolkit/",
          "": "chrome://rpcontinued/content/",
        }, additionalPaths),
        globals,
      });
      try {
        main = Loader.main(loaderWrapper.loader, mainFile);
      } catch (e) {
        console.error("Loader.main() failed!");
        console.dir(e);
        throw e;
      }
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

  let fakeEnv = {
    commonjsEnv: null,
    exports: null,
  };
  let addon = {
    commonjsEnv: null,
  };

  FakeWebExt.api = null;

  // ---------------------------------------------------------------------------
  // startup
  // ---------------------------------------------------------------------------

  FakeWebExt.startup = function() {
    // eslint-disable-next-line no-console
    console.log("starting up");

    // create the fake environment
    fakeEnv.commonjsEnv = createCommonjsEnv();
    fakeEnv.exports = fakeEnv.commonjsEnv.load({
      mainFile: "bootstrap/main",
      additionalGlobals: [],
    });

    // eslint-disable-next-line no-constant-condition
    if ("/* @echo BUILD_ALIAS */" === "ui-testing") {
      // "export" fake environment api
      FakeWebExt.api = fakeEnv.exports.api;
    }

    const {api} = fakeEnv.exports;

    // initialize the fake environment
    const p = Promise.all([
      api.startup(),

      api.whenReady.then(() => {
        // start up the add-on
        addon.commonjsEnv = createCommonjsEnv();
        // eslint-disable-next-line no-unused-vars
        const background = addon.commonjsEnv.load({
          mainFile: api.manifest.data.background.scripts[0].
              replace(/^content\//, ""),
          additionalGlobals: [
            ["browser", api.backgroundApi],
            ["LegacyApi", api.legacyApi],
            ["_setBackgroundPage", api.bootstrap.setBackgroundPage],
          ],
        });
        // TODO: uncomment
        // api.bootstrap.setBackgroundPage(background.BackgroundPage);
        return;
      }),
    ]);
    p.catch((e) => {
      console.error("Error starting up!");
      console.dir(e);
    });
    return p;
  };

  // ---------------------------------------------------------------------------
  // shutdown
  // ---------------------------------------------------------------------------

  FakeWebExt.shutdown = function(aReason) {
    // eslint-disable-next-line no-console
    console.log("shutting down");

    // shut down the add-on
    addon.commonjsEnv.unload(aReason);
    addon.commonjsEnv = null;

    // shut down the fake environment
    fakeEnv.exports.api.shutdown().then(() => {
      fakeEnv.commonjsEnv.unload();

      // clean up
      fakeEnv.commonjsEnv = null;
      fakeEnv.exports = null;
      FakeWebExt.api = null;

      return;
    }).catch((e) => {
      console.error("Failed to shut down!");
      console.dir(e);
    });
  };

  // ---------------------------------------------------------------------------
  // startupFramescript
  // ---------------------------------------------------------------------------

  const mmShutdownMessage = "/* @echo EXTENSION_ID */" + ":shutdown";

  FakeWebExt.startupFramescript = function(cfmm) {
    const {api} = fakeEnv.exports;

    const commonjsEnv = createCommonjsEnv();
    commonjsEnv.load({
      mainFile: "framescripts/main",
      additionalGlobals: [
        ["cfmm", cfmm],
        ["browser", api.contentApi],
      ],
    });

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
  // startupBrowserAction
  // ---------------------------------------------------------------------------

  FakeWebExt.startupBrowserAction = function(window) {
    const {document} = window;
    const {api} = fakeEnv.exports;

    // eslint-disable-next-line no-param-reassign
    window.browser = api.contentApi;

    function onDOMContentLoaded() {
      document.removeEventListener("DOMContentLoaded", onDOMContentLoaded);
      api.legacyApi.i18n.updateDocument(document);
    }
    document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
  };

  // ---------------------------------------------------------------------------
  // startupSettingsPage
  // ---------------------------------------------------------------------------

  FakeWebExt.startupSettingsPage = function(window) {
    const {document, $} = window;
    const {api} = fakeEnv.exports;

    const commonjsEnv = createCommonjsEnv();

    function onDOMContentLoaded() {
      document.removeEventListener("DOMContentLoaded", onDOMContentLoaded);
      const pageName = document.documentElement.id;
      api.legacyApi.i18n.updateDocument(document);
      commonjsEnv.load({
        mainFile: `settings/${pageName}`,
        additionalGlobals: [
          ["$", $],
          ["window", window],
          ["document", document],
          ["browser", api.backgroundApi],
        ],
      });
    }
    document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
  };

  // ---------------------------------------------------------------------------
  // startupRequestLog
  // ---------------------------------------------------------------------------

  FakeWebExt.startupRequestLog = function(window) {
    let {api} = fakeEnv.exports;

    const commonjsEnv = createCommonjsEnv();

    commonjsEnv.load({
      mainFile: "ui/request-log/main",
      additionalGlobals: [
        ["window", window],
        ["browser", api.backgroundApi],
      ],
    });
  };

  return FakeWebExt;
})();
