// https://developer.mozilla.org/en/Writing_xpcshell-based_unit_tests

// Note: "resource://test" always resolves to the current test folder.

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

// Simulate ProfD in xpcshell tests.
// Modified from http://ehsanakhgari.org/blog/2008-10-17/testing-cache-service
function setup_profile_dir() {
  var dirSvc = Cc["@mozilla.org/file/directory_service;1"]
        .getService(Ci.nsIProperties);
  var provider = {
    getFile: function(prop, persistent) {
      persistent.value = true;
      if (prop == "ProfLD" ||
          prop == "ProfD" ||
          prop == "cachePDir")
        return do_get_profile();
      throw Cr.NS_ERROR_FAILURE;
    },
    QueryInterface: function(iid) {
      if (iid.equals(Ci.nsIDirectoryProvider) ||
          iid.equals(Ci.nsISupports)) {
        return this;
      }
      throw Cr.NS_ERROR_NO_INTERFACE;
    }
  };
  dirSvc.QueryInterface(Ci.nsIDirectoryService).registerProvider(provider);
}

setup_profile_dir();

// Register components in the "components" subdirectory. The current directory
// is the tests/xpcshell/ directory.
let cwd = Cc["@mozilla.org/file/directory_service;1"]
      .getService(Ci.nsIProperties)
      .get("CurWorkD", Ci.nsILocalFile);
let compDir = cwd.parent.parent.clone();
compDir.append("src");
//compDir.append("components");
Components.manager instanceof Ci.nsIComponentRegistrar;
Components.manager.autoRegister(compDir);

// TODO: Since resource://requestpolicy/ is not used anymore, we might have to
//       change code here.
// Setup resource://requestpolicy/
let ioService = Cc["@mozilla.org/network/io-service;1"]
    .getService(Ci.nsIIOService);
let resProt = ioService.getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler);
let aliasFile = Cc["@mozilla.org/file/local;1"]
    .createInstance(Ci.nsILocalFile);
let modulesDir = cwd.parent.parent.clone();
modulesDir.append("src");
modulesDir.append("content");
modulesDir.append("modules");
aliasFile.initWithPath(modulesDir.path);
let aliasURI = ioService.newFileURI(aliasFile);
resProt.setSubstitution("requestpolicy", aliasURI);

// register chrome://* URIs
let cr = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
    .getService(Components.interfaces.nsIChromeRegistry);
cr.checkForNewChrome();


// Setup the Logger module to use |print| instead of |dump| because that's
// what's available for xpcshell tests.
if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

//// maybe this needs to be changed to:
//var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
//    .getService(Ci.mozIJSSubScriptLoader);
//loader.loadSubScript("chrome://rpcontinued/content/lib/logger.jsm");
//// ? -- see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_bindings/XPConnect/xpcshell/HOWTO
Components.utils.import("chrome://rpcontinued/content/lib/logger.jsm");
Logger.printFunc = function (msg) {
  print(msg.trimRight());
}
