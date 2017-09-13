/* exported Cc, Ci, Cr, Cu */
const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

// Note: "resource://test" always resolves to the current test folder.

Cu.import("resource://gre/modules/Services.jsm");

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
  manifestFile.appendRelativePath("build/nightly/chrome.manifest");
  return manifestFile;
}

function registerRPChromeManifest() {
  Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
                    .autoRegister(getRPChromeManifest());
}

registerRPChromeManifest();

// -----------------------------------------------------------------------------
// Load the default preferences
// -----------------------------------------------------------------------------

Services.scriptloader.loadSubScript("chrome://rpcontinued/content/" +
                                    "main/default-pref-handler.js", {});

// -----------------------------------------------------------------------------
// Set up the Logger module
// -----------------------------------------------------------------------------

{
  let tmpScope = {};
  Cu.import("chrome://rpcontinued/content/lib/logger.jsm", tmpScope);

  // Use |do_print| instead of |dump| because that's what's
  // available for xpcshell tests.
  tmpScope.Logger.printFunc = function(msg) {
    do_print(msg.trimRight());
  };
}
