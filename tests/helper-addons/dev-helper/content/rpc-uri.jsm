/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RPC Dev Helper - A helper add-on for RequestPolicy development.
 * Copyright (c) 2015 Martin Kimmerle
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

var EXPORTED_SYMBOLS = ["CustomUri"];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const destinationURI = "http://www.maindomain.test/destination.html";


var CustomUri = (function () {
  var self = {
    classDescription: "RPC Protocol",
    contractID: "@mozilla.org/network/protocol;1?name=rpc",
    classID: Components.ID("{2d668f50-d8af-11e4-8830-0800200c9a66}"),
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler]),

    scheme: "rpc",
    protocolFlags: Ci.nsIProtocolHandler.URI_NORELATIVE |
                   Ci.nsIProtocolHandler.URI_NOAUTH |
                   Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,


    newURI: function (aSpec, aOriginCharset, aBaseURI) {
      var uri = Cc["@mozilla.org/network/simple-uri;1"]
          .createInstance(Ci.nsIURI);
      uri.spec = aSpec;
      return uri;
    },

    newChannel: function (aURI) {
      var path = aURI.path;
      var uri = Services.io.newURI(destinationURI + "?" + path, null, null);
      var channel = Services.io.newChannelFromURI(uri, null)
          .QueryInterface(Ci.nsIHttpChannel);
      return channel;
    },

    //
    // nsIFactory interface implementation
    //

    createInstance: function (outer, iid) {
      if (outer) {
        throw Cr.NS_ERROR_NO_AGGREGATION;
      }
      return self.QueryInterface(iid);
    },

    startup: registerFactory,
    shutdown: unregisterFactory
  };


  function registerFactory() {
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
        .registerFactory(self.classID, self.classDescription,
                         self.contractID, self);
  }

  function unregisterFactory() {
    Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
        .unregisterFactory(self.classID, self);
  }

  return self;
})();
