Components.utils.import("resource://requestpolicy/DomainUtils.jsm");
Components.utils.import("resource://requestpolicy/FileUtils.jsm");
Components.utils.import("resource://requestpolicy/Logger.jsm");

/**
 * Provides functionality for the overlay. An instance of this class exists for
 * each tab/window.
 */
var requestpolicyOverlay = {

  _overlayId : 0,

  _prefetchInfoUri : "http://www.requestpolicy.com/help/prefetch.html",
  _prefetchDisablingInstructionsUri : "http://www.requestpolicy.com/help/prefetch.html#disable",

  _blockedContentCheckTimeoutDelay : 1000, // milliseconds
  _blockedContentCheckTimeoutId : null,
  _blockedContentCheckMinWaitOnObservedBlockedRequest : 500,
  _blockedContentCheckLastTime : 0,

  _initialized : false,
  _requestpolicy : null,

  // For things we can't do through the nsIRequestPolicy interface, use direct
  // access to the underlying JS object.
  _requestpolicyJSObject : null,

  // This is set by requestLog.js when it is initialized. We don't need to worry
  // about setting it here.
  requestLogTreeView : null,

  _strbundle : null,
  _addedMenuItems : [],
  _menu : null,

  _blockedDestinationsItems : [],
  _allowedDestinationsItems : [],

  _blockedDestinationsHeadingMenuItem : null,
  _allowedDestinationsHeadingMenuItem : null,

  _blockedDestinationsBeforeReferenceItem : null,
  _allowedDestinationsBeforeReferenceItem : null,

  _itemPrefetchWarning : null,
  _itemPrefetchWarningSeparator : null,

  _itemOtherOrigins : null,
  _itemOtherOriginsPopup : null,
  _itemOtherOriginsSeparator : null,

  _itemRevokeTemporaryPermissions : null,
  _itemRevokeTemporaryPermissionsSeparator : null,

  _itemAllowAllTemporarily : null,

  _itemAllowOriginTemporarily : null,
  _itemAllowOrigin : null,
  _itemForbidOrigin : null,

  _statusbar : null,
  _rpStatusbar : null,
  _rpContextMenu : null,
  _toolbox : null,

  _missingImageDataUri : "data:image/png;base64,"
      + "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c"
      + "6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0"
      + "SU1FB9gMFRANL5LXnioAAAJWSURBVDjLnZI/ixtXFMV/972ZNzPSrmTtalex"
      + "lsWBGMfEYOzaVciXyKdIkW/hFKnS22WafIDUxk0g2AQSgm0csIPWK42ktaSR"
      + "NPP+pRBK5SLOqS7cew7ccw4xxrPJ+8XdHx4+7AE8e3Cj++zLm71fvrqT8x+Q"
      + "AK35dJr2n/x89urTa+eDm/cS+eI2y3eT+Lx/bt8u1vNqfDH++teXdk/6ThAf"
      + "UUBIgL9ku75z/8WL7LOlhXIGJ0Pyw75wMcnGv//xSQ2DH4ddu9k01dXWsWzc"
      + "ofhYaiiViLjiWi9UWQa1gzcjWF7hgfzzW5ydnXB62JLjg0PTLfJertNepnQS"
      + "IA+gE4Cs03UuNYYQYP4e5jPogmSG9vA6rrjC+0AxN2i5Qk0DpXVJhCQB0EVR"
      + "rzqdFgB1DZfvCDHixiV2NqO6LHHKIKnQMoaWbFBgIrQVgIXaDc+JCHgP5QRZ"
      + "r4jzGWFbo6yncRYviiiQKUhBRch3Lyix4bgPWsAkcDkmZAV2OiE0DaI1WoES"
      + "hRKF3sWnmt01pFBnJydEpZDEwHSGt47lYsls43AIXjTWV9R1Qx0DGahqLyAh"
      + "bqrj0/ib0nRzXNoyCo0Kkor2llV0eKOwdUMg4pSQA7JPQXvnJv1B+GlwOvrG"
      + "laXB6fV2lb5t6qOtike56DSJgYDGBQcOAsQAfueBMeHR48fhadb1j/58HWAR"
      + "dt6yBv7+/vpBe2o5OogxlcaKdt5aKCNsk309W0WxKQjmQ33/9mJVAdWHdmo/"
      + "tNvtRZIkfCz+ZQwGg6rT6Zj/LTAajTbD4bD5WIF/AAseEisPFO8uAAAAAElF"
      + "TkSuQmCC",

  toString : function() {
    return "[requestpolicyOverlay " + this._overlayId + "]";
  },

  /**
   * Initialize the object. This must be done after the DOM is loaded.
   */
  init : function() {
    if (this._initialized == false) {
      this._initialized = true;
      this._overlayId = (new Date()).getTime();

      this._requestpolicy = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
          .getService(Components.interfaces.nsIRequestPolicy);
      this._requestpolicyJSObject = this._requestpolicy.wrappedJSObject;

      this._strbundle = document.getElementById("requestpolicyStrings");
      this._menu = document.getElementById("requestpolicyStatusbarPopup");

      this._blockedDestinationsBeforeReferenceItem = document
          .getElementById("requestpolicyAllowedDestinationsSeparator");
      this._allowedDestinationsBeforeReferenceItem = document
          .getElementById("requestpolicyOriginSubmenusSeparator");

      this._blockedDestinationsHeadingMenuItem = document
          .getElementById("requestpolicyBlockedDestinations");
      this._allowedDestinationsHeadingMenuItem = document
          .getElementById("requestpolicyAllowedDestinations");

      this._itemPrefetchWarning = document
          .getElementById("requestpolicyPrefetchWarning");
      this._itemPrefetchWarningSeparator = document
          .getElementById("requestpolicyPrefetchWarningSeparator");

      this._itemOtherOrigins = document
          .getElementById("requestpolicyOtherOrigins");
      this._itemOtherOriginsPopup = document
          .getElementById("requestpolicyOtherOriginsPopup");
      this._itemOtherOriginsSeparator = document
          .getElementById("requestpolicyOtherOriginsSeparator");

      this._itemRevokeTemporaryPermissions = document
          .getElementById("requestpolicyRevokeTemporaryPermissions");
      this._itemRevokeTemporaryPermissionsSeparator = document
          .getElementById("requestpolicyRevokeTemporaryPermissionsSeparator");

      this._itemAllowAllTemporarily = document
          .getElementById("requestpolicyAllowAllTemporarily");

      this._itemAllowOriginTemporarily = document
          .getElementById("requestpolicyAllowOriginTemporarily");
      this._itemAllowOrigin = document
          .getElementById("requestpolicyAllowOrigin");
      this._itemForbidOrigin = document
          .getElementById("requestpolicyForbidOrigin");

      this._statusbar = document.getElementById("status-bar");
      this._rpStatusbar = document.getElementById("requestpolicyStatusbar");
      this._rpContextMenu = document.getElementById("requestpolicyContextMenu");
      this._toolbox = document.getElementById("navigator-toolbox");

      // Register this window with the requestpolicy service so that we can be
      // notified of blocked requests. When blocked requests happen, this
      // object's observerBlockedRequests() method will be called.
      this._requestpolicyJSObject.addRequestObserver(this);

      this.setStatusbarIconStyle(this._requestpolicy.prefs
          .getCharPref("statusbarIcon"));

      this._setPermissiveNotification(this._requestpolicy.isBlockingDisabled());
    }
  },

  setStatusbarIconStyle : function(iconStyle) {
    this._rpStatusbar.setAttribute("iconStyle", iconStyle);
  },

  onWindowClose : function(event) {
    this._requestpolicyJSObject.removeRequestObserver(this);
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
    const requestpolicyOverlay = this;
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", function(event) {
            requestpolicyOverlay.onAppContentLoaded(event);
          }, true);

      // DOMFrameContentLoaded is same DOMContentLoaded but also fires for
      // enclosed frames.
      appcontent.addEventListener("DOMFrameContentLoaded", function(event) {
            requestpolicyOverlay.onAppFrameContentLoaded(event);
          }, true);

      // Add a click handler so we can register all link clicks and be able to
      // allow them.
      // This seems to be a safe approach in that the MDC states that javascript
      // can't be used to initiate a click event on a link:
      // http://developer.mozilla.org/en/DOM/element.click
      appcontent.addEventListener("click", function(event) {
            // We're only interested in left-clicks on anchor tags.
            if (event.target.nodeName.toLowerCase() != "a" || event.button != 0) {
              return;
            }
            requestpolicyOverlay._requestpolicy.registerLinkClicked(
                event.target.ownerDocument.URL, event.target.href);
          }, true);

      // Add a submit handler so we can register all form submissions and be
      // able to allow them.
      // As far as I can tell, calling a form's submit() method from javascript
      // will not cause this event listener to fire even though it will submit
      // the form, which makes things easier in that we don't have to find
      // another way to tell if the user submitted the form or if it was done by
      // javascript. However, I'm not sure on the specifics of why submit() from
      // javascript doesn't end up calling this. I can only conclude it's the
      // same difference as with link clicks by humans vs. click(), but that the
      // documentation just doesn't state this (with the exception that
      // nonprivileged code can call submit(), but it just doesn't result in a
      // submit event going through the DOM).
      appcontent.addEventListener("submit", function(event) {
            if (event.target.nodeName.toLowerCase() != "form") {
              return;
            }
            requestpolicyOverlay._requestpolicy.registerFormSubmitted(
                event.target.ownerDocument.URL, event.target.action);
          }, true);
    }

    // Add an event listener for when the contentAreaContextMenu (generally the
    // right-click menu within the document) is shown.
    var contextMenu = document.getElementById("contentAreaContextMenu");
    if (contextMenu) {
      contextMenu.addEventListener("popupshowing",
          this._contextMenuOnPopupShowing, false);
    }

    // We consider the default place for the popup to be attached to the context
    // menu, so attach it there.
    this._attachPopupToContextMenu();

    // Listen for the user changing tab so we can update any notification or
    // indication of blocked requests.
    var container = gBrowser.tabContainer;
    container.addEventListener("TabSelect", function(event) {
          requestpolicyOverlay.tabChanged();
        }, false);

    this._wrapAddTab();
  },

  /**
   * Shows a notification that a redirect was requested by a page (meta refresh
   * or with headers).
   * 
   * @param {document}
   *            targetDocument
   * @param {String}
   *            redirectTargetUri
   * @param {int}
   *            delay
   */
  _showRedirectNotification : function(targetDocument, redirectTargetUri, delay) {
    // TODO: Do something with the delay. Not sure what the best thing to do is
    // without complicating the UI.

    // TODO: The following error seems to be resulting when the notification
    // goes away with a redirect, either after clicking "allow" or if the
    // redirect is allowed and happens automatically.
    //
    // Source file: chrome://browser/content/browser.js
    // Line: 3704
    // ----------
    // Error: self._closedNotification.parentNode is null
    // Source file: chrome://global/content/bindings/notification.xml
    // Line: 260

    if (!this._isTopLevelDocument(targetDocument)) {
      // Don't show notification if this isn't the main document of a tab;
      return;
    }

    var targetBrowser = gBrowser.getBrowserForDocument(targetDocument);
    var notificationBox = gBrowser.getNotificationBox(targetBrowser)
    var notificationValue = "request-policy-meta-redirect";
    var notificationLabel = this._strbundle.getFormattedString(
        "redirectNotification", [redirectTargetUri]);
    var notificationButtonOptions = this._strbundle.getString("options");
    var notificationButtonAllow = this._strbundle.getString("allow");
    var notificationButtonDeny = this._strbundle.getString("deny");

    optionsPopupName = "requestpolicyRedirectNotificationOptions";
    var optionsPopup = document.getElementById(optionsPopupName);
    this._clearMenu(optionsPopup);
    var currentIdent = this._requestpolicy
        .getUriIdentifier(targetDocument.location);
    var destIdent = this._requestpolicy.getUriIdentifier(redirectTargetUri);

    this._addMenuItemTemporarilyAllowOriginToDest(optionsPopup, currentIdent,
        destIdent);
    this._addMenuItemAllowOriginToDest(optionsPopup, currentIdent, destIdent);

    var notification = notificationBox
        .getNotificationWithValue(notificationValue);
    if (notification) {
      notification.label = notificationLabel;
    } else {
      var buttons = [{
            label : notificationButtonOptions,
            accessKey : '', // TODO
            popup : optionsPopupName,
            callback : null
          }, {
            label : notificationButtonAllow,
            accessKey : '', // TODO
            popup : null,
            callback : function() {
              Logger.dump("User allowed redirection from <"
                  + targetDocument.location.href + "> to <" + redirectTargetUri
                  + ">");
              targetDocument.location.href = redirectTargetUri;
            }
          }, {
            label : notificationButtonDeny,
            accessKey : '', // TODO
            popup : null,
            callback : function() {
              // Do nothing. The notification closes when this is called.
            }
          }];
      const priority = notificationBox.PRIORITY_WARNING_MEDIUM;
      notificationBox.appendNotification(notificationLabel, notificationValue,
          "chrome://browser/skin/Info.png", priority, buttons);
    }
  },

  /**
   * Determines if documentToCheck is the main document loaded in a frame.
   * 
   * @param {document}
   *            documentToCheck
   * @return {Boolean}
   */
  _isTopLevelDocument : function(documentToCheck) {
    var num = gBrowser.browsers.length;
    for (var i = 0; i < num; i++) {
      if (gBrowser.getBrowserAtIndex(i).contentDocument == documentToCheck) {
        return true;
      }
    }
    return false;
  },

  _isActiveTopLevelDocument : function(documentToCheck) {
    return documentToCheck == content.document;
  },

  /**
   * Performs actions required to be performed after a tab change.
   */
  tabChanged : function() {
    this._checkForBlockedContent(content.document);
  },

  /**
   * Things to do when a page has loaded (after images, etc., have been loaded).
   * 
   * @param {Event}
   *            event
   */
  onAppContentLoaded : function(event) {
    // TODO: This is getting called multiple times for a page, should only be
    // called once.

    if (event.originalTarget.nodeName != "#document") {
      // It's a favicon. See the note at
      // http://developer.mozilla.org/En/Code_snippets/On_page_load
      return;
    }

    var document = event.target;
    Logger.dump("onAppContentLoaded called for " + document.documentURI);
    if (!document) {
      // onAppContentLoaded getting called more often than it should? document
      // isn't set on new tab open when this is called.
      return;
    }

    this._onDOMContentLoaded(document);

    if (this._isActiveTopLevelDocument(document)) {
      // Clear any notifications that may have been present.
      this._setBlockedContentNotification(false);
      this._checkForBlockedContent(document);
    }
  },

  /**
   * Things to do when a page or a frame within the page has loaded.
   * 
   * @param {Event}
   *            event
   */
  onAppFrameContentLoaded : function(event) {
    // TODO: This only works for (i)frames that are direct children of the main
    // document, not (i)frames within those (i)frames.
    var iframe = event.target;
    Logger.debug(Logger.TYPE_INTERNAL, "onAppFrameContentLoaded called for <"
            + iframe.contentDocument.documentURI + "> in <"
            + iframe.ownerDocument.documentURI + ">");
    // TODO: maybe this can check if the iframe's documentURI is in the other
    // origins of the current document, and that way not just be limited to
    // direct children of the main document. That would require building the
    // other origins every time an iframe is loaded. Maybe, then, this should
    // use a timeout like observerBlockedRequests does.
    if (this._isActiveTopLevelDocument(iframe.ownerDocument)) {
      // This has an advantage over just relying on the observeBlockedRequest()
      // call in that this will clear a blocked content notification if there no
      // longer blocked content. Another way to solve this would be to observe
      // allowed requests as well as blocked requests.
      this._checkForBlockedContent(iframe.ownerDocument);
    }
  },

  /**
   * Checks if the document has blocked content and shows appropriate
   * notifications.
   */
  _checkForBlockedContent : function(document) {
    Logger
        .debug(Logger.TYPE_INTERNAL, "Checking for blocked content from page <"
                + document.documentURI + ">");
    this._blockedContentCheckLastTime = (new Date()).getTime();
    this._stopBlockedContentCheckTimeout();
    if (this._requestpolicy.originHasRejectedRequests(document.documentURI)) {
      Logger.debug(Logger.TYPE_INTERNAL, "Main document <"
              + document.documentURI + "> has rejected requests.");
      this._setBlockedContentNotification(true);
      this._indicateBlockedVisibleObjects(document);
      return;
    }
    var otherOrigins = this._getOtherOrigins(document);
    for (var i in otherOrigins) {
      for (var j in otherOrigins[i]) {
        Logger.dump("Checking for blocked content from " + j);
        if (this._requestpolicy.originHasRejectedRequests(j)) {
          Logger.debug(Logger.TYPE_INTERNAL, "Other origin <" + j
                  + "> of main document <" + document.documentURI
                  + "> has rejected requests.");
          this._setBlockedContentNotification(true);
          this._indicateBlockedVisibleObjects(document);
          return;
        }
      }
    }
    this._setBlockedContentNotification(false);
  },

  _indicateBlockedVisibleObjects : function(document) {
    if (!this._requestpolicy.prefs.getBoolPref("indicateBlockedObjects")) {
      return;
    }
    var images = document.getElementsByTagName("img");
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (img.requestpolicyBlocked && !img.requestpolicyIdentified) {
        img.requestpolicyIdentified = true;
        img.style.border = "solid 1px #fcc";
        img.style.backgroundRepeat = "no-repeat";
        img.style.backgroundPosition = "center center";
        img.style.backgroundImage = "url('" + this._missingImageDataUri + "')";
        if (!img.width) {
          img.width = 50;
        }
        if (!img.height) {
          img.height = 50;
        }
        // We want it to be registered as a broken image so that the alt text
        // shows. By default, the blocked image will just not show up at all.
        // Setting src to null worked on firefox 3.0 but not 3.1. So, use a
        // local url that doesn't exist (using resource:// because chrome:// is
        // forbidden in this context).
        img.src = "resource://doesnt/exist.png";
      }
    }
  },

  /**
   * Sets the blocked content notifications visible to the user.
   */
  _setBlockedContentNotification : function(isContentBlocked) {
    this._rpStatusbar.setAttribute("requestpolicyBlocked", isContentBlocked);
    this._rpContextMenu.setAttribute("requestpolicyBlocked", isContentBlocked);
    this._toolbox.setAttribute("requestpolicyBlocked", isContentBlocked);
  },

  /**
   * Sets the permissive status visible to the user for all windows.
   */
  _setPermissiveNotificationForAllWindows : function(isPermissive) {
    // We do it for all windows, not just the current one.
    for (var i = 0; i < Application.windows.length; i++) {
      // It seems that _window should be treated as privite, but it's there and
      // it is what we want.
      var window = Application.windows[i]._window;
      if (window.requestpolicyOverlay) {
        window.requestpolicyOverlay._setPermissiveNotification(isPermissive);
      }
    }
  },

  /**
   * Sets the permissive status visible to the user for just this window.
   */
  _setPermissiveNotification : function(isPermissive) {
    this._rpStatusbar.setAttribute("requestpolicyPermissive", isPermissive);
    this._rpContextMenu.setAttribute("requestpolicyPermissive", isPermissive);
    this._toolbox.setAttribute("requestpolicyPermissive", isPermissive);
    this._itemAllowAllTemporarily.setAttribute("checked", isPermissive);
  },

  observeAllowedRequest : function(originUri, destUri) {
    if (this.requestLogTreeView) {
      this.requestLogTreeView.addAllowedRequest(originUri, destUri);
    }
  },

  observeBlockedRequest : function(originUri, destUri) {
    this._updateNotificationDueToBlockedContent();
    if (this.requestLogTreeView) {
      this.requestLogTreeView.addBlockedRequest(originUri, destUri);
    }
  },

  _updateNotificationDueToBlockedContent : function() {
    if (this._blockedContentCheckTimeoutId) {
      return;
    }

    var curTime = (new Date()).getTime();
    if (this._blockedContentCheckLastTime
        + this._blockedContentCheckMinWaitOnObservedBlockedRequest > curTime) {
      const document = content.document;
      this._blockedContentCheckTimeoutId = document.defaultView.setTimeout(
          function() {
            requestpolicyOverlay._checkForBlockedContent(document);
          }, this._blockedContentCheckTimeoutDelay);
    } else {
      this._checkForBlockedContent(content.document);
    }
  },

  _stopBlockedContentCheckTimeout : function() {
    if (this._blockedContentCheckTimeoutId) {
      content.document.defaultView
          .clearTimeout(this._blockedContentCheckTimeoutId);
      this._blockedContentCheckTimeoutId = null;
    }
  },

  /**
   * Perform the actions required once the DOM is loaded. This may be being
   * called for more than just the page content DOM. It seems to work for now.
   * 
   * @param {Event}
   *            event
   */
  _onDOMContentLoaded : function(document) {
    const requestpolicy = this._requestpolicy;

    // Find all meta redirects.
    var metaTags = document.getElementsByTagName("meta");
    for (var i = 0; i < metaTags.length; i++) {
      if (metaTags[i].httpEquiv
          && metaTags[i].httpEquiv.toLowerCase() == "refresh") {
        // TODO: Register meta redirects so we can tell which blocked requests
        // were meta redirects in the statusbar menu.
        Logger.info(Logger.TYPE_META_REFRESH, "meta refresh to <"
                + metaTags[i].content + "> found in document at <"
                + document.location + ">");

        // TODO: move this logic to the requestpolicy service.
        var parts = DomainUtils.parseRefresh(metaTags[i].content);
        var delay = parts[0];
        var dest = parts[1];
        if (dest != undefined) {
          if (this._requestpolicyJSObject._blockingDisabled
              || this._requestpolicy.isAllowedRedirect(document.location, dest)) {
            // The meta refresh is allowed.
            this._performRedirectAfterDelay(document, dest, delay);
          } else {
            this._showRedirectNotification(document, dest, delay);
          }
        }
      }
    }

    // Find all anchor tags and add click events (which also fire when enter
    // is pressed while the element has focus).
    // This seems to be a safe approach in that the MDC states that javascript
    // can't be used to initiate a click event on a link:
    // http://developer.mozilla.org/en/DOM/element.click
    // We keep this even though we have the document looking for clicks because
    // for certain links the target will not be the link (and we can't use the
    // currentTarget in the other case it seems, as we can here). There probably
    // is some solution when handling the click events at the document level,
    // but I just don't know what it is. For now, there remains the risk of
    // dynamically added links whose target of the click event isn't the anchor
    // tag.
    var anchorTags = document.getElementsByTagName("a");
    for (var i = 0; i < anchorTags.length; i++) {
      anchorTags[i].addEventListener("click", function(event) {
            // Note: need to use currentTarget so that it is the link, not
            // something else within the link that got clicked, it seems.
            requestpolicy
                .registerLinkClicked(event.currentTarget.ownerDocument.URL,
                    event.currentTarget.href);
          }, false);
    }

    if (this._requestpolicyJSObject._blockedRedirects[document.location]) {
      var dest = this._requestpolicyJSObject._blockedRedirects[document.location];
      Logger.warning(Logger.TYPE_HEADER_REDIRECT,
          "Showing notification for blocked redirect. To <" + dest + "> "
              + "from <" + document.location + ">");
      this._showRedirectNotification(document, dest);
      delete this._requestpolicyJSObject._blockedRedirects[document.location];
    }

    this._wrapWindowOpen(document.defaultView);
  },

  /**
   * Called as an event listener when popupshowing fires on the
   * contentAreaContextMenu.
   */
  _contextMenuOnPopupShowing : function() {
    requestpolicyOverlay._wrapOpenLink();
    requestpolicyOverlay._attachPopupToContextMenu();
  },

  /**
   * Called as an event listener when popuphidden fires on the
   * contentAreaContextMenu.
   */
  _contextMenuOnPopupHidden : function(event) {
    if (event.currentTarget != event.originalTarget) {
      return;
    }
    requestpolicyOverlay._attachPopupToStatusbar();
  },

  /**
   * Wraps the gContextMenu's openLink() function so that RequestPolicy can be
   * aware of the window being opened. The openLinkInTab() method doesn't need
   * to be wrapped because addTab() is wrapped elsewhere and that ends up being
   * called when openLinkInTab() is called.
   */
  _wrapOpenLink : function() {
    const requestpolicy = this._requestpolicy;

    if (!gContextMenu.requestpolicyOrigOpenLink) {
      gContextMenu.requestpolicyOrigOpenLink = gContextMenu.openLink;
      gContextMenu.openLink = function() {
        requestpolicy.registerLinkClicked(gContextMenu.link.ownerDocument.URL,
            gContextMenu.link.href);
        return gContextMenu.requestpolicyOrigOpenLink();
      };
    }
  },

  /**
   * Modifies the addTab() function so that RequestPolicy can be aware of the
   * tab being opened. Assume that if the tab is being opened, it was an action
   * the user wanted (e.g. the equivalent of a link click). Using a TabOpen
   * event handler, I was unable to determine the referrer, so that approach
   * doesn't seem to be an option. This doesn't actually wrap addTab because the
   * extension TabMixPlus modifies the function rather than wraps it, so
   * wrapping it will break tabs if TabMixPlus is installed.
   */
  _wrapAddTab : function() {
    if (!gBrowser.requestpolicyAddTabModified) {
      gBrowser.requestpolicyAddTabModified = true;
      var functionSignature = "function addTab(aURI, aReferrerURI, aCharset, aPostData, aOwner, aAllowThirdPartyFixup) {";
      var newFirstCodeLine = "\n    requestpolicyOverlay.tabAdded(aURI, aReferrerURI);";
      // Add a line to the beginning of the addTab function.
      eval("gBrowser.addTab = "
          + gBrowser.addTab.toString().replace(functionSignature,
              functionSignature + newFirstCodeLine));
    }
  },

  /**
   * This is called by the modified addTab().
   * 
   * @param {String?}
   *            tabUri
   * @param {nsIURI}
   *            referrerUri
   */
  tabAdded : function(tabUri, referrerUri) {
    if (referrerUri) {
      this._requestpolicy.registerLinkClicked(referrerUri.spec, tabUri);
    }
  },

  /**
   * Wraps the window's open() method so that RequestPolicy can know the origin
   * and destination URLs of the window being opened. Assume that if
   * window.open() calls have made it this far, it's a window the user wanted
   * open (e.g. they have allowed the popup). Unfortunately, this method (or our
   * timing of doing this) doesn't seem to work for popups that are allowed
   * popups (the user has allowed popups from the domain). So, the workaround
   * was to also add the 'if(aContext.nodeName == "xul:browser" &&
   * aContext.currentURI && aContext.currentURI.spec == "about:blank")' to
   * shouldLoad().
   * 
   * @param {Window}
   *            window
   */
  _wrapWindowOpen : function(window) {
    const requestpolicy = this._requestpolicy;

    if (!window.requestpolicyOrigOpen) {
      window.requestpolicyOrigOpen = window.open;
      window.open = function(url, windowName, windowFeatures) {
        requestpolicy.registerLinkClicked(window.document.documentURI, url);
        return window.requestpolicyOrigOpen(url, windowName, windowFeatures);
      };
    }

    if (!window.requestpolicyOrigOpenDialog) {
      window.requestpolicyOrigOpenDialog = window.openDialog;
      window.openDialog = function() {
        // openDialog(url, name, features, arg1, arg2, ...)
        requestpolicy.registerLinkClicked(window.document.documentURI,
            arguments[0]);
        return window.requestpolicyOrigOpenDialog.apply(this, arguments);
      };
    }
  },

  /**
   * Called before the popup menu is shown.
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
   * Called after the popup menu is hidden.
   * 
   * @param {Event}
   *            event
   */
  onMenuHidden : function(event) {
    if (event.currentTarget != event.originalTarget) {
      return;
    }
    // Leave the popup attached to the context menu, as we consdier that the
    // default location for it.
    this._attachPopupToContextMenu();
  },

  /**
   * Determines the current document's uri identifier based on the current
   * identifier level setting.
   * 
   * @return {String} The current document's identifier.
   */
  _getCurrentUriIdentifier : function _getCurrentUriIdentifier() {
    return this._requestpolicyJSObject.getUriIdentifier(this._getCurrentUri());
  },

  _getCurrentUri : function _getCurrentUriIdentifier() {
    return DomainUtils.stripFragment(content.document.documentURI);
  },

  /**
   * Prepares the statusbar menu based on the user's settings and the current
   * document.
   */
  prepareMenu : function() {
    try {
      var currentIdentifier = this._getCurrentUriIdentifier();
      var currentUri = this._getCurrentUri();

      var otherOrigins = this._getOtherOrigins(content.document);
      this._dumpOtherOrigins(otherOrigins);

      // Set all labels here for convenience, even though we won't display some
      // of these menu items.
      this._itemForbidOrigin.setAttribute("label", this._strbundle
              .getFormattedString("forbidOrigin", [currentIdentifier]));
      this._itemAllowOriginTemporarily.setAttribute("label",
          this._strbundle.getFormattedString("allowOriginTemporarily",
              [currentIdentifier]));
      this._itemAllowOrigin.setAttribute("label", this._strbundle
              .getFormattedString("allowOrigin", [currentIdentifier]));

      // Initially make all menu items hidden.
      this._itemRevokeTemporaryPermissions.hidden = true;
      this._itemRevokeTemporaryPermissionsSeparator.hidden = true;
      this._itemAllowOriginTemporarily.hidden = true;
      this._itemAllowOrigin.hidden = true;
      this._itemForbidOrigin.hidden = true;

      this._itemPrefetchWarning.hidden = this._itemPrefetchWarningSeparator.hidden = !this._requestpolicy
          .isPrefetchEnabled();

      if (this._requestpolicy.isTemporarilyAllowedOrigin(currentIdentifier)) {
        this._itemForbidOrigin.hidden = false;
      } else if (this._requestpolicy.isAllowedOrigin(currentIdentifier)) {
        this._itemForbidOrigin.hidden = false;
      } else {
        this._itemAllowOriginTemporarily.hidden = false;
        this._itemAllowOrigin.hidden = false;
      }

      if (this._requestpolicy.areTemporaryPermissionsGranted()) {
        this._itemRevokeTemporaryPermissions.hidden = false;
        this._itemRevokeTemporaryPermissionsSeparator.hidden = false;
      }

      // Remove old menu items.
      for (var i in this._addedMenuItems) {
        this._menu.removeChild(this._addedMenuItems[i]);
      }
      this._addedMenuItems = [];

      // Add new menu items giving options to allow content.
      this._clearBlockedDestinations();
      // Get the requests rejected by the current uri.
      var rejectedRequests = this._getRejectedRequests(currentUri,
          currentIdentifier, otherOrigins);
      this._dumpRequestSet(rejectedRequests,
          "All rejected requests (including from other origins)");
      for (var destIdentifier in rejectedRequests) {
        var submenu = this._addBlockedDestination(this._menu,
            this._blockedDestinationsBeforeReferenceItem, destIdentifier, true);
        this._addMenuItemTemporarilyAllowDest(submenu, destIdentifier);
        this._addMenuItemAllowDest(submenu, destIdentifier);
        this._addMenuSeparator(submenu);
        this._addMenuItemTemporarilyAllowOriginToDest(submenu,
            currentIdentifier, destIdentifier);
        this._addMenuItemAllowOriginToDest(submenu, currentIdentifier,
            destIdentifier);
      }

      // Add new menu items giving options to forbid currently accepted
      // content.
      this._clearAllowedDestinations();
      var allowedRequests = this._getAllowedRequests(currentUri,
          currentIdentifier, otherOrigins);
      this._dumpRequestSet(allowedRequests,
          "All allowed requests (including from other origins)");
      for (var destIdentifier in allowedRequests) {
        // Ignore allowed requests that are to the same site.
        if (destIdentifier == currentIdentifier) {
          continue;
        }
        var submenu = this._addAllowedDestination(this._menu,
            this._allowedDestinationsBeforeReferenceItem, destIdentifier, true);

        // Show a "forbid ___" option that is specific to why the content is
        // allowed.

        // The "order" in which to show these may be worth further
        // consideration. Currently, the options for forbidding content start
        // from the "allow" rules that are most liberal if they exist and shows
        // the more specific ones if there aren't more liberal ones that would
        // apply. The big catch is putting it in any other order may result in
        // the user having to perform multiple "forbids" after successive
        // reloads, which would be unacceptable.

        if (this._requestpolicy.isAllowedOrigin(currentIdentifier)
            || this._requestpolicy
                .isTemporarilyAllowedOrigin(currentIdentifier)) {
          this._addMenuItemForbidOrigin(submenu, currentIdentifier);

        } else if (this._requestpolicy.isAllowedDestination(destIdentifier)
            || this._requestpolicy
                .isTemporarilyAllowedDestination(destIdentifier)) {
          this._addMenuItemForbidDest(submenu, destIdentifier);

        } else if (this._requestpolicy.isAllowedOriginToDestination(
            currentIdentifier, destIdentifier)
            || this._requestpolicy.isTemporarilyAllowedOriginToDestination(
                currentIdentifier, destIdentifier)) {
          this._addMenuItemForbidOriginToDest(submenu, currentIdentifier,
              destIdentifier);

        } else {
          // TODO: make very sure this can never happen or, better, get an idea
          // of when it can and make a sane default.
        }
      }

      // Create menu for other origins.
      this._clearChildMenus(this._itemOtherOriginsPopup);
      var currentOtherOriginMenu;
      var otherOriginMenuCount = 0;
      for (var otherOriginIdentifier in otherOrigins) {
        if (otherOriginIdentifier == currentIdentifier) {
          // It's not a different origin, it's the same.
          continue;
        }
        currentOtherOriginMenu = this._createOtherOriginMenu(
            otherOriginIdentifier, otherOrigins);
        // If there are no blocked/allowed destinations from this other origin,
        // don't display it.
        if (currentOtherOriginMenu.childNodes.length == 3) {
          var menuNotPopup = currentOtherOriginMenu.parentNode;
          this._clearChildMenus(menuNotPopup);
          this._itemOtherOriginsPopup.removeChild(menuNotPopup);
        } else {
          otherOriginMenuCount++;
        }
      }
      // If there are no other origins being displayed, don't display the "other
      // origins" item in the main menu.
      this._itemOtherOrigins.hidden = this._itemOtherOriginsSeparator.hidden = (otherOriginMenuCount == 0);

    } catch (e) {
      Logger.severe(Logger.TYPE_ERROR, "Fatal Error, " + e + ", stack was: "
              + e.stack);
      Logger.severe(Logger.TYPE_ERROR, "Unable to prepare menu due to error.");
      throw e;
    }
  },

  _createOtherOriginMenu : function(originIdentifier, otherOrigins) {
    var menu = this._addMenu(this._itemOtherOriginsPopup, originIdentifier);
    var newNode;

    var allowedIdentifiers = this._getAllowedRequests(null, originIdentifier,
        otherOrigins);
    for (var i in allowedIdentifiers) {
      // Ignore allowed requests that are to the same site.
      if (i == originIdentifier) {
        continue;
      }
      var submenu = this
          ._addAllowedDestination(menu, menu.firstChild, i, false);
      this._populateOtherOriginsMenuItemAllowedDestinations(submenu,
          originIdentifier, i);
    }

    newNode = this._allowedDestinationsHeadingMenuItem.cloneNode(true);
    newNode.setAttribute("id", null);
    menu.insertBefore(newNode, menu.firstChild);

    this._addMenuSeparator(menu);

    var blockedIdentifiers = this._getRejectedRequests(null, originIdentifier,
        otherOrigins);
    for (var i in blockedIdentifiers) {
      var submenu = this
          ._addBlockedDestination(menu, menu.firstChild, i, false);
      this._populateOtherOriginsMenuItemBlockedDestinations(submenu,
          originIdentifier, i);
    }

    newNode = this._blockedDestinationsHeadingMenuItem.cloneNode(true);
    newNode.setAttribute("id", null);
    menu.insertBefore(newNode, menu.firstChild);

    return menu;
  },

  _populateOtherOriginsMenuItemBlockedDestinations : function(submenu,
      originIdentifier, destIdentifier) {
    this._addMenuItemTemporarilyAllowDest(submenu, destIdentifier);
    this._addMenuItemAllowDest(submenu, destIdentifier);
    this._addMenuSeparator(submenu);
    this._addMenuItemTemporarilyAllowOriginToDest(submenu, originIdentifier,
        destIdentifier);
    this._addMenuItemAllowOriginToDest(submenu, originIdentifier,
        destIdentifier);
  },

  _populateOtherOriginsMenuItemAllowedDestinations : function(submenu,
      originIdentifier, destIdentifier) {
    if (this._requestpolicy.isAllowedOrigin(originIdentifier)
        || this._requestpolicy.isTemporarilyAllowedOrigin(originIdentifier)) {
      this._addMenuItemForbidOrigin(submenu, originIdentifier);

    } else if (this._requestpolicy.isAllowedDestination(destIdentifier)
        || this._requestpolicy.isTemporarilyAllowedDestination(destIdentifier)) {
      this._addMenuItemForbidDest(submenu, destIdentifier);

    } else if (this._requestpolicy.isAllowedOriginToDestination(
        originIdentifier, destIdentifier)
        || this._requestpolicy.isTemporarilyAllowedOriginToDestination(
            originIdentifier, destIdentifier)) {
      this._addMenuItemForbidOriginToDest(submenu, originIdentifier,
          destIdentifier);

    } else {
      // TODO: make very sure this can never happen or, better, get an idea
      // of when it can and make a sane default.
    }
  },

  _getRejectedRequests : function(currentUri, currentIdentifier, otherOrigins) {
    var rejectedRequests = {};
    if (currentUri in this._requestpolicyJSObject._rejectedRequests) {
      for (var ident in this._requestpolicyJSObject._rejectedRequests[currentUri]) {
        rejectedRequests[ident] = true;
      }
    }
    // Add the rejected requests from other origins within this page that have
    // the same uriIdentifier as the current page.
    if (currentIdentifier in otherOrigins) {
      for (var i in otherOrigins[currentIdentifier]) {
        if (i in this._requestpolicyJSObject._rejectedRequests) {
          this._dumpRequestSet(
              this._requestpolicyJSObject._rejectedRequests[i],
              "Rejected requests of " + i);
          for (var ident in this._requestpolicyJSObject._rejectedRequests[i]) {
            rejectedRequests[ident] = true;
          }
        }
      }
    }
    return rejectedRequests;
  },

  _getAllowedRequests : function(currentUri, currentIdentifier, otherOrigins) {
    var allowedRequests = {};
    if (currentUri in this._requestpolicyJSObject._allowedRequests) {
      for (var ident in this._requestpolicyJSObject._allowedRequests[currentUri]) {
        allowedRequests[ident] = true;
      }
    }
    // Add the allowed requests from other origins within this page that have
    // the same uriIdentifier as the current page.
    if (currentIdentifier in otherOrigins) {
      for (var i in otherOrigins[currentIdentifier]) {
        if (i in this._requestpolicyJSObject._allowedRequests) {
          for (var ident in this._requestpolicyJSObject._allowedRequests[i]) {
            allowedRequests[ident] = true;
          }
        }
      }
    }
    return allowedRequests;
  },

  /**
   * This will look both at the DOM as well as the recorded allowed requests to
   * determine which other origins exist within the document. This includes
   * other origins that have the same domain. The returned format is an object
   * with properties that are URI identifiers and the properties of those are
   * the actual other URIs (i.e. origin[uriIdent][uri]). The reason for also
   * needing to check the DOM is that some sites (like gmail) will make multiple
   * requests to the same uri for different iframs and this will cause us to
   * only have in the recorded requests from a source uri the destinations from
   * the most recent iframe that loaded that source uri. It may also help in
   * cases where the user has multiple tabs/windows open to the same page.
   * 
   * @param {}
   *            document
   * @return {}
   */
  _getOtherOrigins : function(document) {
    var origins = {};
    this._getOtherOriginsHelperFromDOM(document, origins);
    this._getOtherOriginsHelperFromAllowedRequests(document.documentURI,
        origins, {});
    return origins;
  },

  _getOtherOriginsHelperFromDOM : function(document, origins) {
    Logger.dump("Looking for other origins within DOM of "
        + document.documentURI);
    // TODO: Check other elements besides iframes and frames?
    var frameTagTypes = {
      "iframe" : null,
      "frame" : null
    };
    for (var tagType in frameTagTypes) {
      var iframes = document.getElementsByTagName(tagType);
      for (var i = 0; i < iframes.length; i++) {
        var child = iframes[i];
        var childDocument = child.contentDocument;
        var childUri = DomainUtils.stripFragment(childDocument.documentURI);
        if (childUri == "about:blank") {
          // iframe empty or not loaded yet, or maybe blocked.
          // childUri = child.src;
          // If it's not loaded or blocked, it's not the origin for anything
          // yet.
          continue;
        }
        Logger.dump("Found DOM child " + tagType + " with src <" + childUri
            + "> in document <" + document.documentURI + ">");
        var childUriIdent = this._requestpolicy.getUriIdentifier(childUri);
        if (!origins[childUriIdent]) {
          origins[childUriIdent] = {};
        }
        origins[childUriIdent][childUri] = true;
        this._getOtherOriginsHelperFromDOM(childDocument, origins);
      }
    }
  },

  _getOtherOriginsHelperFromAllowedRequests : function(rootUri, origins,
      checkedOrigins) {
    Logger.dump("Looking for other origins within allowed requests from "
        + document.documentURI);
    var allowedRequests = this._requestpolicyJSObject._allowedRequests[rootUri];
    if (allowedRequests) {
      for (var i in allowedRequests) {
        for (var allowedUri in allowedRequests[i]) {
          if (checkedOrigins[allowedUri] || allowedUri == "count") {
            continue;
          }
          checkedOrigins[allowedUri] = true;

          Logger.dump("Found allowed request to <" + allowedUri + "> from <"
              + rootUri + ">");
          var allowedUriIdent = this._requestpolicy
              .getUriIdentifier(allowedUri);
          if (!origins[allowedUriIdent]) {
            origins[allowedUriIdent] = {};
          }
          origins[allowedUriIdent][allowedUri] = true;
          this._getOtherOriginsHelperFromAllowedRequests(allowedUri, origins,
              checkedOrigins);
        }
      }
    }
  },

  _dumpOtherOrigins : function(otherOrigins) {
    Logger.dump("-------------------------------------------------");
    Logger.dump("Other origins");
    for (i in otherOrigins) {
      Logger.dump("\t" + "Origin identifier: <" + i + ">");
      for (var j in otherOrigins[i]) {
        Logger.dump("\t\t" + j);
      }
    }
    Logger.dump("-------------------------------------------------");
  },

  _dumpRequestSet : function(requestSet, name) {
    Logger.dump("-------------------------------------------------");
    Logger.dump(name);
    for (i in requestSet) {
      Logger.dump("\t" + "Identifier: <" + i + ">");
      for (var j in requestSet[i]) {
        Logger.dump("\t\t" + j);
      }
    }
    Logger.dump("-------------------------------------------------");
  },

  _clearChildMenus : function(menu) {
    while (menu.firstChild) {
      this._clearChildMenus(menu.firstChild);
      menu.removeChild(menu.firstChild);
    }
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

  _addMenuItemTemporarilyAllowDest : function(menu, destHost) {
    var label = this._strbundle.getFormattedString(
        "allowDestinationTemporarily", [destHost]);
    var command = "requestpolicyOverlay.temporarilyAllowDestination('"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    var item = this._addMenuItem(menu, label, command, statustext);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  },

  _addMenuItemTemporarilyAllowOriginToDest : function(menu, originHost,
      destHost) {
    var label = this._strbundle.getFormattedString(
        "allowOriginToDestinationTemporarily", [originHost, destHost]);
    var command = "requestpolicyOverlay.temporarilyAllowOriginToDestination('"
        + this._sanitizeJsFunctionArg(originHost) + "', '"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    var item = this._addMenuItem(menu, label, command, statustext);
    item.setAttribute("class", "requestpolicyTemporary");
    return item;
  },

  _addMenuItemAllowDest : function(menu, destHost) {
    var label = this._strbundle.getFormattedString("allowDestination",
        [destHost]);
    var command = "requestpolicyOverlay.allowDestination('"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    return this._addMenuItem(menu, label, command, statustext);
  },

  _addMenuItemAllowOriginToDest : function(menu, originHost, destHost) {
    var label = this._strbundle.getFormattedString("allowOriginToDestination",
        [originHost, destHost]);
    var command = "requestpolicyOverlay.allowOriginToDestination('"
        + this._sanitizeJsFunctionArg(originHost) + "', '"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    var item = this._addMenuItem(menu, label, command, statustext);
    item.setAttribute("class", "requestpolicyAllowOriginToDest");
    return item;
  },

  _addMenuItemForbidOrigin : function(menu, originHost) {
    var label = this._strbundle
        .getFormattedString("forbidOrigin", [originHost]);
    var command = "requestpolicyOverlay.forbidOrigin('"
        + this._sanitizeJsFunctionArg(originHost) + "');";
    var statustext = originHost;
    return this._addMenuItem(menu, label, command, statustext);
  },

  _addMenuItemForbidDest : function(menu, destHost) {
    var label = this._strbundle.getFormattedString("forbidDestination",
        [destHost]);
    var command = "requestpolicyOverlay.forbidDestination('"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    return this._addMenuItem(menu, label, command, statustext);
  },

  _addMenuItemForbidOriginToDest : function(menu, originHost, destHost) {
    var label = this._strbundle.getFormattedString("forbidOriginToDestination",
        [originHost, destHost]);
    var command = "requestpolicyOverlay.forbidOriginToDestination('"
        + this._sanitizeJsFunctionArg(originHost) + "', '"
        + this._sanitizeJsFunctionArg(destHost) + "');";
    var statustext = destHost; // TODO
    return this._addMenuItem(menu, label, command, statustext);
  },

  _sanitizeJsFunctionArg : function(str) {
    // strip single quotes and backslashes
    return str.replace(/['\\]/g, "");
  },

  _addMenuSeparator : function(menu) {
    var separator = document.createElement("menuseparator");
    menu.insertBefore(separator, menu.firstChild);
    return separator;
  },

  _addMenuItem : function(menu, label, oncommand, statustext) {
    var menuItem = document.createElement("menuitem");
    menuItem.setAttribute("label", label);
    menuItem.setAttribute("statustext", statustext);
    menuItem.setAttribute("oncommand", oncommand);
    // menuItem.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
    menu.insertBefore(menuItem, menu.firstChild);
    return menuItem;
  },

  _addMenu : function(parentMenu, label) {
    var menu = document.createElement("menu");
    menu.setAttribute("label", label);
    parentMenu.insertBefore(menu, parentMenu.firstChild);
    // add the menu popup in the menu item
    var menuPopup = document.createElement("menupopup");
    menu.insertBefore(menuPopup, menu.firstChild);
    // return the popup as that's what will have items added to it
    return menuPopup;
  },

  _addBlockedDestination : function(parentMenu, itemToInsertBefore, label,
      isMainMenu) {
    var menu = document.createElement("menu");
    // This seems to be the easiest way to deal with indenting ltr/rtl text,
    // given that there was either a bug in the babelzilla system or having the
    // spaces in the properties files was confusing the translators. Don't want
    // to use css because I think it would require putting a margin/padding on
    // both the left and right, and so result in extra margin on the side that
    // doesn't need to be indented.
    menu.setAttribute("label", this._strbundle.getFormattedString(
            "indentedText", ["    ", label]));
    menu.setAttribute("class", "requestpolicyBlocked");
    parentMenu.insertBefore(menu, itemToInsertBefore);
    // add the menu popup in the menu item
    var menuPopup = document.createElement("menupopup");
    menu.insertBefore(menuPopup, menu.firstChild);
    // return the popup as that's what will have items added to it

    // remember what we added if we added it to the main menu
    if (isMainMenu) {
      this._blockedDestinationsItems.push(menu);
    }

    return menuPopup;
  },

  _addAllowedDestination : function(parentMenu, itemToInsertBefore, label,
      isMainMenu) {
    var menu = document.createElement("menu");
    menu.setAttribute("label", this._strbundle.getFormattedString(
            "indentedText", ["    ", label]));
    menu.setAttribute("class", "requestpolicyAllowed");
    parentMenu.insertBefore(menu, itemToInsertBefore);
    // add the menu popup in the menu item
    var menuPopup = document.createElement("menupopup");
    menu.insertBefore(menuPopup, menu.firstChild);
    // return the popup as that's what will have items added to it

    // remember what we added
    if (isMainMenu) {
      this._allowedDestinationsItems.push(menu);
    }

    return menuPopup;
  },

  _clearBlockedDestinations : function() {
    for (var i = 0; i < this._blockedDestinationsItems.length; i++) {
      this._menu.removeChild(this._blockedDestinationsItems[i]);
    }
    this._blockedDestinationsItems = [];
  },

  _clearAllowedDestinations : function() {
    for (var i = 0; i < this._allowedDestinationsItems.length; i++) {
      this._menu.removeChild(this._allowedDestinationsItems[i]);
    }
    this._allowedDestinationsItems = [];
  },

  _clearMenu : function(menu) {
    while (menu.firstChild) {
      menu.removeChild(menu.firstChild);
    }
  },

  /**
   * Reloads the current document if the user's preferences indicate it should
   * be reloaded.
   */
  _conditionallyReloadDocument : function() {
    if (this._requestpolicy.prefs.getBoolPref("autoReload")) {
      content.document.location.reload(true);
    }
  },

  /**
   * Toggles disabling of all blocking for the current session.
   * 
   * @param {Event}
   *            event
   */
  toggleTemporarilyAllowAll : function(event) {
    // TODO: Refactor to use a function call to disable blocking.
    this._requestpolicyJSObject._blockingDisabled = !this._requestpolicyJSObject._blockingDisabled;
    // Only reloading the current document. Should we reload all? Seems like it
    // would be unexpected to the user if all were reloaded.
    this
        ._setPermissiveNotificationForAllWindows(this._requestpolicyJSObject._blockingDisabled);
    this._conditionallyReloadDocument();
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
    this._requestpolicy.temporarilyAllowOrigin(host);
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
    this._requestpolicy.temporarilyAllowDestination(destHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows a destination to be requested from a single origin for the duration
   * of the browser session.
   * 
   * @param {String}
   *            originHost
   * @param {String}
   *            destHost
   */
  temporarilyAllowOriginToDestination : function(originHost, destHost) {
    this._requestpolicy.temporarilyAllowOriginToDestination(originHost,
        destHost);
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
    this._requestpolicy.allowOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows requests to a destination, including in future browser sessions.
   * 
   * @param {String}
   *            destHost
   */
  allowDestination : function(destHost) {
    this._requestpolicy.allowDestination(destHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows requests to a destination from a single origin, including in future
   * browser sessions.
   * 
   * @param {String}
   *            originHost
   * @param {String}
   *            destHost
   */
  allowOriginToDestination : function(originHost, destHost) {
    this._requestpolicy.allowOriginToDestination(originHost, destHost);
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
    this._requestpolicy.forbidOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Forbids a destination from being requested by any origin. This revoke's
   * temporary or permanent request permissions the destination had been given.
   * 
   * @param {String}
   *            destHost
   */
  forbidDestination : function(destHost) {
    this._requestpolicy.forbidDestination(destHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Forbids a destination from being requested by a single origin. This
   * revoke's temporary or permanent request permissions the destination had
   * been given.
   * 
   * @param {String}
   *            originHost
   * @param {String}
   *            destHost
   */
  forbidOriginToDestination : function(originHost, destHost) {
    this._requestpolicy.forbidOriginToDestination(originHost, destHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Revokes all temporary permissions granted during the current session.
   * 
   * @param {Event}
   *            event
   */
  revokeTemporaryPermissions : function(event) {
    this._requestpolicy.revokeTemporaryPermissions();
    this._conditionallyReloadDocument();
  },

  _performRedirectAfterDelay : function(document, redirectTargetUri, delay) {
    Logger.info(Logger.TYPE_INTERNAL, "Registering delayed (" + delay
            + "s) redirect to <" + redirectTargetUri + "> from <"
            + document.documentURI + ">");
    const constDocument = document;
    const constRedirectTargetUri = redirectTargetUri;
    document.defaultView.setTimeout(function() {
          requestpolicyOverlay._performRedirect(constDocument,
              constRedirectTargetUri);
        }, delay * 1000);
  },

  _performRedirect : function(document, redirectTargetUri) {
    try {
      if (redirectTargetUri[0] == '/') {
        Logger.info(Logger.TYPE_INTERNAL, "Redirecting to relative path <"
                + redirectTargetUri + "> from <" + document.documentURI + ">");
        document.location.pathname = redirectTargetUri;
      } else {
        // If there is no scheme, treat it as relative to the current directory.
        if (redirectTargetUri.indexOf(":") == -1) {
          // TODO: Move this logic to DomainUtils.
          var curDir = document.documentURI.split("/").slice(0, -1).join("/");
          redirectTargetUri = curDir + "/" + redirectTargetUri;
        }
        Logger.info(Logger.TYPE_INTERNAL, "Redirecting to <"
                + redirectTargetUri + "> from <" + document.documentURI + ">");
        document.location.href = redirectTargetUri;
      }
    } catch (e) {
      if (e.name != "NS_ERROR_FILE_NOT_FOUND") {
        throw e;
      }
    }
  },

  _openInNewTab : function(uri) {
    gBrowser.selectedTab = gBrowser.addTab(uri);
  },

  showPrefetchInfo : function() {
    this._openInNewTab(this._prefetchInfoUri);
  },

  showPrefetchDisablingInstructions : function() {
    this._openInNewTab(this._prefetchDisablingInstructionsUri);
  },

  openOptionsDialog : function() {
    window.openDialog("chrome://requestpolicy/content/requestpolicyPrefs.xul",
        "requestpolicyPreferencesDialogWindow",
        "chrome, dialog, centerscreen, alwaysRaised");
  },

  _attachPopupToContextMenu : function() {
    // Add the menupopup back to the contextmenu.
    if (!requestpolicyOverlay._rpContextMenu.firstChild) {
      requestpolicyOverlay._rpContextMenu.insertBefore(
          requestpolicyOverlay._menu, null);
    }
  },

  openStatusbarPopup : function(anchor) {
    this._attachPopupToStatusbar();
    this._menu.openPopup(anchor, 'before_start', 0, 0, true, true);
  },

  openToolbarPopup : function(anchor) {
    // It seems to work to just attach it to the status bar.
    this._attachPopupToStatusbar();
    this._menu.openPopup(anchor, 'after_start', 0, 0, true, true);
  },

  _attachPopupToStatusbar : function() {
    // Add the menupopup to the statusbar as it may be attached to the
    // contextmenu.
    requestpolicyOverlay._statusbar.insertBefore(requestpolicyOverlay._menu,
        null);
  },

  toggleRequestLog : function() {
    var requestLog = document.getElementById("rp-requestLog");
    var requestLogSplitter = document.getElementById("rp-requestLog-splitter");
    var requestLogFrame = document.getElementById("rp-requestLog-frame");
    var openRequestLog = document.getElementById("requestpolicyOpenRequestLog");
    var closeRequestLog = document
        .getElementById("requestpolicyCloseRequestLog");

    if (requestLog.hidden) {
      requestLogFrame.setAttribute("src",
          "chrome://requestpolicy/content/requestLog.xul");
      requestLog.hidden = requestLogSplitter.hidden = closeRequestLog.hidden = false;
      openRequestLog.hidden = true;
    } else {
      requestLogFrame.setAttribute("src", "about:blank");
      requestLog.hidden = requestLogSplitter.hidden = closeRequestLog.hidden = true;
      openRequestLog.hidden = false;
      this.requestLogTreeView = null;
    }
  }

};

// Initialize the requestpolicyOverlay object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestpolicyOverlay.init();
    }, false);

// Event handler for when the window is closed.
addEventListener("close", function(event) {
      requestpolicyOverlay.onWindowClose(event);
    }, false);

// Registers event handlers for documents loaded in the window.
addEventListener("load", function(event) {
      requestpolicyOverlay.onLoad(event);
    }, false);
