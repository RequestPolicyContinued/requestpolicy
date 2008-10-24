Components.utils.import("resource://csrpolicy/DOMUtils.jsm");
Components.utils.import("resource://csrpolicy/DomainUtils.jsm");
Components.utils.import("resource://csrpolicy/Logger.jsm");

const CI = Components.interfaces;
const CC = Components.classes;

/**
 * Provides functionality for the overlay. An instance of this class exists for
 * each tab/window.
 */
var csrpolicyOverlay = {
  _initialized : false,
  _csrpolicy : null,
  _csrpolicyJSObject : null, // for development, direct access to the js object
  _strbundle : null,

  /**
   * Initialize the object. This must be done after the DOM is loaded.
   */
  init : function() {
    if (this._initialized == false) {
      this._csrpolicy = CC["@csrpolicy.com/csrpolicy-service;1"]
          .getService(CI.nsICSRPolicy);
      this._csrpolicyJSObject = this._csrpolicy.wrappedJSObject;
      this._strbundle = document.getElementById("csrpolicyStrings");
      this._initialized = true;
    }
  },

  /**
   * Perform the actions required once the window has loaded. This just sets a
   * listener for when the content of the window has changed (a page is loaded).
   * 
   * @param {Event}
   *            event
   */
  onLoad : function(event) {
    // Info on detecting page load at:
    // http://developer.mozilla.org/En/Code_snippets/On_page_load
    var appcontent = document.getElementById("appcontent");
    if (appcontent) {
      const csrpolicyOverlay = this;
      appcontent.addEventListener("DOMContentLoaded", function() {
            csrpolicyOverlay.onDOMContentLoaded(event)
          }, true);
      // Attempting to have the onPageLoad handler called after all page content
      // has attempted to be loaded, but not sure this is actually being called
      // late enough. Maybe those few remaining requests coming through are
      // content that isn't part of the initial load of the page?
      appcontent.addEventListener("load", function() {
            csrpolicyOverlay.onPageLoad(event)
          }, true);
    }
  },

  /**
   * Things to do when a page has loaded (after images, etc., have been loaded).
   * 
   * @param {Event}
   *            event
   */
  onPageLoad : function(event) {
    // TODO: This is getting called multiple times for a page, should only be
    // called once.

    if (event.originalTarget.nodeName != "#document") {
      // It's a favicon. See the note at
      // http://developer.mozilla.org/En/Code_snippets/On_page_load
      return;
    }

    this._checkForBlockedContent();
  },

  /**
   * Checks if the current document has blocked content and shows appropriate
   * notifications.
   */
  _checkForBlockedContent : function() {
    var uri = content.document.location;
    var rejectedRequests = this._csrpolicyJSObject._rejectedRequests[uri];
    var anyRejected = false;
    if (rejectedRequests) {
      Logger.vardump(rejectedRequests);
      for (var i in rejectedRequests) {
        for (var j in rejectedRequests[i]) {
          if (rejectedRequests[i][j]) {
            anyRejected = true;
          }
        }
      }
    }

    if (anyRejected) {
      // TODO: indicate to user that requests were rejected
      Logger.dump("Some requests rejected");
      var csrpolicyStatusbarLabel = document
          .getElementById("csrpolicyStatusbarLabel");
      csrpolicyStatusbarLabel.style.color = "#a00";
    } else {
      Logger.dump("No requests rejected");
    }
  },

  /**
   * Clears any blocked content notifications visible to the user.
   */
  _clearBlockedContentNotifications : function() {
    var csrpolicyStatusbarLabel = document
        .getElementById("csrpolicyStatusbarLabel");
    csrpolicyStatusbarLabel.style.color = "";
  },

  /**
   * Perform the actions required once the DOM is loaded. This may be being
   * called for more than just the page content DOM. It seems to work for now.
   * 
   * @param {Event}
   *            event
   */
  onDOMContentLoaded : function(event) {

    // TODO: Listen for DOMSubtreeModified and/or DOMLinkAdded to register
    // new links/forms with csrpolicy even if they are added after initial
    // load (e.g. they are added through javascript).

    var document = event.target;

    const csrpolicy = this._csrpolicy;

    // Clear any notifications that may have been present.
    this._clearBlockedContentNotifications();

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
      anchorTags[i].addEventListener("click", function(event) {
            csrpolicy.registerLinkClicked(event.target.ownerDocument.URL,
                event.target.href);
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
      formTags[i].addEventListener("submit", function(event) {
            csrpolicy.registerFormSubmitted(event.target.ownerDocument.URL,
                event.target.action);
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
    csrpolicyOverlay._wrapOpenLinkFunctions();
  },

  /**
   * Changes the gContextMenu's functions that open links in new tabs or windows
   * such that they first call our own functions before the original open in new
   * link/window functions are executed.
   */
  _wrapOpenLinkFunctions : function() {
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
  },

  /**
   * Called before the statusbar menu is shown.
   * 
   * @param {Event}
   *            event
   */
  onMenuShowing : function(event) {
    if (event.currentTarget != event.originalTarget) {
      return;
    }
    this.prepareMenu();
  },

  /**
   * Determines the current document's hostname without the "www.".
   * 
   * @return {String} The current document's hostname without any leading
   *         "www.".
   */
  _getCurrentHostWithoutWww : function _getCurrentHostWithoutWww() {
    var host = DomainUtils.getHost(content.document.documentURI);
    return DomainUtils.stripWww(host);
  },

  /**
   * Prepares the statusbar menu based on the user's settings and the current
   * document.
   */
  prepareMenu : function() {
    // TODO: This is broken for schemes that don't have host values (e.g.
    // "file")
    var host = this._getCurrentHostWithoutWww();

    // The menu items we may need.
    var itemIgnoreOrigin = document.getElementById("csrpolicyIgnoreOrigin");
    var itemIgnoreOriginSeparator = document
        .getElementById("csrpolicyIgnoreOriginSeparator");
    var itemRevokeTemporaryPermissions = document
        .getElementById("csrpolicyRevokeTemporaryPermissions");
    var itemRevokeTemporaryPermissionsSeparator = document
        .getElementById("csrpolicyRevokeTemporaryPermissionsSeparator");
    var itemAllowOriginTemporarily = document
        .getElementById("csrpolicyAllowOriginTemporarily");
    var itemAllowOrigin = document.getElementById("csrpolicyAllowOrigin");
    var itemForbidOrigin = document.getElementById("csrpolicyForbidOrigin");

    // Set all labels here for convenience, even though we won't display some of
    // these menu items.
    itemIgnoreOrigin.label = this._strbundle.getFormattedString("ignoreOrigin",
        [host]);
    itemForbidOrigin.label = this._strbundle.getFormattedString("forbidOrigin",
        [host]);
    itemAllowOriginTemporarily.label = this._strbundle.getFormattedString(
        "allowOriginTemporarily", [host]);
    itemAllowOrigin.label = this._strbundle.getFormattedString("allowOrigin",
        [host]);

    // Initially make all menu items hidden.
    itemIgnoreOrigin.hidden = true;
    itemIgnoreOriginSeparator.hidden = true;
    itemRevokeTemporaryPermissions.hidden = true;
    itemRevokeTemporaryPermissionsSeparator.hidden = true;
    itemAllowOriginTemporarily.hidden = true;
    itemAllowOrigin.hidden = true;
    itemForbidOrigin.hidden = true;

    if (this._csrpolicy.isTemporarilyAllowedOrigin(host)) {
      itemForbidOrigin.hidden = false;
    } else if (this._csrpolicy.isAllowedOrigin(host)) {
      itemForbidOrigin.hidden = false;
    } else {
      itemAllowOriginTemporarily.hidden = false;
      itemAllowOrigin.hidden = false;
    }

    if (this._csrpolicy.isTemporarilyAllowedOrigin(host)) {
      // TODO: The condition should be related to any temporary permissions that
      // affect the current document, including temporary destinations and
      // temporary origin-to-destination pairs.
      itemRevokeTemporaryPermissions.hidden = false;
      itemRevokeTemporaryPermissionsSeparator.hidden = false;
    } else if (this._csrpolicy.isAllowedOrigin(host) == false) {
      if (this._csrpolicy.isIgnoredOrigin(host) == false) {
        itemIgnoreOrigin.hidden = false;
        itemIgnoreOriginSeparator.hidden = false;
      }
    }
  },

  /**
   * Reloads the current document if the user's preferences indicate it should
   * be reloaded.
   */
  _conditionallyReloadDocument : function() {
    if (this._csrpolicy.prefs.getBoolPref("autoReload")) {
      content.document.location.reload(true);
    }
  },

  /**
   * Allows the current document's origin to request from any destination for
   * the duration of the browser session.
   * 
   * @param {Event}
   *            event
   */
  temporarilyAllowOrigin : function(event) {
    // Note: the available variable "content" is different than the avaialable
    // "window.target".
    var host = this._getCurrentHostWithoutWww();
    this._csrpolicy.temporarilyAllowOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows the current document's origin to request from any destination,
   * including in future browser sessions.
   * 
   * @param {Event}
   *            event
   */
  allowOrigin : function(event) {
    var host = this._getCurrentHostWithoutWww();
    this._csrpolicy.allowOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Forbids the current document's origin from requesting from any destination.
   * This revoke's temporary or permanent request permissions the origin had
   * been given.
   * 
   * @param {Event}
   *            event
   */
  forbidOrigin : function(event) {
    var host = this._getCurrentHostWithoutWww();
    this._csrpolicy.forbidOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Ignores the current document's origin when requests from the origin are
   * blocked. When a site is ignored, no warning is shown to the user when
   * requests are blocked.
   * 
   * @param {Event}
   *            event
   */
  ignoreOrigin : function(event) {
    var host = this._getCurrentHostWithoutWww();
    this._csrpolicy.ignoreOrigin(host);
  },

  /**
   * Revokes all temporary permissions granted during the current session.
   * 
   * @param {Event}
   *            event
   */
  revokeTemporaryPermissions : function(event) {
    this._csrpolicy.revokeTemporaryPermissions();
    this._conditionallyReloadDocument();
  }
};

// Initialize the csrpolicyOverlay object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      csrpolicyOverlay.init();
    }, false);

// Registers event handlers for documents loaded in the window.
addEventListener("load", function(event) {
      csrpolicyOverlay.onLoad(event);
    }, false);
