Components.utils.import("resource://csrpolicy/DOMUtils.jsm");
Components.utils.import("resource://csrpolicy/Logger.jsm");

const CI = Components.interfaces;
const CC = Components.classes;

var OverlayTest = {

  onLoad : function(e) {

    // TODO: Listen for DOMSubtreeModified and/or DOMLinkAdded to register
    // new links/forms with csrPolicy even if they are added after initial
    // load (e.g. they are added through javascript).

    var document = e.target;

    var csrPolicy = CC["@csrpolicy.com/csrpolicy-service;1"]
        .getService(CI.nsICSRPolicy);

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
    var anchorTags = document.getElementsByTagName("a");
    for (var i = 0; i < anchorTags.length; i++) {
      anchorTags[i].addEventListener("click", function(e) {
            csrPolicy.registerLinkClicked(e.target);
          }, false);
    }

    // Find all form tags and add submit events.
    var formTags = document.getElementsByTagName("form");
    for (var i = 0; i < formTags.length; i++) {
      formTags[i].addEventListener("submit", function(e) {
            csrPolicy.registerFormSubmitted(e.target);
          }, false);
    }

  }

};

addEventListener("DOMContentLoaded", function(e) {
      OverlayTest.onLoad(e);
    }, false);
