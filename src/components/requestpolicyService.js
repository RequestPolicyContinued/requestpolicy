/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

const CI = Components.interfaces;
const CC = Components.classes;

const CP_OK = CI.nsIContentPolicy.ACCEPT;
const CP_NOP = function() {
  return CP_OK;
};
const CP_REJECT = CI.nsIContentPolicy.REJECT_SERVER;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Scope for imported modules.
if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

function RequestPolicyService() {
  this.wrappedJSObject = this;
}

RequestPolicyService.prototype = {
  classDescription : "RequestPolicy JavaScript XPCOM Component",
  classID : Components.ID("{14027e96-1afb-4066-8846-e6c89b5faf3b}"),
  contractID : "@requestpolicy.com/requestpolicy-service;1",
  _xpcom_categories : [{
        category : "app-startup"
      }, {
        category : "content-policy"
      }],
  QueryInterface : XPCOMUtils.generateQI([CI.nsIRequestPolicy, CI.nsIObserver,
      CI.nsIContentPolicy]),

  /* Factory that creates a singleton instance of the component */
  _xpcom_factory : {
    createInstance : function() {
      if (RequestPolicyService.instance == null) {
        RequestPolicyService.instance = new RequestPolicyService();
      }
      return RequestPolicyService.instance;
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // Internal Data
  // /////////////////////////////////////////////////////////////////////////

  _blockingDisabled : false,

  _rejectedRequests : {},
  _allowedRequests : {},

  _blockedRedirects : {},

  _prefService : null,
  _rootPrefs : null,

  _historyRequests : {},
  _submittedForms : {},
  _clickedLinks : {},

  _requestObservers : [],

  _uriIdentificationLevel : 0,

  /**
   * Number of elapsed milliseconds from the time of the last shouldLoad() call
   * at which the cached results of the last shouldLoad() call are discarded.
   * 
   * @type Number
   */
  _lastShouldLoadCheckTimeout : 200,

  // Calls to shouldLoad appear to be repeated, so successive repeated calls and
  // their result (accept or reject) are tracked to avoid duplicate processing
  // and duplicate logging.
  /**
   * Object that caches the last shouldLoad
   */
  _lastShouldLoadCheck : {
    "origin" : null,
    "destination" : null,
    "time" : 0,
    "result" : null
  },

  _temporarilyAllowedOriginsCount : 0,
  _temporarilyAllowedDestinationsCount : 0,
  _temporarilyAllowedOriginsToDestinationsCount : 0,

  _temporarilyAllowedOrigins : {},
  _temporarilyAllowedDestinations : {},
  _temporarilyAllowedOriginsToDestinations : {},

  _allowedOrigins : {},
  _allowedDestinations : {},
  _allowedOriginsToDestinations : {},

  _prefNameToObjectMap : null,

  _compatibilityRules : [],

  // /////////////////////////////////////////////////////////////////////////
  // Utility
  // /////////////////////////////////////////////////////////////////////////

  _init : function() {
    this._loadLibraries();
    this._initContentPolicy();
    this._register();
    this._initializePrefSystem();
    // Note that we don't load user preferences at this point because the user
    // preferences may not be ready. If we tried right now, we may get the
    // default preferences.
  },

  _initializeExtensionCompatibility : function() {
    if (this._compatibilityRules.length != 0) {
      return;
    }
    var em = Components.classes["@mozilla.org/extensions/manager;1"]
        .getService(Components.interfaces.nsIExtensionManager);
    var ext;

    // TODO: Don't add the rules if the extension is installed but disabled.

    // Adblock Plus
    if (ext = em.getItemForID("{d10d0bf8-f5b5-c8b4-a8b2-2b9879e08c5d}")) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Extension detected: " + ext.name);
      this._compatibilityRules.push(["http://easylist.adblockplus.org/",
          "http://adblockplus.mozdev.org/easylist/", ext.name]);
    }
    // Greasefire
    if (ext = em.getItemForID("greasefire@skrul.com")) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Extension detected: " + ext.name);
      this._compatibilityRules.push(["file://", "http://userscripts.org/",
          ext.name]);
      this._compatibilityRules.push(["file://",
          "http://static.userscripts.org/", ext.name]);
    }
  },

  _initializeApplicationCompatibility : function() {
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
        .getService(Components.interfaces.nsIXULAppInfo);

    // Mozilla updates (doing this for all applications, not just individual
    // applications from the Mozilla community that I'm aware of).
    // At least the http url is needed for Firefox updates, adding the https
    // one as well to be safe.
    this._compatibilityRules.push(["http://download.mozilla.org/", null,
        appInfo.vendor]);
    this._compatibilityRules.push(["https://download.mozilla.org/", null,
        appInfo.vendor]);

    // Flock
    if (appInfo.ID == "{a463f10c-3994-11da-9945-000d60ca027b}") {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Application detected: " + appInfo.vendor);
      this._compatibilityRules.push(["about:myworld", "http://www.flock.com/",
          appInfo.vendor]);
      this._compatibilityRules.push(["about:flock", null, appInfo.vendor]);
      this._compatibilityRules.push(["http://www.flock.com/rss",
          "http://feeds.feedburner.com/flock", appInfo.vendor]);
      this._compatibilityRules.push(["http://feeds.feedburner.com/",
          "http://www.flock.com/", appInfo.vendor]);
    }
  },

  _syncFromPrefs : function() {
    // Load the logging preferences before the others.
    this._updateLoggingSettings();
    this._uriIdentificationLevel = this.prefs
        .getIntPref("uriIdentificationLevel");
    // origins
    this._allowedOrigins = this._getPreferenceObj("allowedOrigins");
    requestpolicy.mod.Logger.vardump(this._allowedOrigins,
        "this._allowedOrigins");
    // destinations
    this._allowedDestinations = this._getPreferenceObj("allowedDestinations");
    requestpolicy.mod.Logger.vardump(this._allowedDestinations,
        "this._allowedDestinations");
    // origins to destinations
    this._allowedOriginsToDestinations = this
        ._getPreferenceObj("allowedOriginsToDestinations");
    requestpolicy.mod.Logger.vardump(this._allowedOriginsToDestinations,
        "this._allowedOriginsToDestinations");

    this._prefNameToObjectMap = {
      "allowedOrigins" : this._allowedOrigins,
      "allowedDestinations" : this._allowedDestinations,
      "allowedOriginsToDestinations" : this._allowedOriginsToDestinations
    };

    // Disable prefetch.
    if (!this._blockingDisabled) {
      if (this._rootPrefs.getBoolPref("network.prefetch-next")) {
        this._rootPrefs.setBoolPref("network.prefetch-next", false);
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Disabled prefetch.");
      }
      // network.dns.disablePrefetch only exists starting in Firefox 3.1 (and it
      // doesn't have a default value, at least in 3.1b2, but if and when it
      // does have a default it will be false).
      if (!this._rootPrefs.prefHasUserValue("network.dns.disablePrefetch")) {
        this._rootPrefs.setBoolPref("network.dns.disablePrefetch", true);
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Disabled DNS prefetch.");
      }
    }

    // Clean up old, unused prefs (removed in 0.2.0).
    deletePrefs = ["temporarilyAllowedOrigins",
        "temporarilyAllowedDestinations",
        "temporarilyAllowedOriginsToDestinations"];
    for (var i = 0; i < deletePrefs.length; i++) {
      if (this.prefs.prefHasUserValue(deletePrefs[i])) {
        this.prefs.clearUserPref(deletePrefs[i]);
      }
    }
    this._prefService.savePrefFile(null);
  },

  _updateLoggingSettings : function() {
    requestpolicy.mod.Logger.enabled = this.prefs.getBoolPref("log");
    requestpolicy.mod.Logger.level = this.prefs.getIntPref("log.level");
    requestpolicy.mod.Logger.types = this.prefs.getIntPref("log.types");
  },

  _register : function() {
    var os = CC['@mozilla.org/observer-service;1']
        .getService(CI.nsIObserverService);
    os.addObserver(this, "http-on-examine-response", false);
    os.addObserver(this, "http-on-modify-request", false);
    os.addObserver(this, "xpcom-shutdown", false);
    os.addObserver(this, "profile-after-change", false);
  },

  _unregister : function() {
    try {
      var os = CC['@mozilla.org/observer-service;1']
          .getService(CI.nsIObserverService);
      os.removeObserver(this, "http-on-examine-response");
      os.removeObserver(this, "http-on-modify-request");
      os.removeObserver(this, "xpcom-shutdown");
      os.removeObserver(this, "profile-after-change");
    } catch (e) {
      requestpolicy.mod.Logger.dump(e + " while unregistering.");
    }
  },

  _shutdown : function() {
    this._unregister();
  },

  _initializePrefSystem : function() {
    // Get the preferences branch and setup the preferences observer.
    this._prefService = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService);

    this.prefs = this._prefService.getBranch("extensions.requestpolicy.")
        .QueryInterface(CI.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);

    this._rootPrefs = this._prefService.getBranch("")
        .QueryInterface(CI.nsIPrefBranch2);
  },

  /**
   * Take necessary actions when preferences are updated.
   * 
   * @paramString{} prefName NAme of the preference that was updated.
   */
  _updatePref : function(prefName) {
    switch (prefName) {
      case "log" :
      case "log.level" :
      case "log.types" :
        this._updateLoggingSettings();
        break;
      case "uriIdentificationLevel" :
        this._uriIdentificationLevel = this.prefs
            .getIntPref("uriIdentificationLevel");
        break;
      default :
        break;
    }
  },

  _loadLibraries : function() {
    // Wasn't able to define a resource in chrome.manifest, so need to use file
    // paths to load modules. This method of doing it is described at
    // http://developer.mozilla.org/en/Using_JavaScript_code_modules
    // but this is using __LOCATION__ instead.
    // The reason a resources defined in chrome.manifest isn't working is likely
    // because at this point chrome.manifest hasn't been loaded yet. See
    // http://groups.google.com/group/mozilla.dev.tech.xpcom/browse_thread/thread/6a8ea7f803ac720a
    // for more info.
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService);
    var resProt = ioService.getProtocolHandler("resource")
        .QueryInterface(Components.interfaces.nsIResProtocolHandler);
    var extensionDir = __LOCATION__.parent.parent;
    var modulesDir = extensionDir.clone();
    modulesDir.append("modules");
    var resourceURI = ioService.newFileURI(modulesDir);
    resProt.setSubstitution("requestpolicy", resourceURI);

    Components.utils.import("resource://requestpolicy/Logger.jsm",
        requestpolicy.mod);
    Components.utils.import("resource://requestpolicy/DomainUtil.jsm",
        requestpolicy.mod);
  },

  _examineHttpResponse : function(observedSubject) {
    // TODO: Make user aware of blocked headers so they can allow them if
    // desired.

    var httpChannel = observedSubject
        .QueryInterface(Components.interfaces.nsIHttpChannel);

    var headerType;
    var dest;
    try {
      // If there is no such header, getResponseHeader() will throw
      // NS_ERROR_NOT_AVAILABLE. If there is more than header, the last one is
      // the one that will be used.
      headerType = "Location";
      dest = httpChannel.getResponseHeader(headerType);
    } catch (e) {
      // No location header. Look for a Refresh header.
      try {
        headerType = "Refresh";
        dest = httpChannel.getResponseHeader(headerType);
        var parts = requestpolicy.mod.DomainUtil
            .parseRefresh(metaTags[i].content);
        // TODO: Handle a delay value in the refresh.
        dest = parts[1];
      } catch (e) {
        // No Location header or Refresh header.
        return;
      }
    }

    var origin = httpChannel.name;

    if (this.isAllowedRedirect(origin, dest)) {
      requestpolicy.mod.Logger.warning(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT, "** ALLOWED ** '"
              + headerType + "' header to <" + dest + "> " + "from <" + origin
              + ">. Same hosts or allowed origin/destination.");
      this._recordAllowedRequest(origin, dest);

      // If this was a link click or a form submission, we register an
      // additional click/submit with the original source but with a new
      // destination of the target of the redirect. This is because future
      // requests (such as using back/forward) might show up as directly from
      // the initial origin to the ultimate redirected destination.
      if (httpChannel.referrer) {
        var realOrigin = httpChannel.referrer.spec;

        if (this._clickedLinks[realOrigin]
            && this._clickedLinks[realOrigin][origin]) {
          requestpolicy.mod.Logger.warning(
              requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
              "This redirect was from a link click."
                  + " Registering an additional click to <" + dest + "> "
                  + "from <" + realOrigin + ">");
          this.registerLinkClicked(realOrigin, dest);

        } else if (this._submittedForms[realOrigin]
            && this._submittedForms[realOrigin][origin.split("?")[0]]) {
          requestpolicy.mod.Logger.warning(
              requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
              "This redirect was from a form submission."
                  + " Registering an additional form submission to <" + dest
                  + "> " + "from <" + realOrigin + ">");
          this.registerFormSubmitted(realOrigin, dest);
        }
      }

      return;
    }

    // The header isn't allowed, so remove it.
    try {
      if (!this._blockingDisabled) {
        httpChannel.setResponseHeader(headerType, "", false);
        this._recordRejectedRequest(origin, dest);
        this._blockedRedirects[origin] = dest;
      }
      requestpolicy.mod.Logger.warning(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT, "** BLOCKED ** '"
              + headerType + "' header to <" + dest + ">"
              + " found in response from <" + origin + ">");
    } catch (e) {
      requestpolicy.mod.Logger.severe(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT, "Failed removing "
              + "'" + headerType + "' header to <" + dest + ">"
              + "  in response from <" + origin + ">." + e);
    }
  },

  /**
   * Currently this just looks for prefetch requests that are getting through
   * which we currently can't stop.
   */
  _examineHttpRequest : function(observedSubject) {
    var httpChannel = observedSubject
        .QueryInterface(Components.interfaces.nsIHttpChannel);
    try {
      // Determine if prefetch requests are slipping through.
      if (httpChannel.getRequestHeader("X-moz") == "prefetch") {
        // Seems to be too late to block it at this point. Calling the
        // cancel(status) method didn't stop it.
        requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_CONTENT,
            "Discovered prefetch request being sent to: " + httpChannel.name);
      }
    } catch (e) {
      // No X-moz header.
    }
  },

  _printAllowedRequests : function() {
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
    requestpolicy.mod.Logger.dump("Allowed Requests");
    for (i in this._allowedRequests) {
      requestpolicy.mod.Logger.dump("\t" + "Origin uri: <" + i + ">");
      for (var j in this._allowedRequests[i]) {
        requestpolicy.mod.Logger.dump("\t\t" + "Dest identifier: <" + j + ">");
        for (var k in this._allowedRequests[i][j]) {
          if (k == "count") {
            continue;
          }
          requestpolicy.mod.Logger.dump("\t\t\t" + k);
        }
      }
    }
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
  },

  _printRejectedRequests : function() {
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
    requestpolicy.mod.Logger.dump("Rejected Requests");
    for (i in this._rejectedRequests) {
      requestpolicy.mod.Logger.dump("\t" + "Origin uri: <" + i + ">");
      for (var j in this._rejectedRequests[i]) {
        requestpolicy.mod.Logger.dump("\t\t" + "Dest identifier: <" + j + ">");
        for (var k in this._rejectedRequests[i][j]) {
          if (k == "count") {
            continue;
          }
          requestpolicy.mod.Logger.dump("\t\t\t" + k);
        }
      }
    }
    requestpolicy.mod.Logger
        .dump("-------------------------------------------------");
  },

  _notifyRequestObserversOfBlockedRequest : function(originUri, destUri) {
    for (var i = 0; i < this._requestObservers.length; i++) {
      if (!this._requestObservers[i]) {
        continue;
      }
      this._requestObservers[i].observeBlockedRequest(originUri, destUri);
    }
  },

  _notifyRequestObserversOfAllowedRequest : function(originUri, destUri) {
    for (var i = 0; i < this._requestObservers.length; i++) {
      if (!this._requestObservers[i]) {
        continue;
      }
      this._requestObservers[i].observeAllowedRequest(originUri, destUri);
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIRequestPolicy interface
  // /////////////////////////////////////////////////////////////////////////

  prefs : null,

  getUriIdentifier : function getUriIdentifier(uri) {
    return requestpolicy.mod.DomainUtil.getIdentifier(uri,
        this._uriIdentificationLevel);
  },

  registerHistoryRequest : function(destinationUrl) {
    var destinationUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil
            .stripFragment(destinationUrl));
    this._historyRequests[destinationUrl] = true;
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "History item requested: <" + destinationUrl + ">.");
  },

  registerFormSubmitted : function registerFormSubmitted(originUrl,
      destinationUrl) {
    var originUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil.stripFragment(originUrl));
    var destinationUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil
            .stripFragment(destinationUrl));

    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Form submitted from <" + originUrl + "> to <" + destinationUrl + ">.");

    // Drop the query string from the destination url because form GET requests
    // will end up with a query string on them when shouldLoad is called, so
    // we'll need to be dropping the query string there.
    destinationUrl = destinationUrl.split("?")[0];

    if (this._submittedForms[originUrl] == undefined) {
      this._submittedForms[originUrl] = {};
    }
    if (this._submittedForms[originUrl][destinationUrl] == undefined) {
      // TODO: See TODO for registerLinkClicked.
      this._submittedForms[originUrl][destinationUrl] = true;
    }
  },

  registerLinkClicked : function registerLinkClicked(originUrl, destinationUrl) {
    var originUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil.stripFragment(originUrl));
    var destinationUrl = requestpolicy.mod.DomainUtil
        .ensureUriHasPath(requestpolicy.mod.DomainUtil
            .stripFragment(destinationUrl));

    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Link clicked from <" + originUrl + "> to <" + destinationUrl + ">.");

    if (this._clickedLinks[originUrl] == undefined) {
      this._clickedLinks[originUrl] = {};
    }
    if (this._clickedLinks[originUrl][destinationUrl] == undefined) {
      // TODO: Possibly set the value to a timestamp that can be used elsewhere
      // to determine if this is a recent click. This is probably necessary as
      // multiple calls to shouldLoad get made and we need a way to allow
      // multiple in a short window of time. Alternately, as it seems to always
      // be in order (repeats are always the same as the last), the last one
      // could be tracked and always allowed (or allowed within a small period
      // of time). This would have the advantage that we could delete items from
      // the _clickedLinks object. One of these approaches would also reduce log
      // clutter, which would be good.
      this._clickedLinks[originUrl][destinationUrl] = true;
    }
  },

  _allowOrigin : function(host, noStore) {
    this._allowedOrigins[host] = true;
    if (!noStore) {
      this._storePreferenceList("allowedOrigins");
    }
  },

  allowOrigin : function allowOrigin(host) {
    this._allowOrigin(host, false);
  },

  allowOriginDelayStore : function allowOriginDelayStore(host) {
    this._allowOrigin(host, true);
  },

  isAllowedOrigin : function isAllowedOrigin(host) {
    return this._allowedOrigins[host] ? true : false;
  },

  temporarilyAllowOrigin : function temporarilyAllowOrigin(host) {
    if (!this._temporarilyAllowedOrigins[host]) {
      this._temporarilyAllowedOriginsCount++;
      this._temporarilyAllowedOrigins[host] = true;
    }
  },

  isTemporarilyAllowedOrigin : function isTemporarilyAllowedOrigin(host) {
    return this._temporarilyAllowedOrigins[host] ? true : false;
  },

  _allowDestination : function(host, noStore) {
    this._allowedDestinations[host] = true;
    if (!noStore) {
      this._storePreferenceList("allowedDestinations");
    }
  },

  allowDestination : function allowDestination(host) {
    this._allowDestination(host, false);
  },

  allowDestinationDelayStore : function allowDestinationDelayStore(host) {
    this._allowDestination(host, true);
  },

  isAllowedDestination : function isAllowedDestination(host) {
    return this._allowedDestinations[host] ? true : false;
  },

  temporarilyAllowDestination : function temporarilyAllowDestination(host) {
    if (!this._temporarilyAllowedDestinations[host]) {
      this._temporarilyAllowedDestinationsCount++;
      this._temporarilyAllowedDestinations[host] = true;
    }
  },

  isTemporarilyAllowedDestination : function isTemporarilyAllowedDestination(
      host) {
    return this._temporarilyAllowedDestinations[host] ? true : false;
  },

  _getCombinedOriginToDestinationIdentifier : function(originIdentifier,
      destIdentifier) {
    return originIdentifier + "|" + destIdentifier;
  },

  _combinedOriginToDestinationIdentifierHasOrigin : function(
      originToDestIdentifier, originIdentifier) {
    return originToDestIdentifier.indexOf(originIdentifier + "|") == 0;
  },

  _combinedOriginToDestinationIdentifierHasDestination : function(
      originToDestIdentifier, destIdentifier) {
    // TODO eliminate false positives
    return originToDestIdentifier.indexOf("|" + destIdentifier) != -1;
  },

  _allowOriginToDestination : function(originIdentifier, destIdentifier,
      noStore) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    this._allowOriginToDestinationByCombinedIdentifier(combinedId, noStore);
  },

  allowOriginToDestination : function allowOriginToDestination(
      originIdentifier, destIdentifier) {
    this._allowOriginToDestination(originIdentifier, destIdentifier, false);
  },

  allowOriginToDestinationDelayStore : function allowOriginToDestinationDelayStore(
      originIdentifier, destIdentifier) {
    this._allowOriginToDestination(originIdentifier, destIdentifier, true);
  },

  _allowOriginToDestinationByCombinedIdentifier : function(combinedId, noStore) {
    this._allowedOriginsToDestinations[combinedId] = true;
    if (!noStore) {
      this._storePreferenceList("allowedOriginsToDestinations");
    }
  },

  isAllowedOriginToDestination : function isAllowedOriginToDestination(
      originIdentifier, destIdentifier) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    return this._allowedOriginsToDestinations[combinedId] ? true : false;
  },

  temporarilyAllowOriginToDestination : function temporarilyAllowOriginToDestination(
      originIdentifier, destIdentifier) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    if (!this._temporarilyAllowedOriginsToDestinations[combinedId]) {
      this._temporarilyAllowedOriginsToDestinationsCount++;
      this._temporarilyAllowedOriginsToDestinations[combinedId] = true;
    }
  },

  isTemporarilyAllowedOriginToDestination : function isTemporarilyAllowedOriginToDestination(
      originIdentifier, destIdentifier) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    return this._temporarilyAllowedOriginsToDestinations[combinedId]
        ? true
        : false;
  },

  revokeTemporaryPermissions : function revokeTemporaryPermissions(host) {
    this._temporarilyAllowedOriginsCount = 0;
    this._temporarilyAllowedOrigins = {};

    this._temporarilyAllowedDestinationsCount = 0;
    this._temporarilyAllowedDestinations = {};

    this._temporarilyAllowedOriginsToDestinationsCount = 0;
    this._temporarilyAllowedOriginsToDestinations = {};
  },

  _forbidOrigin : function(host, noStore) {
    if (this._temporarilyAllowedOrigins[host]) {
      this._temporarilyAllowedOriginsCount--;
      delete this._temporarilyAllowedOrigins[host];
    }
    if (this._allowedOrigins[host]) {
      delete this._allowedOrigins[host];
      if (!noStore) {
        this._storePreferenceList("allowedOrigins");
      }
    }
    this._forbidAllDestinationsFromSingleOrigin(host);
  },

  forbidOrigin : function forbidOrigin(host) {
    this._forbidOrigin(host, false);
  },

  forbidOriginDelayStore : function forbidOriginDelayStore(host) {
    this._forbidOrigin(host, true);
  },

  _forbidDestination : function(host, noStore) {
    if (this._temporarilyAllowedDestinations[host]) {
      this._temporarilyAllowedDestinationsCount--;
      delete this._temporarilyAllowedDestinations[host];
    }
    if (this._allowedDestinations[host]) {
      delete this._allowedDestinations[host];
      if (!noStore) {
        this._storePreferenceList("allowedDestinations");
      }
    }
    this._forbidAllOriginsToSingleDestination(host);
  },

  forbidDestination : function forbidDestination(host) {
    this._forbidDestination(host, false);
  },

  forbidDestinationDelayStore : function forbidDestinationDelayStore(host) {
    this._forbidDestination(host, true);
  },

  _forbidAllDestinationsFromSingleOrigin : function _forbidAllDestinationsFromSingleOrigin(
      host) {
    for (var i in this._allowedOriginsToDestinations) {
      if (this._combinedOriginToDestinationIdentifierHasOrigin(i, host)) {
        this._forbidOriginToDestinationByCombinedIdentifier(i);
      }
    }
  },

  _forbidAllOriginsToSingleDestination : function _forbidAllOriginsToSingleDestination(
      host) {
    for (var i in this._allowedOriginsToDestinations) {
      if (this._combinedOriginToDestinationIdentifierHasDestination(i, host)) {
        this._forbidOriginToDestinationByCombinedIdentifier(i);
      }
    }
  },

  _forbidOriginToDestination : function(originIdentifier, destIdentifier,
      noStore) {
    var combinedId = this._getCombinedOriginToDestinationIdentifier(
        originIdentifier, destIdentifier);
    this._forbidOriginToDestinationByCombinedIdentifier(combinedId);
  },

  forbidOriginToDestination : function forbidOriginToDestination(
      originIdentifier, destIdentifier) {
    this._forbidOriginToDestination(originIdentifier, destIdentifier, false);
  },

  forbidOriginToDestinationDelayStore : function forbidOriginToDestinationDelayStore(
      originIdentifier, destIdentifier) {
    this._forbidOriginToDestination(originIdentifier, destIdentifier, true);
  },

  _forbidOriginToDestinationByCombinedIdentifier : function(combinedId, noStore) {
    if (this._temporarilyAllowedOriginsToDestinations[combinedId]) {
      this._temporarilyAllowedOriginsToDestinationsCount--;
      delete this._temporarilyAllowedOriginsToDestinations[combinedId];
    }
    if (this._allowedOriginsToDestinations[combinedId]) {
      delete this._allowedOriginsToDestinations[combinedId];
      if (!noStore) {
        this._storePreferenceList("allowedOriginsToDestinations");
      }
    }
  },

  _storePreferenceList : function(prefName) {
    var setFromObj = this._prefNameToObjectMap[prefName];
    if (setFromObj === undefined) {
      throw "Invalid prefName: " + prefName;
    }
    var value = this._objToPrefString(setFromObj);
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Setting preference <" + prefName + "> to value <" + value + ">.");
    this.prefs.setCharPref(prefName, value);
    // Flush the prefs so that if the browser crashes, the changes aren't lost.
    // TODO: flush the file once after any changed preferences have been
    // modified, rather than once on each call to the current function.
    this._prefService.savePrefFile(null);
  },

  storeAllPreferenceLists : function() {
    for (var prefName in this._prefNameToObjectMap) {
      this._storePreferenceList(prefName);
    }
  },

  _getPreferenceObj : function(prefName) {
    var prefString = this.prefs.getCharPref(prefName);
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Loading preference <" + prefName + "> from value <" + prefString
            + ">.");
    return this._prefStringToObj(prefString);
  },

  _objToPrefString : function(obj) {
    var a = [];
    for (var i in obj) {
      a.push(i);
    }
    return a.join(" ");
  },

  _prefStringToObj : function(prefString) {
    var prefObj = {};
    var prefArray = prefString.split(" ");
    if (prefArray[0] != "") {
      for (var i in prefArray) {
        prefObj[prefArray[i]] = true;
      }
    }
    return prefObj;
  },

  isAllowedRedirect : function(originUri, destinationUri) {
    // TODO: Find a way to get rid of repitition of code between this and
    // shouldLoad().

    // Note: If changing the logic here, also make necessary changes to
    // shouldLoad().

    var originIdentifier = this.getUriIdentifier(originUri);
    var destIdentifier = this.getUriIdentifier(destinationUri);

    if (destIdentifier == originIdentifier) {
      return true;
    } else if (this.isTemporarilyAllowedOrigin(originIdentifier)) {
      return true;
    } else if (this.isAllowedOrigin(originIdentifier)) {
      return true;
    } else if (this.isTemporarilyAllowedDestination(destIdentifier)) {
      return true;
    } else if (this.isAllowedDestination(destIdentifier)) {
      return true;
    } else if (this.isTemporarilyAllowedOriginToDestination(originIdentifier,
        destIdentifier)) {
      return true;
    } else if (this.isAllowedOriginToDestination(originIdentifier,
        destIdentifier)) {
      return true;
    } else if (destinationUri[0] && destinationUri[0] == '/'
        || destinationUri.indexOf(":") == -1) {
      // Redirect is to a relative url.
      return true;
    }

    for (var i = 0; i < this._compatibilityRules.length; i++) {
      var rule = this._compatibilityRules[i];
      var allowOrigin = rule[0] ? originUri.indexOf(rule[0]) == 0 : true;
      var allowDest = rule[1] ? destinationUri.indexOf(rule[1]) == 0 : true;
      if (allowOrigin && allowDest) {
        // TODO: Give the reason the request was allowed.
        // return this.accept("Extension compatibility rule matched [" + rule[2]
        // + "]", arguments, true);
        return true;
      }
    }

    return false;
  },

  /**
   * Determines whether the user has granted any temporary permissions. This
   * does not include temporarily disabling all blocking.
   * 
   * @return {Boolean} true if any temporary permissions have been granted,
   *         false otherwise.
   */
  areTemporaryPermissionsGranted : function areTemporaryPermissionsGranted() {
    return this._temporarilyAllowedOriginsCount != 0
        || this._temporarilyAllowedDestinationsCount != 0
        || this._temporarilyAllowedOriginsToDestinationsCount != 0;
  },

  isPrefetchEnabled : function isPrefetchEnabled() {
    // network.dns.disablePrefetch only exists starting in Firefox 3.1
    try {
      return this._rootPrefs.getBoolPref("network.prefetch-next")
          || !this._rootPrefs.getBoolPref("network.dns.disablePrefetch");
    } catch (e) {
      return this._rootPrefs.getBoolPref("network.prefetch-next");
    }
  },

  isBlockingDisabled : function isBlockingDisabled() {
    return this._blockingDisabled;
  },

  originHasRejectedRequests : function(originUri) {
    var rejectedRequests = this._rejectedRequests[originUri];
    if (rejectedRequests) {
      for (var i in rejectedRequests) {
        for (var j in rejectedRequests[i]) {
          if (rejectedRequests[i][j]) {
            return true;
          }
        }
      }
    }
    return false;
  },

  /**
   * Add an observer to be notified of all blocked and allowed requests. TODO:
   * This should be made to accept instances of a defined interface.
   * 
   * @param {}
   *            observer
   */
  addRequestObserver : function addRequestObserver(observer) {
    if (!("observeBlockedRequest" in observer)) {
      throw "Observer passed to addRequestObserver does "
          + "not have an observeBlockedRequest() method.";
    }
    requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Adding request observer: " + observer.toString());
    this._requestObservers.push(observer);
  },

  /**
   * Remove an observer added through addRequestObserver().
   * 
   * @param {}
   *            observer
   */
  removeRequestObserver : function removeRequestObserver(observer) {
    for (var i = 0; i < this._requestObservers.length; i++) {
      if (this._requestObservers[i] == observer) {
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Removing request observer: " + observer.toString());
        delete this._requestObservers[i];
        return;
      }
    }
    requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Could not find observer to remove " + "in removeRequestObserver()");
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIObserver interface
  // /////////////////////////////////////////////////////////////////////////

  observe : function(subject, topic, data) {
    switch (topic) {
      case "http-on-examine-response" :
        this._examineHttpResponse(subject);
        break;
      case "http-on-modify-request" :
        this._examineHttpRequest(subject);
        break;
      case "nsPref:changed" :
        this._updatePref(data);
        break;
      case "profile-after-change" :
        // "profile-after-change" means that user preferences are now
        // accessible. If we tried to load preferences before this, we would get
        // default preferences rather than user preferences.
        this._syncFromPrefs();
        // Detect other installed extensions and the current application and do
        // what is needed to allow their requests.
        this._initializeExtensionCompatibility();
        this._initializeApplicationCompatibility();
        break;
      case "app-startup" :
        this._init();
        break;
      case "xpcom-shutdown" :
        this._shutdown();
        break;
      default :
        requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_ERROR,
            "uknown topic observed: " + topic);
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIContentPolicy interface
  // /////////////////////////////////////////////////////////////////////////

  // before initializing content policy, allow all requests through
  shouldLoad : CP_NOP,
  shouldProcess : CP_NOP,

  // enable our actual shouldLoad function
  _initContentPolicy : function() {
    this.shouldLoad = this.mainContentPolicy.shouldLoad;
    if (!this.mimeService) {
      // this.rejectCode = typeof(/ /) == "object" ? -4 : -3;
      this.rejectCode = CI.nsIContentPolicy.REJECT_SERVER;
      this.mimeService = CC['@mozilla.org/uriloader/external-helper-app-service;1']
          .getService(CI.nsIMIMEService);
    }
  },

  _argumentsToString : function(aContentType, dest, origin, aContext,
      aMimeTypeGuess, aInternalCall) {
    // Note: try not to cause side effects of toString() during load, so "<HTML
    // Element>" is hard-coded.
    return "type: "
        + aContentType
        + ", destination: "
        + dest
        + ", origin: "
        + origin
        + ", context: "
        + ((aContext instanceof CI.nsIDOMHTMLElement)
            ? "<HTML Element>"
            : aContext) + ", mime: " + aMimeTypeGuess + ", " + aInternalCall;
  },

  // We always call this from shouldLoad to reject a request.
  reject : function(reason, args) {
    requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_CONTENT,
        "** BLOCKED ** reason: "
            + reason
            + ". "
            + this._argumentsToString(args[0], args[1], args[2], args[3],
                args[4], args[5]));

    if (this._blockingDisabled) {
      return CP_OK;
    }

    var origin = args[2];
    var dest = args[1];

    // args[3] is the context
    args[3].requestpolicyBlocked = true;

    this._cacheShouldLoadResult(CP_REJECT, origin, dest);
    this._recordRejectedRequest(origin, dest);

    return CP_REJECT;
  },

  _recordRejectedRequest : function(originUri, destUri) {
    var destIdentifier = this.getUriIdentifier(destUri);

    // Keep track of the rejected requests by full origin uri, then within each
    // full origin uri, organize by dest hostnames. This makes it easy to
    // determine the rejected dest hosts from a given page. The full
    // dest uri for each rejected dest is then also kept. This
    // allows showing the number of blocked unique dests to each
    // dest host.
    if (!this._rejectedRequests[originUri]) {
      this._rejectedRequests[originUri] = {};
    }
    var originRejected = this._rejectedRequests[originUri];
    if (!originRejected[destIdentifier]) {
      originRejected[destIdentifier] = {};
    }
    if (!originRejected[destIdentifier][destUri]) {
      originRejected[destIdentifier][destUri] = true;
      if (!originRejected[destIdentifier].count) {
        originRejected[destIdentifier].count = 1;
      } else {
        originRejected[destIdentifier].count++;
      }
    }

    // Remove this request from the set of allowed requests.
    if (this._allowedRequests[originUri]) {
      var originAllowed = this._allowedRequests[originUri];
      if (originAllowed[destIdentifier]) {
        delete originAllowed[destIdentifier][destUri];
        originAllowed[destIdentifier].count--;
        if (originAllowed[destIdentifier].count == 0) {
          delete originAllowed[destIdentifier];
        }
      }
    }

    this._notifyRequestObserversOfBlockedRequest(originUri, destUri);
  },

  // We only call this from shouldLoad when the request was a remote request
  // initiated by the content of a page. this is partly for efficiency. in other
  // cases we just return CP_OK rather than return this function which
  // ultimately returns CP_OK. Third param, "unrecorded", is set to true if
  // this request shouldn'tbe recorded as an allowed request.
  accept : function(reason, args, unforbidable) {
    requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_CONTENT,
        "** ALLOWED ** reason: "
            + reason
            + ". "
            + this._argumentsToString(args[0], args[1], args[2], args[3],
                args[4], args[5]));

    var origin = args[2];
    var dest = args[1];

    this._cacheShouldLoadResult(CP_OK, origin, dest);
    // We aren't recording the request so it doesn't show up in the menu, but we
    // want it to still show up in the request log.
    if (unforbidable) {
      this._notifyRequestObserversOfAllowedRequest(origin, dest);
    } else {
      this._recordAllowedRequest(origin, dest);
    }

    return CP_OK;
  },

  _recordAllowedRequest : function(originUri, destUri) {
    var destIdentifier = this.getUriIdentifier(destUri);

    // Reset the accepted and rejected requests originating from this
    // destination. That is, if this accepts a request to a uri that may itself
    // originate further requests, reset the information about what that page is
    // accepting and rejecting.
    if (this._allowedRequests[destUri]) {
      delete this._allowedRequests[destUri];
    }
    if (this._rejectedRequests[destUri]) {
      delete this._rejectedRequests[destUri];
    }

    // Remove this request from the set of rejected requests.
    if (this._rejectedRequests[originUri]) {
      var originRejected = this._rejectedRequests[originUri];
      if (originRejected[destIdentifier]) {
        delete originRejected[destIdentifier][destUri];
        originRejected[destIdentifier].count--;
        if (originRejected[destIdentifier].count == 0) {
          delete originRejected[destIdentifier];
        }
      }
    }

    // Keep track of the accepted requests.
    if (!this._allowedRequests[originUri]) {
      this._allowedRequests[originUri] = {};
    }
    var originAllowed = this._allowedRequests[originUri];
    if (!originAllowed[destIdentifier]) {
      originAllowed[destIdentifier] = {};
    }
    if (!originAllowed[destIdentifier][destUri]) {
      originAllowed[destIdentifier][destUri] = true;
      if (!originAllowed[destIdentifier].count) {
        originAllowed[destIdentifier].count = 1;
      } else {
        originAllowed[destIdentifier].count++;
      }
    }

    this._notifyRequestObserversOfAllowedRequest(originUri, destUri);
  },

  _cacheShouldLoadResult : function(result, originUri, destUri) {
    var date = new Date();
    this._lastShouldLoadCheck.time = date.getTime();
    this._lastShouldLoadCheck.destination = destUri;
    this._lastShouldLoadCheck.origin = originUri;
    this._lastShouldLoadCheck.result = result;
  },

  /**
   * Determines if a request is only related to internal resources.
   * 
   * @param {}
   *            aContentLocation
   * @param {}
   *            aRequestOrigin
   * @return {Boolean} true if the request is only related to internal
   *         resources.
   */
  _isInternalRequest : function(aContentLocation, aRequestOrigin) {
    // Note: Don't OK the origin scheme "moz-nullprincipal" without further
    // understanding. It appears to be the source when test8.html is used. That
    // is, javascript redirect to a "javascript:" url that creates the entire
    // page's content which includes a form that it submits. Maybe
    // "moz-nullprincipal" always shows up when using "document.location"?

    // Not cross-site requests.
    if (aContentLocation.scheme == "resource"
        || aContentLocation.scheme == "about"
        || aContentLocation.scheme == "data"
        || aContentLocation.scheme == "chrome"
        || aContentLocation.scheme == "moz-icon"
        || aContentLocation.scheme == "view-source"
        || aContentLocation.scheme == "wyciwyg"
        || aContentLocation.scheme == "javascript") {
      return true;
    }

    if (aRequestOrigin == undefined || aRequestOrigin == null) {
      return true;
    }

    try {
      // The asciiHost values will exist but be empty strings for the "file"
      // scheme, so we don't want to allow just because they are empty strings,
      // only if not set at all.
      aRequestOrigin.asciiHost;
      aContentLocation.asciiHost;
      // The spec can be empty if odd things are going on, like the Refcontrol
      // extension causing back/forward button-initiated requests to have
      // aRequestOrigin be a virtually empty nsIURL object.
      var missingSpecOrHost = aRequestOrigin.spec === "";
    } catch (e) {
      missingSpecOrHost = true;
    }

    if (missingSpecOrHost) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_CONTENT,
          "No asciiHost or empty spec on either aRequestOrigin <"
              + aRequestOrigin.spec + "> or aContentLocation <"
              + aContentLocation.spec + ">");
      return true;
    }

    var destHost = aContentLocation.asciiHost;

    // "global" dest are [some sort of interal requests]
    // "browser" dest are [???]
    if (destHost == "global" || destHost == "browser") {
      return true;
    }

    if (aRequestOrigin.scheme == 'about'
        && aRequestOrigin.spec.indexOf("about:neterror?") == 0) {
      return true;
    }

    // If there are entities in the document, they may trigger a local file
    // request. We'll only allow requests to .dtd files, though, so we don't
    // open up all file:// destinations.
    if (aContentLocation.scheme == "file"
        && /.\.dtd$/.test(aContentLocation.path)) {
      return true;
    }

    return false;
  },

  /**
   * Determines if a request is a duplicate of the last call to shouldLoad(). If
   * it is, the cached result in _lastShouldLoadCheck.result can be used. Not
   * sure why, it seems that there are duplicates so using this simple cache of
   * the last call to shouldLoad() keeps duplicates out of log data.
   * 
   * @param {}
   *            aContentLocation
   * @param {}
   *            aRequestOrigin
   * @return {Boolean} true if the request a duplicate.
   */
  _isDuplicateRequest : function(dest, origin) {

    if (this._lastShouldLoadCheck.origin == origin
        && this._lastShouldLoadCheck.destination == dest) {
      var date = new Date();
      if (date.getTime() - this._lastShouldLoadCheck.time < this._lastShouldLoadCheckTimeout) {
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_CONTENT,
            "Using cached shouldLoad() result of "
                + this._lastShouldLoadCheck.result + " for request to <" + dest
                + "> from <" + origin + ">.");
        return true;
      } else {
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_CONTENT,
            "shouldLoad() cache expired for result of "
                + this._lastShouldLoadCheck.result + " for request to <" + dest
                + "> from <" + origin + ">.");
      }
    }
    return false;
  },

  // the content policy that does something useful
  mainContentPolicy : {

    // called automatically. see:
    // http://people.mozilla.com/~axel/doxygen/html/interfacensIContentPolicy.html
    shouldLoad : function(aContentType, aContentLocation, aRequestOrigin,
        aContext, aMimeTypeGuess, aInternalCall) {
      try {

        if (this._isInternalRequest(aContentLocation, aRequestOrigin)) {
          return CP_OK;
        }

        var origin = requestpolicy.mod.DomainUtil
            .stripFragment(aRequestOrigin.spec);
        var dest = requestpolicy.mod.DomainUtil
            .stripFragment(aContentLocation.spec);

        if (this._isDuplicateRequest(dest, origin)) {
          return this._lastShouldLoadCheck.result;
        }

        arguments = [aContentType, dest, origin, aContext, aMimeTypeGuess,
            aInternalCall];

        var originHost = aRequestOrigin.asciiHost;
        var destHost = aContentLocation.asciiHost;
        var originIdentifier = this.getUriIdentifier(origin);
        var destIdentifier = this.getUriIdentifier(dest);

        // Sometimes, clicking a link to a fragment will result in a request
        // where the origin is the same as the destination, but none of the
        // additional content of the page is again requested. The result is that
        // nothing ends up showing for blocked or allowed destinations because
        // all of that data was cleared due to the new request.
        // Example to test with: Click on "expand all" at
        // http://code.google.com/p/SOME_PROJECT/source/detail?r=SOME_REVISION
        if (origin == dest) {
          requestpolicy.mod.Logger.warning(
              requestpolicy.mod.Logger.TYPE_CONTENT,
              "Allowing (but not recording) request "
                  + "where origin is the same as the destination: " + origin);
          return CP_OK;
        }

        // Note: If changing the logic here, also make necessary changes to
        // isAllowedRedirect).

        // Checking for link clicks, form submissions, and history requests
        // should be done before other checks. Specifically, when link clicks
        // were done after allowed-origin and other checks, then links that
        // were allowed due to other checks would end up recorded in the origin
        // url's allowed requests, and woud then show up on one tab if link
        // was opened in a new tab but that link would have been allowed
        // regardless of the link click. The original tab would then show it
        // in its menu.
        if (this._clickedLinks[origin] && this._clickedLinks[origin][dest]) {
          // Don't delete the _clickedLinks item. We need it for if the user
          // goes back/forward through their history.
          // delete this._clickedLinks[origin][dest];
          return this.accept("User-initiated request by link click", arguments,
              true);

        } else if (this._submittedForms[origin]
            && this._submittedForms[origin][dest.split("?")[0]]) {
          // Note: we dropped the query string from the dest because form GET
          // requests will have that added on here but the original action of
          // the form may not have had it.
          // Don't delete the _clickedLinks item. We need it for if the user
          // goes back/forward through their history.
          // delete this._submittedForms[origin][dest.split("?")[0]];
          return this.accept("User-initiated request by form submission",
              arguments, true);

        } else if (this._historyRequests[dest]) {
          // When the user goes back and forward in their history, a request for
          // the url comes through but is not followed by requests for any of
          // the page's content. Therefore, we make sure that our cache of
          // blocked requests isn't removed in this case.
          delete this._historyRequests[dest];
          return this.accept("History request", arguments, true);
        }

        if (this.isTemporarilyAllowedOrigin(originIdentifier)) {
          return this.accept("Temporarily allowed origin", arguments);
        }

        if (this.isAllowedOrigin(originIdentifier)) {
          return this.accept("Allowed origin", arguments);
        }

        if (this.isTemporarilyAllowedDestination(destIdentifier)) {
          return this.accept("Temporarily allowed destination", arguments);
        }

        if (this.isAllowedDestination(destIdentifier)) {
          return this.accept("Allowed destination", arguments);
        }

        if (this.isTemporarilyAllowedOriginToDestination(originIdentifier,
            destIdentifier)) {
          return this.accept("Temporarily allowed origin to destination",
              arguments);
        }

        if (this.isAllowedOriginToDestination(originIdentifier, destIdentifier)) {
          return this.accept("Allowed origin to destination", arguments);
        }

        if (aRequestOrigin.scheme == "chrome") {
          if (originHost == "browser") {
            // "browser" origin shows up for favicon.ico and adderss entered in
            // address bar.
            return this.accept(
                "User action (e.g. address entered in address bar) or other good "
                    + "explanation (e.g. new window/tab opened)", arguments);
          } else {
            // TODO: It seems sketchy to allow all requests from chrome. If I
            // had to put my money on a possible bug (in terms of not blocking
            // requests that should be), I'd put it here. Doing this, however,
            // saves a lot of blocking of legitimate requests from extensions
            // that originate from their xul files. If you're reading this and
            // you know of a way to use this to evade RequestPolicy, please let
            // me know, I will be very grateful.
            return this.accept(
                "User action (e.g. address entered in address bar) or other good "
                    + "explanation (e.g. new window/tab opened)", arguments);
          }
        }

        if (destIdentifier == originIdentifier) {
          return this.accept("same host (at current domain strictness level)",
              arguments);
        }

        // This is mostly here for the case of popup windows where the user has
        // allowed popups for the domain. In that case, the window.open() call
        // that made the popup isn't calling the wrapped version of
        // window.open() and we can't find a better way to register the source
        // and destination before the request is made. This should be able to be
        // removed if we can find a better solution for the allowed popup case.
        if (aContext.nodeName == "xul:browser" && aContext.currentURI
            && aContext.currentURI.spec == "about:blank") {
          return this
              .accept(
                  "New window (should probably only be an allowed popup's initial request)",
                  arguments, true);
        }

        // XMLHttpRequest's made within chrome's context have this origin.
        // Greasemonkey uses such a method to provide their cross-site xhr.
        if (origin == "resource://gre/res/hiddenWindow.html") {
          return this.accept(
              "Privileged request (possibly a cross-site XMLHttpRequest)",
              arguments, true);
        }

        for (var i = 0; i < this._compatibilityRules.length; i++) {
          var rule = this._compatibilityRules[i];
          var allowOrigin = rule[0] ? origin.indexOf(rule[0]) == 0 : true;
          var allowDest = rule[1] ? dest.indexOf(rule[1]) == 0 : true;
          if (allowOrigin && allowDest) {
            return this.accept(
                "Extension/application compatibility rule matched [" + rule[2]
                    + "]", arguments, true);
          }
        }

        // We didn't match any of the conditions in which to allow the request,
        // so reject it.
        return this.reject("hosts don't match", arguments);

      } catch (e) {
        requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
            "Fatal Error, " + e + ", stack was: " + e.stack);
        requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_CONTENT,
            "Rejecting request due to internal error.");
        return this._blockingDisabled ? CP_OK : CP_REJECT;
      }

    } // end shouldLoad

  } // end mainContentPolicy

  // /////////////////////////////////////////////////////////////////////////
  // end nsIContentPolicy interface
  // /////////////////////////////////////////////////////////////////////////
};

var components = [RequestPolicyService];
function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
