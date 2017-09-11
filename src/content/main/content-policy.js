/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
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

import {Logger} from "lib/logger";
import {NormalRequest, RedirectRequest} from "lib/request";
import {Utils} from "lib/utils";
import {RequestProcessor} from "lib/request-processor";
import {Environment, MainEnvironment} from "lib/environment";

let catMan = Cc["@mozilla.org/categorymanager;1"].
    getService(Ci.nsICategoryManager);

// =============================================================================
// constants
// =============================================================================

const CP_OK = Ci.nsIContentPolicy.ACCEPT;
const CP_REJECT = Ci.nsIContentPolicy.REJECT_SERVER;

// =============================================================================
// RPContentPolicy
// =============================================================================

export var RPContentPolicy = (function() {
  let self = {};

  const XPCOM_CATEGORIES = ["content-policy"];

  self.classDescription = "RequestPolicy ContentPolicy Implementation";
  self.classID = ComponentsID("{d734b30a-996c-4805-be24-25a0738249fe}");
  self.contractID = "@requestpolicy.org/content-policy;1";

  /**
   * Registers the content policy on startup.
   */
  function register() {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).
        registerFactory(self.classID, self.classDescription, self.contractID,
            self);

    for (let category of XPCOM_CATEGORIES) {
      catMan.addCategoryEntry(category, self.contractID, self.contractID, false,
          true);
    }
  }

  MainEnvironment.addStartupFunction(
      Environment.LEVELS.INTERFACE,
      function() {
        try {
          register();
        } catch (e) {
          if (e.result === Cr.NS_ERROR_FACTORY_EXISTS) {
            // When upgrading restartless the old factory might still exist.
            Utils.runAsync(register);
          } else {
            console.error("Failed to register factory! Details:");
            console.dir(e);
          }
        }
      });

  let unregister = (function() {
    return function() {
      Logger.debug("shutting down RPContentPolicy...");

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
      var finalReturnValue = CP_OK;

      // Actually create the final function, as it is described
      // above.
      self.shouldLoad = () => finalReturnValue;

      let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);

      for (let category of XPCOM_CATEGORIES) {
        catMan.deleteCategoryEntry(category, self.contractID, false);
      }

      // This needs to run asynchronously, see bug 753687
      Utils.runAsync(function() {
        registrar.unregisterFactory(self.classID, self);
      });
    };
  }());

  MainEnvironment.addShutdownFunction(Environment.LEVELS.INTERFACE,
                                         unregister);

  // ---------------------------------------------------------------------------
  // nsISupports interface implementation
  // ---------------------------------------------------------------------------

  self.QueryInterface = XPCOMUtils.generateQI([Ci.nsIContentPolicy,
                                               Ci.nsIObserver,
                                               Ci.nsIFactory,
                                               Ci.nsISupportsWeakReference]);

  // ---------------------------------------------------------------------------
  // nsIContentPolicy interface implementation
  // ---------------------------------------------------------------------------

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

  self.shouldProcess = () => CP_OK;

  // ---------------------------------------------------------------------------
  // nsIFactory interface implementation
  // ---------------------------------------------------------------------------

  self.createInstance = function(outer, iid) {
    if (outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return self.QueryInterface(iid);
  };

  return self;
}());

// =============================================================================
// RPChannelEventSink
// =============================================================================

export var RPChannelEventSink = (function() {
  let self = {};

  const XPCOM_CATEGORIES = ["net-channel-event-sinks"];

  self.classDescription = "RequestPolicy ChannelEventSink Implementation";
  self.classID = ComponentsID("{dc6e2000-2ff0-11e6-bdf4-0800200c9a66}");
  self.contractID = "@requestpolicy.org/net-channel-event-sinks;1";

  /**
   * Registers the channel event sink on startup.
   */
  function register() {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).
        registerFactory(self.classID, self.classDescription, self.contractID,
            self);

    for (let category of XPCOM_CATEGORIES) {
      catMan.addCategoryEntry(category, self.contractID, self.contractID, false,
          true);
    }
  }

  MainEnvironment.addStartupFunction(
      Environment.LEVELS.INTERFACE,
      function() {
        try {
          register();
        } catch (e) {
          if (e.result === Cr.NS_ERROR_FACTORY_EXISTS) {
            // When upgrading restartless the old factory might still exist.
            Utils.runAsync(register);
          } else {
            console.error("Failed to register factory! Details:");
            console.dir(e);
          }
        }
      });

  let unregister = (function() {
    return function unregister() {
      Logger.debug("shutting down RPChannelEventSink...");

      self.asyncOnChannelRedirect = () => {};

      let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);

      for (let category of XPCOM_CATEGORIES) {
        catMan.deleteCategoryEntry(category, self.contractID, false);
      }

      // This needs to run asynchronously, see bug 753687
      Utils.runAsync(function() {
        registrar.unregisterFactory(self.classID, self);
      });
    };
  }());

  MainEnvironment.addShutdownFunction(Environment.LEVELS.INTERFACE, unregister);

  // ---------------------------------------------------------------------------
  // nsISupports interface implementation
  // ---------------------------------------------------------------------------

  self.QueryInterface = XPCOMUtils.generateQI([Ci.nsIChannelEventSink,
                                               Ci.nsIObserver,
                                               Ci.nsIFactory,
                                               Ci.nsISupportsWeakReference]);

  // ---------------------------------------------------------------------------
  // nsIChannelEventSink interface implementation
  // ---------------------------------------------------------------------------

  const CES_ACCEPT = Cr.NS_OK;
  const CES_REJECT = Cr.NS_ERROR_FAILURE;

  /**
   * @param  {nsIChannel} aOldChannel
   * @param  {nsIChannel} aNewChannel
   * @param  {integer} aFlags
   * @param  {nsIAsyncVerifyRedirectCallback} aCallback
   */
  self.asyncOnChannelRedirect = function(aOldChannel, aNewChannel, aFlags,
      aCallback) {
    let request = new RedirectRequest(aOldChannel, aNewChannel, aFlags);
    let rv = RequestProcessor.processUrlRedirection(request);
    let result = rv === CP_REJECT ? CES_REJECT : CES_ACCEPT;
    aCallback.onRedirectVerifyCallback(result);
  };

  // ---------------------------------------------------------------------------
  // nsIFactory interface implementation
  // ---------------------------------------------------------------------------

  self.createInstance = function(outer, iid) {
    if (outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return self.QueryInterface(iid);
  };

  return self;
}());
