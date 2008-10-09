/**
 * Cross-Site Request Policy service
 * 
 * @author Justin Samuel <justin at justinsamuel.com>
 * @copyright 2008
 * @license GPL
 */

const CI = Components.interfaces;
const CC = Components.classes;

// const STATE_START = CI.nsIWebProgressListener.STATE_START;
// const STATE_DOC = CI.nsIWebProgressListener.STATE_IS_DOCUMENT;
// const NS_BINDING_ABORTED = 0x804B0002;
const CP_OK = CI.nsIContentPolicy.ACCEPT;
const CP_NOP = function() {
  return CP_OK;
};
const CP_REJECT = CI.nsIContentPolicy.REJECT_SERVER;

function loadLibraries() {
  // Wasn't able to define a resource in chrome.manifest, so need to use file
  // paths to load modules. This method of doing it is described at
  // http://developer.mozilla.org/en/Using_JavaScript_code_modules
  // but this is using __LOCATION__ instead.
  // The reason a resources defined in chrome.manifest isn't working is likely
  // because at this point chrome.manifest hasn't been loaded yet. See
  // http://groups.google.com/group/mozilla.dev.tech.xpcom/browse_thread/thread/6a8ea7f803ac720a
  // for more info.
  // TODO(justin): remove this and have code wait until after app startup,
  // so using chrome.manifest instead of this but just waiting until it's ready.
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
}

// Use the new-fangled FF3 module, etc. generation.
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function CsrPolicyService() {
  loadLibraries();
  this.wrappedJSObject = this;
  this.initContentPolicy();
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

  VERSION : "0.1",

  // /////////////////////////////////////////////////////////////////////////
  // Variables
  // /////////////////////////////////////////////////////////////////////////

  _submittedForms : {},

  _clickedLinks : {},

  /**
   * Number of elapsed milliseconds from the time of the last shouldLoad() call
   * at which the cached results of the last shouldLoad() call are discarded.
   * 
   * @type Number
   */
  _lastShouldLoadCheckTimeout : 100,

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

  // /////////////////////////////////////////////////////////////////////////
  // nsICSRPolicy interface
  // /////////////////////////////////////////////////////////////////////////

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

  // /////////////////////////////////////////////////////////////////////////
  // nsIObserver interface
  // /////////////////////////////////////////////////////////////////////////

  observe : function(subject, topic, data) {
    if (topic == "http-on-examine-response") {

      // TODO: Allow Location header based on policy.

      // TODO: Remove Refresh header, treat it like meta refresh. Refresh
      // headers may be ignored by firefox, but probably good to remove them if
      // they exist for future-proofing and bug-proofing.

      var httpChannel = subject
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

    } else if (topic == "app-startup") {

      // Register observer for http-on-examine-response.
      var os = Components.classes["@mozilla.org/observer-service;1"]
          .getService(Components.interfaces.nsIObserverService);
      os.addObserver(this, "http-on-examine-response", false);

    } else {
      Logger.warning(Logger.TYPE_ERROR, "uknown topic observed: " + topic);
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // Utility functions
  // /////////////////////////////////////////////////////////////////////////

  // leakage detection
  reportLeaks : function() {
    this.dump("DUMPING " + this.__parent__);
    for (var v in this.__parent__) {
      this.dump(v + " = " + this.__parent__[v] + "\n");
    }
  },

  dump : function(msg) {
    dump("[CSRPolicy] " + msg + "\n");
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIContentPolicy interface
  // /////////////////////////////////////////////////////////////////////////

  // before initializing content policy, allow all requests through
  shouldLoad : CP_NOP,
  shouldProcess : CP_NOP,

  // enable our actual shouldLoad function
  initContentPolicy : function() {
    this.shouldLoad = this.mainContentPolicy.shouldLoad;
    if (!this.mimeService) {
      // this.rejectCode = typeof(/ /) == "object" ? -4 : -3;
      this.rejectCode = CI.nsIContentPolicy.REJECT_SERVER;
      this.mimeService = CC['@mozilla.org/uriloader/external-helper-app-service;1']
          .getService(CI.nsIMIMEService);
    }
  },

  argumentsToString : function(aContentType, aContentLocation, aRequestOrigin,
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
            + this.argumentsToString(args[0], args[1], args[2], args[3],
                args[4], args[5]));
    if (Logger.logTypes & Logger.TYPE_CONTENT_CALL) {
      Logger.info(Logger.TYPE_CONTENT_CALL, new Error().stack);
    }

    var date = new Date();
    this._lastShouldLoadCheck.time = date.getMilliseconds();
    this._lastShouldLoadCheck.destination = args[1].spec;
    this._lastShouldLoadCheck.origin = args[2].spec;
    this._lastShouldLoadCheck.result = CP_REJECT;

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
            + this.argumentsToString(args[0], args[1], args[2], args[3],
                args[4], args[5]));
    if (Logger.logTypes & Logger.TYPE_CONTENT_CALL) {
      Logger.info(Logger.TYPE_CONTENT_CALL, new Error().stack);
    }

    var date = new Date();
    this._lastShouldLoadCheck.time = date.getMilliseconds();
    this._lastShouldLoadCheck.destination = args[1].spec;
    this._lastShouldLoadCheck.origin = args[2].spec;
    this._lastShouldLoadCheck.result = CP_OK;

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
    // Not cross-site requests.
    if (aContentLocation.scheme == "resource"
        || aContentLocation.scheme == "about"
        || aContentLocation.scheme == "data"
        || aContentLocation.scheme == "chrome"
        || aContentLocation.scheme == "moz-icon") {
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
    var date = new Date();
    if (date.getMilliseconds() - this._lastShouldLoadCheck.time < this._lastShouldLoadCheckTimeout) {
      if (this._lastShouldLoadCheck.origin == aRequestOrigin.spec
          && this._lastShouldLoadCheck.destination == aContentLocation.spec) {
        Logger.debug(Logger.TYPE_INTERNAL,
            "Using cached shouldLoad() result of "
                + this._lastShouldLoadCheck.result + " for request to <"
                + aContentLocation.spec + "> from <" + aRequestOrigin.spec
                + ">.");
        return true;
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

        // "browser" origin requests for things like favicon.ico and possibly
        // original request
        // TODO: check this, seems sketchy.
        if (originHost == "browser") {
          return this.accept(
              "User action (e.g. address entered in address bar) or other good "
                  + "explanation (e.g. new window/tab opened)", arguments);
        }

        if (destHost == originHost) {
          arguments = [aContentType, aContentLocation, aRequestOrigin,
              aContext, aMimeTypeGuess, aInternalCall]
          return this.accept("same hosts", arguments);
        }

        if (aContext instanceof CI.nsIDOMXULElement) {
          if (this._clickedLinks[origin] && this._clickedLinks[origin][dest]) {
            // TODO: multiple calls to shouldLoad seem to be made for each link
            // click, need a way to remove it but not immediately or figure out
            // why there are multiple calls.
            // delete this._clickedLinks[origin][dest];
            return this.accept("User-initiated request by link click.",
                arguments);

          } else if (this._submittedForms[origin]
              && this._submittedForms[origin][dest.split("?")[0]]) {
            // Note: we dropped the query string from the dest because form GET
            // requests will have that added on here but the original action of
            // the form may not have had it.
            return this.accept("User-initiated request by form submission.",
                arguments);
          }
        }

        if (DomainUtils.sameHostIgnoreWww(destHost, originHost)) {
          return this.accept("www-similar hosts", arguments);
        }

        if (DomainUtils.destinationIsSubdomainOfOrigin(destHost, originHost)) {
          return this.accept("dest is subdomain of origin", arguments);
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
