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

/* global Components */
const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

/* exported CustomUri */
/* exported EXPORTED_SYMBOLS */
var EXPORTED_SYMBOLS = ["CustomUri"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
let {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

// =============================================================================
// CustomUri
// =============================================================================

var CustomUri = (function() {
  let self = {};

  // A page with no other resources
  const DESTINATION_URI = "http://www.maindomain.test/" +
      "page-without-resources.html";

  self.classDescription = "RPC Protocol";
  self.contractID = "@mozilla.org/network/protocol;1?name=rpc";
  self.classID = Components.ID("{2d668f50-d8af-11e4-8830-0800200c9a66}");
  self.QueryInterface = XPCOMUtils.generateQI([Ci.nsIProtocolHandler]);

  self.scheme = "rpc";
  self.protocolFlags = Ci.nsIProtocolHandler.URI_NORELATIVE |
                       Ci.nsIProtocolHandler.URI_NOAUTH |
                       Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE;

  self.newURI = function(aSpec, aOriginCharset, aBaseURI) {
    var uri = Cc["@mozilla.org/network/simple-uri;1"]
        .createInstance(Ci.nsIURI);
    uri.spec = aSpec;
    return uri;
  };

  self.newChannel = function(aURI) {
    var path = aURI.path;
    var uri = Services.io.newURI(DESTINATION_URI + "?" + path, null, null);
    var channel = Services.io.newChannelFromURI(uri, null)
        .QueryInterface(Ci.nsIHttpChannel);
    return channel;
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

  self.startup = registerFactory;
  self.shutdown = unregisterFactory;

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
}());
