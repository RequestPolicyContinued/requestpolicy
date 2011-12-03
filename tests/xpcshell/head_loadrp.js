// https://developer.mozilla.org/en/Writing_xpcshell-based_unit_tests

// Note: "resource://test" always resolves to the current test folder.

const CC = Components.classes;
const CI = Components.interfaces;
const CR = Components.results;

// Simulate ProfD in xpcshell tests.
// Modified from http://ehsanakhgari.org/blog/2008-10-17/testing-cache-service
function setup_profile_dir() {
  var dirSvc = CC["@mozilla.org/file/directory_service;1"]
        .getService(CI.nsIProperties);
  var provider = {
    getFile: function(prop, persistent) {
      persistent.value = true;
      if (prop == "ProfLD" ||
          prop == "ProfD" ||
          prop == "cachePDir")
        return do_get_profile();
      throw CR.NS_ERROR_FAILURE;
    },
    QueryInterface: function(iid) {
      if (iid.equals(CI.nsIDirectoryProvider) ||
          iid.equals(CI.nsISupports)) {
        return this;
      }
      throw CR.NS_ERROR_NO_INTERFACE;
    }
  };
  dirSvc.QueryInterface(CI.nsIDirectoryService).registerProvider(provider);
}

setup_profile_dir();

// Register components in the "components" subdirectory. The current directory
// is the tests/xpcshell/ directory.
let cwd = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("CurWorkD", Components.interfaces.nsILocalFile);
let compDir = cwd.parent.parent.clone();
compDir.append("src");
//compDir.append("components");
Components.manager instanceof Components.interfaces.nsIComponentRegistrar;
Components.manager.autoRegister(compDir);

// Setup resource://requestpolicy (since chrome.manifest wasn't loaded).
let ioService = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
let resProt = ioService.getProtocolHandler("resource")
                       .QueryInterface(Components.interfaces.nsIResProtocolHandler);
let aliasFile = Components.classes["@mozilla.org/file/local;1"]
                          .createInstance(Components.interfaces.nsILocalFile);
let modulesDir = cwd.parent.parent.clone();
modulesDir.append("src");
modulesDir.append("modules");
aliasFile.initWithPath(modulesDir.path);
let aliasURI = ioService.newFileURI(aliasFile);
resProt.setSubstitution("requestpolicy", aliasURI);

// Setup the Logger module to use |print| instead of |dump| because that's
// what's available for xpcshell tests.
if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/Logger.jsm");
Logger.printFunc = function (msg) {
  print(msg.trimRight());
}
