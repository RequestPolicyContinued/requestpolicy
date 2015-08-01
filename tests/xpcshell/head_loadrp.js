// https://developer.mozilla.org/en/Writing_xpcshell-based_unit_tests

// Note: "resource://test" always resolves to the current test folder.

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

// Initialize profile.
// This will create a Directory Service Provider for the
// profile directory. See `head.js` in mozilla-central.
{
  let gProfD = do_get_profile();
}

// Register RequestPolicy's Chrome Manifest.
{
  let cwd = Services.dirsvc.get("CurWorkD", Ci.nsIFile);

  let manifestFile = cwd.parent.parent.clone();
  manifestFile.appendRelativePath("build/unit-testing/chrome.manifest");

  Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
                    .autoRegister(manifestFile);
}

// Load default preferences
Services.scriptloader.loadSubScript("chrome://rpcontinued/content/" +
                                    "main/default-pref-handler.js", {});

// Setup the Logger module
{
  let tmpScope = {};
  Cu.import("chrome://rpcontinued/content/lib/logger.jsm", tmpScope);

  // Use |do_print| instead of |dump| because that's what's
  // available for xpcshell tests.
  tmpScope.Logger.printFunc = function (msg) {
    do_print(msg.trimRight());
  };
}
