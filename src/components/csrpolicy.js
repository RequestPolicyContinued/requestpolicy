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
  // nsICSRPolicy interface
  // /////////////////////////////////////////////////////////////////////////

  clickedLinks : {},

  registerFormSubmitted : function registerFormSubmitted(element) {
    Logger.info(Logger.TYPE_INTERNAL, "Form submitted: " + element);
  },

  registerLinkClicked : function registerLinkClicked(element) {
    // TODO: Link click not being registered for "open in new tab" and "open in
    // new window".
    Logger.info(Logger.TYPE_INTERNAL, "Link clicked: " + element);

    if (element instanceof CI.nsIDOMHTMLAnchorElement) {
      // TODO use a different data structure or keep the array index from
      // growing indefinitely
      var documentUrl = element.ownerDocument.URL;
      if (this.clickedLinks[documentUrl] == undefined) {
        this.clickedLinks[documentUrl] = {};
      }
      if (this.clickedLinks[documentUrl][element.href] == undefined) {
        this.clickedLinks[documentUrl][element.href] = true;
      }
    }
  },

  // /////////////////////////////////////////////////////////////////////////
  // nsIObserver interface
  // /////////////////////////////////////////////////////////////////////////

  observe : function(subject, topic, data) {
    if (topic == "http-on-examine-response") {

      // TODO: Allow Location header based on policy.

      // TODO: Allow subdomains or www.

      // TODO: Remove Refresh header, treat it like meta refresh. Refresh
      // headers may be ignored by firefox, but probably good to remove them if
      // they exist for future-proofing and bug-proofing.

      var httpChannel = subject
          .QueryInterface(Components.interfaces.nsIHttpChannel);
      try {
        // If there is no Location header, an NS_ERROR_NOT_AVAILABLE is thrown.
        // If there is more than one Location header, the last one is the one
        // that will be used.
        var locationHeader = httpChannel.getResponseHeader("Location");
        var requestUri = httpChannel.name;
        Logger.info(Logger.TYPE_HEADER_REDIRECT, "Found 'Location' header to <"
                + locationHeader + ">" + " in response from <" + requestUri
                + ">");
        try {
          httpChannel.setResponseHeader("Location", "", false);
          Logger.warning(Logger.TYPE_HEADER_REDIRECT,
              "BLOCKED 'Location' header to <" + locationHeader + ">"
                  + " found in response from <" + requestUri + ">");
        } catch (e) {
          Logger.severe(Logger.TYPE_HEADER_REDIRECT, "Failed removing "
                  + "'Location' header to <" + locationHeader + ">"
                  + "  in response from <" + requestUri + ">." + e);
        }
      } catch (e) {
        // No location header.
      }

    } else if (topic == "app-startup") {

      // register observer for http-on-examine-response
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

  // this.dump() should be used by other functions instead of using dump()
  // directly
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
    return CP_OK;
  },

  // the content policy that does something useful
  mainContentPolicy : {

    // called automatically. see:
    // http://people.mozilla.com/~axel/doxygen/html/interfacensIContentPolicy.html
    shouldLoad : function(aContentType, aContentLocation, aRequestOrigin,
        aContext, aMimeTypeGuess, aInternalCall) {
      try {

        arguments = [aContentType, aContentLocation, aRequestOrigin, aContext,
            aMimeTypeGuess, aInternalCall]

        // TODO: Recognize user-initated action for "open in new tab" and "open
        // in new window".

        // TODO: Determine if this really is ok. The assumption for
        // now is that if there is no request origin, then it was an initial
        // user request (e.g. typed in the address bar).
        if (!aRequestOrigin) {
          return this.accept("No aRequestOrigin, assuming user-entered url",
              arguments);
        }

        // Not cross-site requests.
        if (aContentLocation.scheme == "resource"
            || aContentLocation.scheme == "data"
            || aContentLocation.scheme == "chrome"
            || aContentLocation.scheme == "moz-icon") {
          return CP_OK;
        }

        // javascript skills lacking. must be a better way to find out parameter
        // 'asciiHost' isn't there.
        try {
          aRequestOrigin.asciiHost;
          aContentLocation.asciiHost;
        } catch (e) {
          return this.accept("No asciiHost on either aRequestOrigin <"
                  + aRequestOrigin.spec + "> or aContentLoc[ation <"
                  + aContentLocation.spec + ">", arguments);
        }

        var origin = aRequestOrigin.spec;
        var dest = aContentLocation.spec;
        var originHost = aRequestOrigin.asciiHost;
        var destHost = aContentLocation.asciiHost;

        // "global" dest are [some sort of interal requests]
        // "browser" dest are [???]
        if (destHost == "global" || destHost == "browser") {
          return CP_OK;
        }

        // "browser" origin requests for things like favicon.ico and possibly
        // original request
        // TODO: check this, seems sketchy.
        if (originHost == "browser") {
          return this.accept(
              "Original request by the user or other good explanation "
                  + "(i.e. entered in the address bar, new tab opened, etc.)",
              arguments);
        }

        if (destHost == originHost) {
          arguments = [aContentType, aContentLocation, aRequestOrigin,
              aContext, aMimeTypeGuess, aInternalCall]
          return this.accept("same hosts", arguments);
        }

        if (aContext instanceof CI.nsIDOMXULElement) {
          if (this.clickedLinks[origin] && this.clickedLinks[origin][dest]) {
            // TODO: multiple calls to shouldLoad seem to be made for each link
            // click, need a way to remove it but not immediately or figure out
            // why there are multiple calls.
            // delete this.clickedLinks[origin][dest];
            return this.accept("User-initiated request.", arguments);
          }
        }

        var originHostNoWWW = originHost.indexOf('www.') == 0 ? originHost
            .substring(4) : originHost;
        var destHostNoWWW = destHost.indexOf('www.') == 0 ? destHost
            .substring(4) : destHost;

        // if these were both the same domain if you ignore any www, then
        // allow it
        if (originHostNoWWW == destHostNoWWW) {
          return this.accept("www-similar hosts", arguments);
        }

        // if the origin without any www if the final part of the
        // destination, then allow it. note that we don't allow the other way
        // around. that is, www.example.com or example.com can request to
        // images.example.com, but images.example.com can't request to
        // www.example.com or example.com
        var lengthDifference = destHostNoWWW.length - originHostNoWWW.length
        if (lengthDifference > 1) {
          if (destHostNoWWW.substring(lengthDifference - 1) == '.'
              + originHostNoWWW) {
            return this.accept("dest is subdomain of origin", arguments);
          }
        }

        // if we didn't match any of the conditions in which to allow the
        // request, then reject it.
        return this.reject("hosts don't match", arguments);

      } catch (e) {
        Logger.severe(Logger.TYPE_ERROR, "Content (Fatal Error, " + e + ")");
        // TODO: log stack trace
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
