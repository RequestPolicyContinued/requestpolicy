Components.utils.import("resource://csrpolicy/DOMUtils.jsm");
Components.utils.import("resource://csrpolicy/DomainUtils.jsm");
Components.utils.import("resource://csrpolicy/Logger.jsm");

const CI = Components.interfaces;
const CC = Components.classes;

var csrpolicyOverlay = {

  _csrpolicy : null,

  _strbundle : null,

  init : function() {
    this._csrpolicy = CC["@csrpolicy.com/csrpolicy-service;1"]
        .getService(CI.nsICSRPolicy);
    this._strbundle = document.getElementById("csrpolicyStrings");
  },

  onDOMContentLoaded : function(e) {

    // TODO: Listen for DOMSubtreeModified and/or DOMLinkAdded to register
    // new links/forms with csrpolicy even if they are added after initial
    // load (e.g. they are added through javascript).

    var document = e.target;

    const csrpolicy = this._csrpolicy;

    // Disable meta redirects. This gets called on every DOMContentLoaded
    // but it may not need to be if there's a way to do it based on a
    // different event besides DOMContentLoaded.
    var docShell = DOMUtils.getDocShellFromWindow(document.defaultView);
    docShell.allowMetaRedirects = false;

    // Find all meta redirects.
    // TODO(justin): Do something with them besides alert.
    var metaTags = document.getElementsByTagName("meta");
    for (var i = 0; i < metaTags.length; i++) {
      if (metaTags[i].httpEquiv && metaTags[i].httpEquiv == "refresh") {
        Logger.info(Logger.TYPE_META_REFRESH, "meta refresh to <"
                + metaTags[i].content + "> found in document at <"
                + document.location + ">");
      }
    }

    // Find all anchor tags and add click events (which also fire when enter
    // is pressed while the element has focus).
    // This semes to be a safe approach in that the MDC states that javascript
    // can't be used to initiate a click event on a link:
    // http://developer.mozilla.org/en/DOM/element.click
    var anchorTags = document.getElementsByTagName("a");
    for (var i = 0; i < anchorTags.length; i++) {
      anchorTags[i].addEventListener("click", function(e) {
            csrpolicy.registerLinkClicked(e.target.ownerDocument.URL,
                e.target.href);
          }, false);
    }

    // Find all form tags and add submit events.
    // As far as I can tell, calling a form's submit() method from javascript
    // will not cause this event listener to fire, which makes things easier in
    // that we don't have to find another way to tell if the user submitted the
    // form or if it was done by javascript. However, I'm not sure on the
    // specifics of why submit() from javascript doesn't end up calling this. I
    // can only conclude it's the same difference as with link clicks by humans
    // vs. click(), but that the docmentation just doesn't state this.
    var formTags = document.getElementsByTagName("form");
    for (var i = 0; i < formTags.length; i++) {
      formTags[i].addEventListener("submit", function(e) {
            csrpolicy.registerFormSubmitted(e.target.ownerDocument.URL,
                e.target.action);
          }, false);
    }

    // Add an event listener for when the contentAreaContextMenu (generally the
    // right-click menu within the document) is shown.
    var contextMenu = document.getElementById("contentAreaContextMenu");
    if (contextMenu) {
      contextMenu.addEventListener("popupshowing",
          this._contextMenuOnPopShowing, false);
    }

  },

  /**
   * Called as an event listener when popupshowing fires on the
   * contentAreaContextMenu.
   */
  _contextMenuOnPopShowing : function() {
    // gContextMenu.showItem("csrpolicyTest", true);
    csrpolicyOverlay.wrapOpenLinkFunctions();
  },

  /**
   * Changes the gContextMenu's functions that open links in new tabs or windows
   * such that they first call our own functions before the original open in new
   * link/window functions are executed.
   */
  wrapOpenLinkFunctions : function() {
    const csrpolicy = this._csrpolicy;

    if (!gContextMenu.origOpenLinkInTab) {
      gContextMenu.origOpenLinkInTab = gContextMenu.openLinkInTab;
      gContextMenu.openLinkInTab = function() {
        csrpolicy.registerLinkClicked(gContextMenu.link.ownerDocument.URL,
            gContextMenu.link.href);
        return gContextMenu.origOpenLinkInTab();
      };
    }

    if (!gContextMenu.origOpenLink) {
      gContextMenu.origOpenLink = gContextMenu.openLink;
      gContextMenu.openLink = function() {
        return gContextMenu.origOpenLink();
      };
    }
  }

};

csrpolicyOverlay.onMenuShowing = function(e) {
  if (e.currentTarget != e.originalTarget) {
    return;
  }
  this.prepareMenu(e.target);
};

csrpolicyOverlay._getCurrentHostWithoutWww = function _getCurrentHostWithoutWww() {
  var host = DomainUtils.getHost(content.document.documentURI);
  return DomainUtils.stripWww(host);
};

csrpolicyOverlay.prepareMenu = function(element) {
  // TODO: This is broken for schemes that don't have host values (e.g. "file")
  var host = this._getCurrentHostWithoutWww();

  var itemAllowOriginTemporarily = document
      .getElementById("csrpolicyAllowOriginTemporarily");
  // var itemAllowOriginPermanently = document
  // .getElementById("csrpolicyAllowOriginPermanently");
  var itemRevokeOrigin = document.getElementById("csrpolicyRevokeOrigin");

  if (this._csrpolicy.isTemporarilyAllowedOriginHost(host)) {
    itemRevokeOrigin.label = this._strbundle.getFormattedString(
        "forbidOriginHost", [host]);

    itemAllowOriginTemporarily.hidden = true;
    // itemAllowOriginPermanently.hidden = true;
    itemRevokeOrigin.hidden = false;
  } else {
    itemAllowOriginTemporarily.label = this._strbundle.getFormattedString(
        "allowOriginHostTemporarily", [host]);
    // itemAllowOriginPermanently.label = this._strbundle.getFormattedString(
    // "allowOriginHostPermanently", [host]);

    itemAllowOriginTemporarily.hidden = false;
    // itemAllowOriginPermanently.hidden = false;
    itemRevokeOrigin.hidden = true;
  }

};

csrpolicyOverlay._conditionallyReloadDocument = function() {
  if (this._csrpolicy.prefs.getBoolPref("autoReload")) {
    content.document.location.reload(true);
  }
}

csrpolicyOverlay.allowOriginTemporarily = function(e) {
  // Note: the available variable "content" is different than the avaialable
  // "window.target".
  var host = this._getCurrentHostWithoutWww();
  this._csrpolicy.temporarilyAllowOriginHost(host);
  this._conditionallyReloadDocument();
};

csrpolicyOverlay.csrpolicyRevokeOrigin = function(e) {
  var host = this._getCurrentHostWithoutWww();
  this._csrpolicy.revokeTemporarilyAllowedOriginHost(host);
  this._conditionallyReloadDocument();
}

addEventListener("DOMContentLoaded", function(e) {
      csrpolicyOverlay.init();
      csrpolicyOverlay.onDOMContentLoaded(e);
    }, false);

// "load" is called first. "DOMContentLoaded" is called later (when the DOM can
// be accessed).

// addEventListener("load", function(e) {
// csrpolicyOverlay.onLoad(e);
// }, false);
