Components.utils.import("resource://csrpolicy/DOMUtils.jsm");

var OverlayTest = {
	onLoad : function(e) {
		var document = e.target;

		// Disable meta redirects. This gets called on every DOMContentLoaded
		// but it may not need to be if there's a way to do it based on a
		// different event besides DOMContentLoaded.
		var docShell = DOMUtils.getDocShellFromWindow(document.defaultView);
		docShell.allowMetaRedirects = false;

		// Find all meta redirects.
		// TODO(justin): Do something with them besides alert.
		var metaTags = document.getElementsByTagName("meta");
		for ( var i = 0; i < metaTags.length; i++) {
			if (metaTags[i].httpEquiv && metaTags[i].httpEquiv == "refresh") {
				dump("meta refresh found: " + metaTags[i].content + "\n");
				alert("meta refresh disabled. would have gone to:\n"
						+ metaTags[i].content);
			}
		}
	}
};

addEventListener("DOMContentLoaded", function(e) {
	OverlayTest.onLoad(e);
}, false);
