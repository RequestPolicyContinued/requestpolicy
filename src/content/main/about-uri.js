/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

import {Environment, MainEnvironment} from "content/lib/environment";
import * as Utils from "content/lib/utils/misc-utils";

// =============================================================================
// utilities, constants
// =============================================================================

const FILENAMES = {
  "basicprefs": "basicprefs.html",
  "advancedprefs": "advancedprefs.html",
  "yourpolicy": "yourpolicy.html",
  "defaultpolicy": "defaultpolicy.html",
  "subscriptions": "subscriptions.html",
  "oldrules": "oldrules.html",
  "setup": "setup.html",
  "experimental": "experimental.html",
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
  let spec = "chrome://rpcontinued/content/settings/" + FILENAMES[id];
  return Services.io.newURI(spec, null, null);
}

// =============================================================================
// AboutRequestPolicy
// =============================================================================

export const AboutRequestPolicy = (function() {
  let self = {};

  self.classDescription = "about:requestpolicy";
  self.contractID = "@mozilla.org/network/protocol/about;1?what=requestpolicy";
  // eslint-disable-next-line new-cap
  self.classID = ComponentsID("{77d4be21-6a28-4b91-9886-15ccd83795e8}");
  self.QueryInterface = XPCOMUtils.generateQI([Ci.nsIAboutModule]);

  self.getURIFlags = function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  };

  /**
   * @param {nsIURI} aURI
   * @param {nsILoadInfo} aLoadInfo Only available on Gecko 36+.
   * @return {nsIChannel}
   */
  self.newChannel = function(aURI, aLoadInfo) {
    let uri = getURI(aURI);
    let channel;
    if (LegacyApi.miscInfos.isGeckoVersionAtLeast("48.0a1")) {
      // newChannelFromURIWithLoadInfo is available since Gecko 48.
      channel = Services.io.newChannelFromURIWithLoadInfo(uri, aLoadInfo);
    } else {
      // newChannel is obsolete since Gecko 48 (Bug 1254752)
      channel = Services.io.newChannelFromURI(uri);
    }
    channel.originalURI = aURI;
    return channel;
  };

  // ---------------------------------------------------------------------------
  // nsIFactory interface implementation
  // ---------------------------------------------------------------------------

  self.createInstance = function(outer, iid) {
    if (outer) {
      // eslint-disable-next-line no-throw-literal
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    // eslint-disable-next-line new-cap
    return self.QueryInterface(iid);
  };

  function registerFactory() {
    // eslint-disable-next-line new-cap
    Cm.QueryInterface(Ci.nsIComponentRegistrar)
        .registerFactory(self.classID, self.classDescription,
                         self.contractID, self);
  }

  MainEnvironment.addStartupFunction(
      Environment.LEVELS.INTERFACE,
      function() {
        try {
          registerFactory();
        } catch (e) {
          if (e.result === Cr.NS_ERROR_FACTORY_EXISTS) {
            // When upgrading restartless the old factory might still exist.
            Utils.runAsync(registerFactory);
          } else {
            console.error("Failed to register factory! Details:");
            console.dir(e);
          }
        }
      });

  function unregisterFactory() {
    // eslint-disable-next-line new-cap
    let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);

    // This needs to run asynchronously, see Mozilla bug 753687
    Utils.runAsync(function() {
      registrar.unregisterFactory(self.classID, self);
    });
  }
  MainEnvironment.addShutdownFunction(Environment.LEVELS.INTERFACE,
                                         unregisterFactory);

  return self;
})();
