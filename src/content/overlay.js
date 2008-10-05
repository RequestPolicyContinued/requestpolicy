Components.utils.import("resource://csrpolicy/DOMUtils.jsm");
Components.utils.import("resource://csrpolicy/Logger.jsm");

const CI = Components.interfaces;
const CC = Components.classes;

var csrPolicyOverlay = {

  csrPolicy : null,

  init : function() {
    this.csrPolicy = CC["@csrpolicy.com/csrpolicy-service;1"]
        .getService(CI.nsICSRPolicy);
  },

  onDOMContentLoaded : function(e) {

    // TODO: Listen for DOMSubtreeModified and/or DOMLinkAdded to register
    // new links/forms with csrPolicy even if they are added after initial
    // load (e.g. they are added through javascript).

    var document = e.target;

    var csrPolicy = this.csrPolicy;

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
            csrPolicy.registerLinkClicked(e.target.ownerDocument.URL,
                e.target.href);
          }, false);
    }

    // Find all form tags and add submit events.
    // TODO: This may require another approach to ensure that javascript hasn't
    // initiated the submission.
    var formTags = document.getElementsByTagName("form");
    for (var i = 0; i < formTags.length; i++) {
      formTags[i].addEventListener("submit", function(e) {
            csrPolicy.registerFormSubmitted(e.target);
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
    // gContextMenu.showItem("csrPolicyTest", true);
    csrPolicyOverlay.wrapOpenLinkFunctions();
  },

  /**
   * Changes the gContextMenu's functions that open links in new tabs or windows
   * such that they first call our own functions before the original open in new
   * link/window functions are executed.
   */
  wrapOpenLinkFunctions : function() {
    var csrPolicy = this.csrPolicy;

    if (!gContextMenu.origOpenLinkInTab) {
      gContextMenu.origOpenLinkInTab = gContextMenu.openLinkInTab;
      gContextMenu.openLinkInTab = function() {
        csrPolicy.registerLinkClicked(gContextMenu.link.ownerDocument.URL,
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

addEventListener("DOMContentLoaded", function(e) {
      csrPolicyOverlay.init();
      csrPolicyOverlay.onDOMContentLoaded(e);
    }, false);

// "load" is called first. "DOMContentLoaded" is called later (when the DOM can
// be accessed).

// addEventListener("load", function(e) {
// csrPolicyOverlay.onLoad(e);
// }, false);
