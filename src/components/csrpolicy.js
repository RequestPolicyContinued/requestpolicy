/**
 * Cross-Site Request Policy service
 * 
 * @author Justin Samuel <justin at justinsamuel.com>
 * @copyright 2008
 * @license GPL
 */

const CI = Components.interfaces;
const CC = Components.classes;

const CP_OK = CI.nsIContentPolicy.ACCEPT;
const CP_NOP = function() {
  return CP_OK;
};
const CP_REJECT = CI.nsIContentPolicy.REJECT_SERVER;

// Use the new-fangled FF3 module, etc. generation.
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function CsrPolicyService() {
  this.wrappedJSObject = this;
}

CsrPolicyService.prototype = {
  classDescription : "CSR Policy Javascript XPCOM Component",
  classID : Components.ID("{14027e96-1afb-4066-8846-e6c89b5faf3b}"),
  contractID : "@csrpolicy.com/csrpolicy-service;1",
  _xpcom_categories : [{
        category : "app-startup"
      }, {
        category : "content-policy"
      }],
  QueryInterface : XPCOMUtils.generateQI([CI.nsICSRPolicy, CI.nsIObserver,
      CI.nsIContentPolicy]),

  /* Factory that creates a singleton instance of the component */
  _xpcom_factory : {
    createInstance : function() {
      if (CsrPolicyService.instance == null) {
        CsrPolicyService.instance = new CsrPolicyService();
      }
      return CsrPolicyService.instance;
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // Settings
  // /////////////////////////////////////////////////////////////////////////

  VERSION : "0.1.0",

  // /////////////////////////////////////////////////////////////////////////
  // Internal Data
  // /////////////////////////////////////////////////////////////////////////

  _rejectedRequests : {},

  _allowedRequests : {},

  _prefService : null,

  _submittedForms : {},

  _clickedLinks : {},

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

  _temporarilyAllowedOrigins : {},

  _temporarilyAllowedDestinations : {},

  _allowedOrigins : {},

  _allowedDestinations : {},

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
    this._uriIdentificationLevel = DomainUtils.LEVEL_DOMAIN;
  },

  _syncFromPrefs : function() {
    // Load the logging preferences before the otheres.
    this._updateLoggingSettings();
    // origins
    this._allowedOrigins = this._getPreferenceObj("allowedOrigins");
    Logger.vardump(this._allowedOrigins, "this._allowedOrigins");
    // destinations
    this._allowedDestinations = this._getPreferenceObj("allowedDestinations");
    Logger.vardump(this._allowedDestinations, "this._allowedDestinations");
  },

  _updateLoggingSettings : function() {
    Logger.enabled = this.prefs.getBoolPref("log");
    Logger.level = this.prefs.getIntPref("log.level");
    Logger.types = this.prefs.getIntPref("log.types");
  },

  _register : function() {
    var os = CC['@mozilla.org/observer-service;1']
        .getService(CI.nsIObserverService);
    os.addObserver(this, "http-on-examine-response", false);
    os.addObserver(this, "xpcom-shutdown", false);
    os.addObserver(this, "profile-after-change", false);
  },

  _unregister : function() {
    try {
      var os = CC['@mozilla.org/observer-service;1']
          .getService(CI.nsIObserverService);
      os.removeObserver(this, "http-on-examine-response");
      os.removeObserver(this, "xpcom-shutdown");
      os.removeObserver(this, "profile-after-change");
    } catch (e) {
      Logger.dump(e + " while unregistering.");
    }
  },

  _initializePrefSystem : function() {
    // Get the preferences branch and setup the preferences observer.
    this._prefService = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService);
    this.prefs = this._prefService.getBranch("extensions.csrpolicy.")
        .QueryInterface(CI.nsIPrefBranch2);
    this.prefs.addObserver("", this, false);
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
    resProt.setSubstitution("csrpolicy", resourceURI);

    Components.utils.import("resource://csrpolicy/DOMUtils.jsm");
    Components.utils.import("resource://csrpolicy/Logger.jsm");
    Components.utils.import("resource://csrpolicy/SiteUtils.jsm");
    Components.utils.import("resource://csrpolicy/DomainUtils.jsm");
  },

  _examineHttpResponse : function(observedSubject) {
    // TODO: Allow Location header based on policy.

    // TODO: Remove Refresh header, treat it like meta refresh. Refresh
    // headers may be ignored by firefox, but probably good to remove them if
    // they exist for future-proofing and bug-proofing.

    var httpChannel = observedSubject
        .QueryInterface(Components.interfaces.nsIHttpChannel);
    try {
      // If there is no Location header, getResponseHeader will throw
      // NS_ERROR_NOT_AVAILABLE. If there is more than one Location header,
      // the last one is the one that will be used.
      var dest = httpChannel.getResponseHeader("Location");
      var origin = httpChannel.name;

      Logger.info(Logger.TYPE_HEADER_REDIRECT, "Found 'Location' header to <"
              + dest + ">" + " in response from <" + origin + ">");

      var destHost = DomainUtils.getHost(dest);
      var originHost = DomainUtils.getHost(origin);

      if (DomainUtils.sameHostIgnoreWww(destHost, originHost)) {
        Logger.warning(Logger.TYPE_HEADER_REDIRECT,
            "** ALLOWED ** www-similar hosts. To <" + dest + "> " + "from <"
                + origin + ">");
        return;
      }

      if (DomainUtils.destinationIsSubdomainOfOrigin(destHost, originHost)) {
        Logger.warning(Logger.TYPE_HEADER_REDIRECT,
            "** ALLOWED ** dest is subdomain of origin. To <" + dest + "> "
                + "from <" + origin + ">");
        return;
      }

      // The location header isn't allowed, so remove it.
      try {
        httpChannel.setResponseHeader("Location", "", false);
        Logger.warning(Logger.TYPE_HEADER_REDIRECT,
            "** BLOCKED ** 'Location' header to <" + dest + ">"
                + " found in response from <" + origin + ">");
      } catch (e) {
        Logger.severe(Logger.TYPE_HEADER_REDIRECT, "Failed removing "
                + "'Location' header to <" + dest + ">"
                + "  in response from <" + origin + ">." + e);
      }
    } catch (e) {
      // No location header.
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsICSRPolicy interface
  // /////////////////////////////////////////////////////////////////////////

  prefs : null,

  getUriIdentifier : function(uri) {
    return DomainUtils.getIdentifier(uri, this._uriIdentificationLevel);
  },

  registerFormSubmitted : function registerFormSubmitted(originUrl,
      destinationUrl) {
    Logger.info(Logger.TYPE_INTERNAL, "Form submitted from <" + originUrl
            + "> to <" + destinationUrl + ">.");

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
    Logger.info(Logger.TYPE_INTERNAL, "Link clicked from <" + originUrl
            + "> to <" + destinationUrl + ">.");

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

  allowOrigin : function allowOrigin(host) {
    this._allowedOrigins[host] = true;
    this._setPreferenceList("allowedOrigins", this._allowedOrigins);
  },

  isAllowedOrigin : function isAllowedOrigin(host) {
    return this._allowedOrigins[host] ? true : false;
  },

  temporarilyAllowOrigin : function temporarilyAllowOrigin(host) {
    this._temporarilyAllowedOrigins[host] = true;
    this._setPreferenceList("temporarilyAllowedOrigins",
        this._temporarilyAllowedOrigins);
  },

  isTemporarilyAllowedOrigin : function isTemporarilyAllowedOrigin(host) {
    return this._temporarilyAllowedOrigins[host] ? true : false;
  },

  allowDestination : function allowDestination(host) {
    this._allowedDestinations[host] = true;
    this._setPreferenceList("allowedDestinations", this._allowedDestinations);
  },

  isAllowedDestination : function isAllowedDestination(host) {
    return this._allowedDestinations[host] ? true : false;
  },

  temporarilyAllowDestination : function temporarilyAllowDestination(host) {
    this._temporarilyAllowedDestinations[host] = true;
    this._setPreferenceList("temporarilyAllowedDestinations",
        this._temporarilyAllowedDestinations);
  },

  isTemporarilyAllowedDestination : function isTemporarilyAllowedDestination(
      host) {
    return this._temporarilyAllowedDestinations[host] ? true : false;
  },

  revokeTemporaryPermissions : function revokeTemporaryPermissions(host) {
    this._temporarilyAllowedOrigins = {};
    this._setPreferenceList("temporarilyAllowedOrigins",
        this._temporarilyAllowedOrigins);
    this._temporarilyAllowedDestinations = {};
    this._setPreferenceList("temporarilyAllowedDestinations",
        this._temporarilyAllowedDestinations);
  },

  forbidOrigin : function forbidOrigin(host) {
    if (this._temporarilyAllowedOrigins[host]) {
      delete this._temporarilyAllowedOrigins[host];
      this._setPreferenceList("temporarilyAllowedOrigins",
          this._temporarilyAllowedOrigins);
    }
    if (this._allowedOrigins[host]) {
      delete this._allowedOrigins[host];
      this._setPreferenceList("allowedOrigins", this._allowedOrigins);
    }
  },

  forbidDestination : function forbidDestination(host) {
    if (this._temporarilyAllowedDestinations[host]) {
      delete this._temporarilyAllowedDestinations[host];
      this._setPreferenceList("temporarilyAllowedDestinations",
          this._temporarilyAllowedDestinations);
    }
    if (this._allowedDestinations[host]) {
      delete this._allowedDestinations[host];
      this._setPreferenceList("allowedDestinations", this._allowedDestinations);
    }
  },

  _setPreferenceList : function(prefName, setFromObj) {
    var value = this._objToPrefString(setFromObj);
    Logger.info(Logger.TYPE_INTERNAL, "Setting preference <" + prefName
            + "> to value <" + value + ">.");
    this.prefs.setCharPref(prefName, value);
    // Flush the prefs so that if the browser crashes, the changes aren't lost.
    // TODO: flush the file once after any changed preferences have been
    // modified, rather than once on each call to the current function.
    this._prefService.savePrefFile(null);
  },

  _getPreferenceObj : function(prefName) {
    var prefString = this.prefs.getCharPref(prefName);
    Logger.info(Logger.TYPE_INTERNAL, "Loading preference <" + prefName
            + "> from value <" + prefString + ">.");
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

  // /////////////////////////////////////////////////////////////////////////
  // nsIObserver interface
  // /////////////////////////////////////////////////////////////////////////

  observe : function(subject, topic, data) {
    switch (topic) {
      case "http-on-examine-response" :
        this._examineHttpResponse(subject);
        break;
      case "nsPref:changed" :
        this._updatePref(data);
        break;
      case "profile-after-change" :
        // "profile-after-change" means that user preferences are now
        // accessible. If we tried to load preferences before this, we would get
        // default preferences rather than user preferences.
        this._syncFromPrefs();
        break;
      case "app-startup" :
        this._init();
        break;
      case "xpcom-shutdown" :
        this._unregister();
        break;
      default :
        Logger.warning(Logger.TYPE_ERROR, "uknown topic observed: " + topic);
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

  _argumentsToString : function(aContentType, aContentLocation, aRequestOrigin,
      aContext, aMimeTypeGuess, aInternalCall) {
    // Note: try not to cause side effects of toString() during load, so "<HTML
    // Element>" is hard-coded.
    return "type: "
        + aContentType
        + ", destination: "
        + (aContentLocation && aContentLocation.spec)
        + ", origin: "
        + (aRequestOrigin && aRequestOrigin.spec)
        + ", context: "
        + ((aContext instanceof CI.nsIDOMHTMLElement)
            ? "<HTML Element>"
            : aContext) + ", mime: " + aMimeTypeGuess + ", " + aInternalCall;
  },

  // We always call this from shouldLoad to reject a request.
  reject : function(reason, args) {
    Logger.warning(Logger.TYPE_CONTENT, "** BLOCKED ** reason: "
            + reason
            + ". "
            + this._argumentsToString(args[0], args[1], args[2], args[3],
                args[4], args[5]));
    if (Logger.logTypes & Logger.TYPE_CONTENT_CALL) {
      Logger.info(Logger.TYPE_CONTENT_CALL, new Error().stack);
    }

    var origin = args[2].spec;
    var dest = args[1].spec;
    var destIdentifier = this.getUriIdentifier(dest);

    var date = new Date();
    this._lastShouldLoadCheck.time = date.getTime();
    this._lastShouldLoadCheck.destination = dest;
    this._lastShouldLoadCheck.origin = origin;
    this._lastShouldLoadCheck.result = CP_REJECT;

    // Keep track of the rejected requests by full origin uri, then within each
    // full origin uri, organize by dest hostnames. This makes it easy to
    // determine the rejected dest hosts from a given page. The full
    // dest uri for each rejected dest is then also kept. This
    // allows showing the number of blocked unique dests to each
    // dest host.
    if (!this._rejectedRequests[origin]) {
      this._rejectedRequests[origin] = {};
    }
    var originRejected = this._rejectedRequests[origin];
    if (!originRejected[destIdentifier]) {
      originRejected[destIdentifier] = {};
    }
    if (!originRejected[destIdentifier][dest]) {
      originRejected[destIdentifier][dest] = true;
      if (!originRejected[destIdentifier].count) {
        originRejected[destIdentifier].count = 1;
      } else {
        originRejected[destIdentifier].count++;
      }
    }

    // Remove this request from the set of allowed requests.
    if (this._allowedRequests[origin]) {
      var originAllowed = this._allowedRequests[origin];
      if (originAllowed[destIdentifier]) {
        delete originAllowed[destIdentifier][dest];
        originAllowed[destIdentifier].count--;
        if (originAllowed[destIdentifier].count == 0) {
          delete originAllowed[destIdentifier];
        }
      }
    }

    return CP_REJECT;
  },

  // We only call this from shouldLoad when the request was a remote request
  // initiated by the content of a page. this is partly for efficiency. in other
  // cases we just return CP_OK rather than return this function which
  // ultimately returns CP_OK.
  accept : function(reason, args) {
    Logger.warning(Logger.TYPE_CONTENT, "** ALLOWED ** reason: "
            + reason
            + ". "
            + this._argumentsToString(args[0], args[1], args[2], args[3],
                args[4], args[5]));
    if (Logger.logTypes & Logger.TYPE_CONTENT_CALL) {
      Logger.info(Logger.TYPE_CONTENT_CALL, new Error().stack);
    }

    var origin = args[2].spec;
    var dest = args[1].spec;
    var destIdentifier = this.getUriIdentifier(dest);

    var date = new Date();
    this._lastShouldLoadCheck.time = date.getTime();
    this._lastShouldLoadCheck.destination = dest;
    this._lastShouldLoadCheck.origin = origin;
    this._lastShouldLoadCheck.result = CP_OK;

    // Reset the accepted and rejected requests originating from this
    // destination. That is, if this accepts a request to a uri that may itself
    // originate further requests, reset the information about what that page is
    // accepting and rejecting.
    if (this._allowedRequests[dest]) {
      delete this._allowedRequests[dest];
    }
    if (this._rejectedRequests[dest]) {
      delete this._rejectedRequests[dest];
    }

    // Remove this request from the set of rejected requests.
    if (this._rejectedRequests[origin]) {
      var originRejected = this._rejectedRequests[origin];
      if (originRejected[destIdentifier]) {
        delete originRejected[destIdentifier][dest];
        originRejected[destIdentifier].count--;
        if (originRejected[destIdentifier].count == 0) {
          delete originRejected[destIdentifier];
        }
      }
    }

    // Keep track of the accepted requests.
    if (!this._allowedRequests[origin]) {
      this._allowedRequests[origin] = {};
    }
    var originAllowed = this._allowedRequests[origin];
    if (!originAllowed[destIdentifier]) {
      originAllowed[destIdentifier] = {};
    }
    if (!originAllowed[destIdentifier][dest]) {
      originAllowed[destIdentifier][dest] = true;
      if (!originAllowed[destIdentifier].count) {
        originAllowed[destIdentifier].count = 1;
      } else {
        originAllowed[destIdentifier].count++;
      }
    }

    return CP_OK;
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
        || aContentLocation.scheme == "view-source") {
      return true;
    }

    // TODO: Identify when aRequestOrigin is not set.
    if (aRequestOrigin == undefined || aRequestOrigin == null) {
      return true;
    }

    // Javascript skills lacking. There must be a nicer way to find out
    // parameter 'asciiHost' isn't there.
    try {
      aRequestOrigin.asciiHost;
      aContentLocation.asciiHost;
    } catch (e) {
      Logger.info(Logger.TYPE_CONTENT,
          "No asciiHost on either aRequestOrigin <" + aRequestOrigin.spec
              + "> or aContentLocation <" + aContentLocation.spec + ">");
      return true;

    }

    var destHost = aContentLocation.asciiHost;

    // "global" dest are [some sort of interal requests]
    // "browser" dest are [???]
    if (destHost == "global" || destHost == "browser") {
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
  _isDuplicateRequest : function(aContentLocation, aRequestOrigin) {
    if (this._lastShouldLoadCheck.origin == aRequestOrigin.spec
        && this._lastShouldLoadCheck.destination == aContentLocation.spec) {
      var date = new Date();
      if (date.getTime() - this._lastShouldLoadCheck.time < this._lastShouldLoadCheckTimeout) {
        Logger.debug(Logger.TYPE_CONTENT,
            "Using cached shouldLoad() result of "
                + this._lastShouldLoadCheck.result + " for request to <"
                + aContentLocation.spec + "> from <" + aRequestOrigin.spec
                + ">.");
        return true;
      } else {
        Logger.debug(Logger.TYPE_CONTENT,
            "shouldLoad() cache expired for result of "
                + this._lastShouldLoadCheck.result + " for request to <"
                + aContentLocation.spec + "> from <" + aRequestOrigin.spec
                + ">.");
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

        if (this._isDuplicateRequest(aContentLocation, aRequestOrigin)) {
          return this._lastShouldLoadCheck.result;
        }

        arguments = [aContentType, aContentLocation, aRequestOrigin, aContext,
            aMimeTypeGuess, aInternalCall]

        var origin = aRequestOrigin.spec;
        var dest = aContentLocation.spec;
        var originHost = aRequestOrigin.asciiHost;
        var destHost = aContentLocation.asciiHost;
        var originIdentifier = this.getUriIdentifier(origin);
        var destIdentifier = this.getUriIdentifier(dest);

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

        // "browser" origin requests for things like favicon.ico and possibly
        // original request
        // TODO: check this, seems sketchy.
        if (originHost == "browser") {
          return this.accept(
              "User action (e.g. address entered in address bar) or other good "
                  + "explanation (e.g. new window/tab opened)", arguments);
        }

        if (destIdentifier == originIdentifier) {
          arguments = [aContentType, aContentLocation, aRequestOrigin,
              aContext, aMimeTypeGuess, aInternalCall]
          return this.accept("same host (at current domain strictness level)",
              arguments);
        }

        if (aContext instanceof CI.nsIDOMXULElement) {
          if (this._clickedLinks[origin] && this._clickedLinks[origin][dest]) {
            delete this._clickedLinks[origin][dest];
            return this.accept("User-initiated request by link click",
                arguments);

          } else if (this._submittedForms[origin]
              && this._submittedForms[origin][dest.split("?")[0]]) {
            // Note: we dropped the query string from the dest because form GET
            // requests will have that added on here but the original action of
            // the form may not have had it.
            delete this._submittedForms[origin][dest.split("?")[0]];
            return this.accept("User-initiated request by form submission",
                arguments);
          }
        }

        // We didn't match any of the conditions in which to allow the request,
        // so reject it.
        return this.reject("hosts don't match", arguments);

      } catch (e) {
        Logger.severe(Logger.TYPE_ERROR, "Fatal Error, " + e + ", stack was: "
                + e.stack);
        Logger.severe(Logger.TYPE_CONTENT,
            "Rejecting request due to internal error.");
        return CP_REJECT;
      }

    } // end shouldLoad

  } // end mainContentPolicy

  // /////////////////////////////////////////////////////////////////////////
  // end nsIContentPolicy interface
  // /////////////////////////////////////////////////////////////////////////
};

var components = [CsrPolicyService];
function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
