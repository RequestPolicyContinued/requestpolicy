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

/* global Components */
const {interfaces: Ci, results: Cr, utils: Cu} = Components;

/* exported AboutRequestPolicy */
this.EXPORTED_SYMBOLS = ["AboutRequestPolicy"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
let {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {Environment, ProcessEnvironment} = importModule("lib/environment");
let {Utils} = importModule("lib/utils");

//==============================================================================
// utilities, constants
//==============================================================================

const FILENAMES = {
  "basicprefs": "basicprefs.html",
  "advancedprefs": "advancedprefs.html",
  "yourpolicy": "yourpolicy.html",
  "defaultpolicy": "defaultpolicy.html",
  "subscriptions": "subscriptions.html",
  "oldrules": "oldrules.html",
  "setup": "setup.html"
};

function getURI(aURI) {
  let id;
  let index = aURI.path.indexOf("?");
  if (index >= 0 && aURI.path.length > index) {
    id = aURI.path.substr(index + 1);
  }
  if (!id || !(id in FILENAMES)) {
    id = "basicprefs";
  }
  return "chrome://rpcontinued/content/settings/" + FILENAMES[id];
}

//==============================================================================
// AboutRequestPolicy
//==============================================================================

var AboutRequestPolicy = (function() {
  let self = {};

  self.classDescription = "about:requestpolicy";
  self.contractID = "@mozilla.org/network/protocol/about;1?what=requestpolicy";
  self.classID = Components.ID("{77d4be21-6a28-4b91-9886-15ccd83795e8}");
  self.QueryInterface = XPCOMUtils.generateQI([Ci.nsIAboutModule]);

  self.getURIFlags = function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  };

  self.newChannel = function(aURI) {
    let uri = getURI(aURI);
    let channel = Services.io.newChannel(uri, null, null);
    channel.originalURI = aURI;
    return channel;
  };

  //----------------------------------------------------------------------------
  // nsIFactory interface implementation
  //----------------------------------------------------------------------------

  self.createInstance = function(outer, iid) {
    if (outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return self.QueryInterface(iid);
  };

  function registerFactory() {
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
        .registerFactory(self.classID, self.classDescription,
                         self.contractID, self);
  }

  ProcessEnvironment.addStartupFunction(
      Environment.LEVELS.INTERFACE,
      function() {
        try {
          registerFactory();
        } catch (e) {
          if (e.result === Cr.NS_ERROR_FACTORY_EXISTS) {
            // When upgrading restartless the old factory might still exist.
            Utils.runAsync(registerFactory);
          } else {
            Cu.reportError(e);
          }
        }
      });

  function unregisterFactory() {
    let registrar = Components.manager
        .QueryInterface(Ci.nsIComponentRegistrar);

    // This needs to run asynchronously, see Mozilla bug 753687
    Utils.runAsync(function() {
      registrar.unregisterFactory(self.classID, self);
    });
  }
  ProcessEnvironment.addShutdownFunction(Environment.LEVELS.INTERFACE,
                                         unregisterFactory);

  return self;
}());
