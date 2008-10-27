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
  _addedMenuItems : [],
  _menu : null,
  _blockedDestinationsMenu : null,
  _allowedDestinationsMenu : null,

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
      this._menu = document.getElementById("csrpolicyStatusbarPopup");

      this._blockedDestinationsMenu = document
          .getElementById("csrpolicyBlockedDestinationsPopup");
      this._allowedDestinationsMenu = document
          .getElementById("csrpolicyAllowedDestinationsPopup");
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
    var appcontent = document.getElementById("appcontent"); // browser
    if (appcontent) {
      const csrpolicyOverlay = this;
      appcontent.addEventListener("DOMContentLoaded", function(event) {
            csrpolicyOverlay.onPageLoad(event);
          }, true);
      // Attempting to have the onPageLoad handler called after all page content
      // has attempted to be loaded, but not sure this is actually being called
      // late enough. Maybe those few remaining requests coming through are
      // content that isn't part of the initial load of the page?
      // appcontent.addEventListener("load", function() {
      // csrpolicyOverlay.onPageLoad(event)
      // }, true);
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

    this._onDOMContentLoaded(event);
    this._checkForBlockedContent();
  },

  /**
   * Checks if the current document has blocked content and shows appropriate
   * notifications.
   */
  _checkForBlockedContent : function() {
    var uri = this._getCurrentUri();
    var rejectedRequests = this._csrpolicyJSObject._rejectedRequests[uri];
    var anyRejected = false;
    if (rejectedRequests) {
      for (var i in rejectedRequests) {
        for (var j in rejectedRequests[i]) {
          if (rejectedRequests[i][j]) {
            anyRejected = true;
          }
        }
      }
    }

    if (anyRejected) {
      this._setBlockedContentNotification();
    }
  },

  /**
   * Creates a blocked content notifications visible to the user.
   */
  _setBlockedContentNotification : function() {
    var csrpolicyStatusbarLabel = document
        .getElementById("csrpolicyStatusbarLabel");
    csrpolicyStatusbarLabel.style.color = "#a00";
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
  _onDOMContentLoaded : function(event) {

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
      Logger.dump("Added click listener to link: " + anchorTags[i].href);
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
   * Determines the current document's uri identifier based on the current
   * identifier level setting.
   * 
   * @return {String} The current document's identifier.
   */
  _getCurrentUriIdentifier : function _getCurrentUriIdentifier() {
    return this._csrpolicyJSObject.getUriIdentifier(this._getCurrentUri());
  },

  _getCurrentUri : function _getCurrentUriIdentifier() {
    return DomainUtils.stripFragment(content.document.documentURI);
  },

  /**
   * Prepares the statusbar menu based on the user's settings and the current
   * document.
   */
  prepareMenu : function() {
    var currentIdentifier = this._getCurrentUriIdentifier();

    // The menu items we may need.
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
    itemForbidOrigin.label = this._strbundle.getFormattedString("forbidOrigin",
        [currentIdentifier]);
    itemAllowOriginTemporarily.label = this._strbundle.getFormattedString(
        "allowOriginTemporarily", [currentIdentifier]);
    itemAllowOrigin.label = this._strbundle.getFormattedString("allowOrigin",
        [currentIdentifier]);

    // Initially make all menu items hidden.
    itemRevokeTemporaryPermissions.hidden = true;
    itemRevokeTemporaryPermissionsSeparator.hidden = true;
    itemAllowOriginTemporarily.hidden = true;
    itemAllowOrigin.hidden = true;
    itemForbidOrigin.hidden = true;

    if (this._csrpolicy.isTemporarilyAllowedOrigin(currentIdentifier)) {
      itemForbidOrigin.hidden = false;
    } else if (this._csrpolicy.isAllowedOrigin(currentIdentifier)) {
      itemForbidOrigin.hidden = false;
    } else {
      itemAllowOriginTemporarily.hidden = false;
      itemAllowOrigin.hidden = false;
    }

    if (this._csrpolicy.isTemporarilyAllowedOrigin(currentIdentifier)) {
      // TODO: The condition should be related to any temporary permissions that
      // affect the current document, including temporary destinations and
      // temporary origin-to-destination pairs.
      itemRevokeTemporaryPermissions.hidden = false;
      itemRevokeTemporaryPermissionsSeparator.hidden = false;
    }

    // Clear destinations submenus.
    while (this._blockedDestinationsMenu.firstChild) {
      this._blockedDestinationsMenu
          .removeChild(this._blockedDestinationsMenu.firstChild);
    }
    while (this._allowedDestinationsMenu.firstChild) {
      this._allowedDestinationsMenu
          .removeChild(this._allowedDestinationsMenu.firstChild);
    }

    // Remove old menu items.
    for (var i in this._addedMenuItems) {
      this._menu.removeChild(this._addedMenuItems[i]);
    }
    this._addedMenuItems = [];

    var uri = this._getCurrentUri();

    // Add new menu items giving options to allow content.
    var rejectedRequests = this._csrpolicyJSObject._rejectedRequests[uri];
    for (var destIdentifier in rejectedRequests) {
      this._addBlockedDestinationsMenuSeparator();
      this._addMenuItemTemporarilyAllowDest(destIdentifier);
      this._addMenuItemAllowDest(destIdentifier);
    }

    // Add new menu items giving options to forbid currently accepted content.
    var allowedRequests = this._csrpolicyJSObject._allowedRequests[uri];
    for (var destIdentifier in allowedRequests) {
      if (destIdentifier == this._getCurrentUriIdentifier()) {
        continue;
      }
      this._addAllowedDestinationsMenuSeparator();
      this._addMenuItemForbidDest(destIdentifier);
    }

    this._cleanupMenus();

  },

  _cleanupMenus : function() {
    this._removeExtraSubmenuSeparators(this._blockedDestinationsMenu);
    this._removeExtraSubmenuSeparators(this._allowedDestinationsMenu);

    this._disableMenuIfEmpty(this._blockedDestinationsMenu);
    this._disableMenuIfEmpty(this._allowedDestinationsMenu);
  },

  _removeExtraSubmenuSeparators : function(menu) {
    if (menu.firstChild && menu.lastChild.nodeName == "menuseparator") {
      menu.removeChild(menu.lastChild);
    }
  },

  _disableMenuIfEmpty : function(menu) {
    // parentNode is the menu label
    menu.parentNode.disabled = menu.firstChild ? false : true;
  },

  _addMenuItemTemporarilyAllowDest : function(destHost) {
    var label = "Temporarily allow requests to " + destHost;
    // TODO: sanitize destHost
    var command = "csrpolicyOverlay.temporarilyAllowDestination('" + destHost
        + "');";
    var statustext = destHost;
    var item = this._addBlockedDestinationsMenuItem(destHost, label, command,
        statustext);
    item.setAttribute("class", "csrpolicyTemporary");
  },

  _addMenuItemAllowDest : function(destHost) {
    var label = "Always allow requests to " + destHost;
    // TODO: sanitize destHost
    var command = "csrpolicyOverlay.allowDestination('" + destHost + "');";
    var statustext = destHost;
    var item = this._addBlockedDestinationsMenuItem(destHost, label, command,
        statustext);
  },

  _addMenuItemForbidDest : function(destHost) {
    var label = "Forbid requests to " + destHost;
    // TODO: sanitize destHost
    var command = "csrpolicyOverlay.forbidDestination('" + destHost + "');";
    var statustext = destHost;
    var item = this._addAllowedDestinationsMenuItem(destHost, label, command,
        statustext);
  },

  _addMenuSeparator : function() {
    var separator = document.createElement("menuseparator");
    this._menu.insertBefore(separator, this._menu.firstChild);
    this._addedMenuItems.push(separator);
  },

  _addBlockedDestinationsMenuSeparator : function() {
    var separator = document.createElement("menuseparator");
    this._blockedDestinationsMenu.insertBefore(separator,
        this._blockedDestinationsMenu.firstChild);
  },

  _addAllowedDestinationsMenuSeparator : function() {
    var separator = document.createElement("menuseparator");
    this._allowedDestinationsMenu.insertBefore(separator,
        this._allowedDestinationsMenu.firstChild);
  },

  _addMenuItem : function(destHost, label, oncommand, statustext) {
    var newNode = document.createElement("menuitem");
    // newNode.setAttribute("label", this.getString("allowTemp", [menuSite]));
    newNode.setAttribute("label", label);
    newNode.setAttribute("statustext", statustext);
    newNode.setAttribute("oncommand", oncommand);
    // newNode.setAttribute("class", cssClass + " noscript-temp
    // noscript-allow");
    // newNode.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
    this._menu.insertBefore(newNode, this._menu.firstChild);
    this._addedMenuItems.push(newNode);
    return newNode;
  },

  _addBlockedDestinationsMenuItem : function(destHost, label, oncommand,
      statustext) {
    var newNode = document.createElement("menuitem");
    newNode.setAttribute("label", label);
    newNode.setAttribute("statustext", statustext);
    newNode.setAttribute("oncommand", oncommand);
    this._blockedDestinationsMenu.insertBefore(newNode,
        this._blockedDestinationsMenu.firstChild);
    return newNode;
  },

  _addAllowedDestinationsMenuItem : function(destHost, label, oncommand,
      statustext) {
    var newNode = document.createElement("menuitem");
    newNode.setAttribute("label", label);
    newNode.setAttribute("statustext", statustext);
    newNode.setAttribute("oncommand", oncommand);
    this._allowedDestinationsMenu.insertBefore(newNode,
        this._allowedDestinationsMenu.firstChild);
    return newNode;
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
    var host = this._getCurrentUriIdentifier();
    this._csrpolicy.temporarilyAllowOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows a destination to be requested from any origin for the duration of
   * the browser session.
   * 
   * @param {String}
   *            destHost
   */
  temporarilyAllowDestination : function(destHost) {
    this._csrpolicy.temporarilyAllowDestination(destHost);
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
    var host = this._getCurrentUriIdentifier();
    this._csrpolicy.allowOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows requests to a destination, including in future browser sessions.
   * 
   * @param {String}
   *            destHost
   */
  allowDestination : function(destHost) {
    this._csrpolicy.allowDestination(destHost);
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
    var host = this._getCurrentUriIdentifier();
    this._csrpolicy.forbidOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Forbids a destination from being requested by any origina. This revoke's
   * temporary or permanent request permissions the destination had been given.
   * 
   * @param {String}
   *            destHost
   */
  forbidDestination : function(destHost) {
    this._csrpolicy.forbidDestination(destHost);
    this._conditionallyReloadDocument();
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
