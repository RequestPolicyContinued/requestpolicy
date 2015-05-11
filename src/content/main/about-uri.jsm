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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;
const Cr = Components.results;

let EXPORTED_SYMBOLS = ["AboutRequestPolicy"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

let globalScope = this;


Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/environment",
  "lib/utils"
], globalScope);


var filenames = {
  "basicprefs": "basicprefs.html",
  "advancedprefs": "advancedprefs.html",
  "yourpolicy": "yourpolicy.html",
  "defaultpolicy": "defaultpolicy.html",
  "subscriptions": "subscriptions.html",
  "setup": "setup.html"
};

function getURI(aURI) {
  let id;
  let index = aURI.path.indexOf("?");
  if (index >= 0 && aURI.path.length > index) {
    id = aURI.path.substr(index+1);
  }
  if (!id || !(id in filenames)) {
    id = "basicprefs";
  }
  return "chrome://rpcontinued/content/settings/" + filenames[id];
}



let AboutRequestPolicy = (function() {
  let self = {
    classDescription: "about:requestpolicy",
    contractID: "@mozilla.org/network/protocol/about;1?what=requestpolicy",
    classID: Components.ID("{77d4be21-6a28-4b91-9886-15ccd83795e8}"),
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

    getURIFlags: function(aURI) {
      return Ci.nsIAboutModule.ALLOW_SCRIPT;
    },

    newChannel: function(aURI) {
      let uri = getURI(aURI)
      let channel = Services.io.newChannel(uri, null, null);
      channel.originalURI = aURI;
      return channel;
    },

    //
    // nsIFactory interface implementation
    //

    createInstance: function(outer, iid) {
      if (outer) {
        throw Cr.NS_ERROR_NO_AGGREGATION;
      }
      return self.QueryInterface(iid);
    }
  };


  function registerFactory() {
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
        .registerFactory(self.classID, self.classDescription,
                         self.contractID, self);
  }

  ProcessEnvironment.addStartupFunction(
      Environment.LEVELS.INTERFACE,
      function () {
        try {
          registerFactory();
        } catch (e if e.result === Cr.NS_ERROR_FACTORY_EXISTS) {
          // When upgrading restartless the old factory might still exist.
          Utils.runAsync(registerFactory);
        }
      });

  function unregisterFactory() {
    let registrar = Components.manager
        .QueryInterface(Ci.nsIComponentRegistrar);
    let {Utils} = ScriptLoader.importModule("lib/utils");

    // This needs to run asynchronously, see Mozilla bug 753687
    Utils.runAsync(function() {
      registrar.unregisterFactory(self.classID, self);
    });
  }
  ProcessEnvironment.addShutdownFunction(Environment.LEVELS.INTERFACE,
                                         unregisterFactory);

  return self;
}());
