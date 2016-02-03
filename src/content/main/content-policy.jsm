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

/* global Components */
const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

/* exported PolicyImplementation */
this.EXPORTED_SYMBOLS = ["PolicyImplementation"];

let {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {C} = importModule("lib/utils/constants");
let {Logger} = importModule("lib/logger");
let {NormalRequest} = importModule("lib/request");
let {Utils} = importModule("lib/utils");
let {RequestProcessor} = importModule("lib/request-processor");
let {Environment, ProcessEnvironment} = importModule("lib/environment");

//==============================================================================
// PolicyImplementation
//==============================================================================

// TODO: implement nsIChannelEventSink to catch redirects as Adblock Plus does.
var PolicyImplementation = (function() {
  let self = {};

  const XPCOM_CATEGORIES = ["content-policy"];

  self.classDescription = "RequestPolicy ContentPolicy Implementation";
  self.classID = Components.ID("{d734b30a-996c-4805-be24-25a0738249fe}");
  self.contractID = "@requestpolicy.org/rpcontinued-service;1";

  /**
   * Registers the content policy on startup.
   */
  function register() {
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
                      .registerFactory(self.classID, self.classDescription,
                                       self.contractID, self);

    let catMan = Utils.categoryManager;
    for (let category of XPCOM_CATEGORIES) {
      catMan.addCategoryEntry(category, self.contractID, self.contractID, false,
          true);
    }

    if (!self.mimeService) {
      // self.rejectCode = typeof(/ /) == "object" ? -4 : -3;
      self.rejectCode = Ci.nsIContentPolicy.REJECT_SERVER;
      self.mimeService =
          Cc["@mozilla.org/uriloader/external-helper-app-service;1"]
          .getService(Ci.nsIMIMEService);
    }
  }

  ProcessEnvironment.addStartupFunction(
      Environment.LEVELS.INTERFACE,
      function() {
        try {
          register();
        } catch (e) {
          if (e.result === Cr.NS_ERROR_FACTORY_EXISTS) {
            // When upgrading restartless the old factory might still exist.
            Utils.runAsync(register);
          } else {
            Cu.reportError(e);
          }
        }
      });

  function unregister() {
    Logger.dump("shutting down PolicyImplementation...");

    // Below the shouldLoad function is replaced by a new one
    // which always allows *all* requests.
    //
    // What's the reason?
    // ------------------
    // The function for unregistering, which is `unregisterFactory`,
    // has to be called async; this means that the unregistering
    // will be done at a later time. However, it's necessary to
    // disable blocking *right now*.
    //
    // Why is that necessary?
    // ----------------------
    // It's possible (or always true) that async functions
    // get called *after* the addon finished shutting down.
    // After the shutdown RequestPolicy's modules and
    // functions can't be used anymore, the modules have
    // been unloaded already. There might be still some
    // objects or closures, but it's unreliable to use
    // them.
    // However, the shouldLoad function needs many of
    // RequestPolicy's other modules and functions. So any
    // call to RP's `shouldLoad` might cause exceptions,
    // given that the call happens between now and the
    // time when the factory is actually unregistered.

    // Before defining the new shouldLoad ...
    // ... save the return value in the closure of this function.
    //     Similarly like described above this is necessary
    //     because the `C` variable is not available anymore
    //     after RP has been shut down.
    var finalReturnValue = C.CP_OK;

    // Actually create the final function, as it is described
    // above.
    self.shouldLoad = () => finalReturnValue;

    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    let catMan = Utils.categoryManager;

    for (let category of XPCOM_CATEGORIES) {
      catMan.deleteCategoryEntry(category, self.contractID, false);
    }

    // This needs to run asynchronously, see bug 753687
    Utils.runAsync(function() {
      registrar.unregisterFactory(self.classID, self);
    });
  }

  ProcessEnvironment.addShutdownFunction(Environment.LEVELS.INTERFACE,
                                         unregister);

  //----------------------------------------------------------------------------
  // nsISupports interface implementation
  //----------------------------------------------------------------------------

  self.QueryInterface = XPCOMUtils.generateQI([Ci.nsIContentPolicy,
                                               Ci.nsIObserver,
                                               Ci.nsIFactory,
                                               Ci.nsISupportsWeakReference]);

  //----------------------------------------------------------------------------
  // nsIContentPolicy interface implementation
  //----------------------------------------------------------------------------

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

  self.shouldProcess = () => C.CP_OK;

  //----------------------------------------------------------------------------
  // nsIFactory interface implementation
  //----------------------------------------------------------------------------

  self.createInstance = function(outer, iid) {
    if (outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return self.QueryInterface(iid);
  };

  return self;
}());
