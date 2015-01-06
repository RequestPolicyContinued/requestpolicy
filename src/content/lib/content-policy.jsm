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
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["PolicyImplementation"];

let globalScope = this;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/utils/constants",
  "lib/logger",
  "lib/request",
  "lib/utils",
  "lib/request-processor",
  "lib/process-environment"
], globalScope);


// TODO: implement nsIChannelEventSink to catch redirects as Adblock Plus does.
let PolicyImplementation = (function() {
  let xpcom_categories = ["content-policy"];

  let self = {
    classDescription: "RequestPolicy JavaScript XPCOM Component",
    classID:          Components.ID("{14027e96-1afb-4066-8846-e6c89b5faf3b}"),
    contractID:       "@requestpolicy.com/requestpolicy-service;1"
  };

  /**
   * Registers the content policy on startup.
   */
  ProcessEnvironment.enqueueStartupFunction(function() {
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
                      .registerFactory(self.classID, self.classDescription,
                                       self.contractID, self);

    let catMan = Utils.categoryManager;
    for each (let category in xpcom_categories) {
      catMan.addCategoryEntry(category, self.contractID, self.contractID, false,
          true);
    }

    if (!self.mimeService) {
      // self.rejectCode = typeof(/ /) == "object" ? -4 : -3;
      self.rejectCode = Ci.nsIContentPolicy.REJECT_SERVER;
      self.mimeService =
          Cc['@mozilla.org/uriloader/external-helper-app-service;1']
          .getService(Ci.nsIMIMEService);
    }
  });


  ProcessEnvironment.pushShutdownFunction(function() {
    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    let catMan = Utils.categoryManager;

    for (let category in xpcom_categories) {
      catMan.deleteCategoryEntry(category, self.contractID, false);
    }

    // This needs to run asynchronously, see bug 753687
    Utils.runAsync(function() {
      registrar.unregisterFactory(self.classID, self);
    });
  });

  //
  // nsISupports interface implementation
  //

  self.QueryInterface = XPCOMUtils.generateQI([Ci.nsIContentPolicy,
                                               Ci.nsIObserver,
                                               Ci.nsIFactory,
                                               Ci.nsISupportsWeakReference]);

  //
  // nsIContentPolicy interface implementation
  //

  // https://developer.mozilla.org/en/nsIContentPolicy

  self.shouldLoad = function(aContentType, aContentLocation, aRequestOrigin,
      aContext, aMimeTypeGuess, aExtra, aRequestPrincipal) {
    var request = new NormalRequest(
        aContentType, aContentLocation, aRequestOrigin, aContext,
        aMimeTypeGuess, aExtra, aRequestPrincipal);
    return RequestProcessor.process(request);
    // TODO: implement the following
    // return request.shouldLoad(aContentType, aContentLocation, aRequestOrigin,
    //     aContext, aMimeTypeGuess, aExtra, aRequestPrincipal);
  };

  self.shouldProcess = (() => C.CP_OK);

  //
  // nsIFactory interface implementation
  //

  self.createInstance = function(outer, iid) {
    if (outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return self.QueryInterface(iid);
  };

  return self;
}());
