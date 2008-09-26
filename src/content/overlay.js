Components.utils.import("resource://csrpolicy/DOMUtils.jsm");
Components.utils.import("resource://csrpolicy/Logger.jsm");

const CI = Components.interfaces;
const CC = Components.classes;

var OverlayTest = {
  onLoad : function(e) {
    var document = e.target;

    // This just tests the interface we've defined for our service.
    var csrPolicy = CC["@csrpolicy.com/csrpolicy-service;1"]
        .getService(CI.nsICSRPolicy);
    csrPolicy.testing();

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
  }
};

addEventListener("DOMContentLoaded", function(e) {
      OverlayTest.onLoad(e);
    }, false);
