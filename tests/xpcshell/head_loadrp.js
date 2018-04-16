/* exported Cc, Ci, Cr, Cu, require */

const {Cc, Ci, Cr, Cu, require} = (function() {
  const {
    classes: Cc,
    interfaces: Ci,
    manager: Cm,
    results: Cr,
    utils: Cu,
  } = Components;

  // Note: "resource://test" always resolves to the current test folder.

  const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  // -----------------------------------------------------------------------------
  // Initialize the profile.
  // -----------------------------------------------------------------------------

  // This will create a Directory Service Provider for the
  // profile directory. See `head.js` in mozilla-central.
  // The return value is the profile directory, and can be
  // simply ignored.
  do_get_profile();

  // -----------------------------------------------------------------------------
  // Register RequestPolicy's Chrome Manifest.
  // -----------------------------------------------------------------------------

  function getRPChromeManifest() {
    const cwd = Services.dirsvc.get("CurWorkD", Ci.nsIFile);

    const manifestFile = cwd.parent.parent.clone();
    manifestFile.appendRelativePath("build/legacy/nightly/chrome.manifest");
    return manifestFile;
  }

  function registerRPChromeManifest() {
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar).
        autoRegister(getRPChromeManifest());
  }

  registerRPChromeManifest();

  // -----------------------------------------------------------------------------
  // CommonJS
  // -----------------------------------------------------------------------------

  const {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});
  const {Loader} = Cu.import("resource://gre/modules/commonjs/toolkit/loader.js", {});
  const {console} = Cu.import("resource://gre/modules/Console.jsm", {});
  const {clearTimeout, setTimeout} = Cu.import("resource://gre/modules/Timer.jsm");

  const RUN_ID = Math.random();

  const LegacyApi = {};

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

      LegacyApi,
    };
  }

  function createCommonjsEnv() {
    let loaderWrapper = {};
    let main;

    return {
      load(mainFile) {
        let globals = getGlobals();
        // eslint-disable-next-line new-cap
        loaderWrapper.loader = Loader.Loader({
          paths: Object.assign({
            "toolkit/": "resource://gre/modules/commonjs/toolkit/",
            "": "chrome://rpcontinued/content/",
          }),
          globals,
        });
        main = Loader.main(loaderWrapper.loader, mainFile);
        return main;
      },
      unload: (function(Loader, loaderWrapper) {
        return function unload(aReason) {
          Loader.unload(loaderWrapper.loader, aReason);
        };
      })(Loader, loaderWrapper),
    };
  }

  const COMMONJS = createCommonjsEnv();
  const require = COMMONJS.load.bind(COMMONJS);

  // -----------------------------------------------------------------------------
  // LegacyApi
  // -----------------------------------------------------------------------------

  const {Prefs} = require("bootstrap/api/storage/prefs");
  const {PrefBranch} = require("bootstrap/api/storage/pref-branch");
  const TryCatchUtils = require("lib/utils/try-catch-utils");

  const prefBranchFactory = (branchRoot, namesToTypesMap) => new PrefBranch(
      Services.prefs, branchRoot, namesToTypesMap
  );

  LegacyApi.prefs = new Prefs(Services.prefs, prefBranchFactory, TryCatchUtils);

  // -----------------------------------------------------------------------------
  // Load the default preferences
  // -----------------------------------------------------------------------------

  const {DefaultPreferencesController} =
      require("bootstrap/controllers/default-preferences-controller");
  DefaultPreferencesController.startup();

  return {Cc, Ci, Cr, Cu, require};
})();
