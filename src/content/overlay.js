/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
 * 
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 * 
 * ***** END LICENSE BLOCK *****
 */

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/DomainUtil.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Logger.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/RequestUtil.jsm",
    requestpolicy.mod);

/**
 * Provides functionality for the overlay. An instance of this class exists for
 * each tab/window.
 */
requestpolicy.overlay = {

  _prefetchInfoUri : "http://www.requestpolicy.com/help/prefetch.html",
  _prefetchDisablingInstructionsUri : "http://www.requestpolicy.com/help/prefetch.html#disable",

  _overlayId : 0,

  _blockedContentCheckTimeoutDelay : 1000, // milliseconds
  _blockedContentCheckTimeoutId : null,
  _blockedContentCheckMinWaitOnObservedBlockedRequest : 500,
  _blockedContentCheckLastTime : 0,

  _initialized : false,
  _rpService : null,

  // For things we can't do through the nsIRequestPolicy interface, use direct
  // access to the underlying JS object.
  _rpServiceJSObject : null,

  // This is set by requestLog.js when it is initialized. We don't need to worry
  // about setting it here.
  requestLogTreeView : null,

  _strbundle : null,
  _menu : null,

  _statusbar : null,
  _rpStatusbar : null,
  _rpContextMenu : null,
  _toolbox : null,

  _isFennec : false,

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
    return "[requestpolicy.overlay " + this._overlayId + "]";
  },

  /**
   * Initialize the object. This must be done after the DOM is loaded.
   */
  init : function() {
    try {
      if (this._initialized == false) {
        this._initialized = true;
        this._overlayId = (new Date()).getTime();

        requestpolicy.menu.init();

        this._rpService = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
            .getService(Components.interfaces.nsIRequestPolicy);
        this._rpServiceJSObject = this._rpService.wrappedJSObject;

        this._strbundle = document.getElementById("requestpolicyStrings");
        this._menu = document.getElementById("requestpolicyStatusbarPopup");

        this._statusbar = document.getElementById("status-bar");
        this._rpStatusbar = document.getElementById("requestpolicyStatusbar");
        this._rpContextMenu = document
            .getElementById("requestpolicyContextMenu");
        this._toolbox = document.getElementById("navigator-toolbox");

        var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULAppInfo);
        this._isFennec = (appInfo.ID == "{a23983c0-fd0e-11dc-95ff-0800200c9a66}");

        if (this._isFennec) {
          requestpolicy.mod.Logger.dump("Detected Fennec.");
          // Set an attribute for CSS usage.
          this._menu.setAttribute("fennec", "true");
          this._menu.setAttribute("position", "after_end");
          // Remove extra items from the menu.
          document.getElementById("requestpolicyOpenPreferences").hidden = true;
          document.getElementById("requestpolicyOpenRequestLog").hidden = true;
          document.getElementById("preferencesSeparator").hidden = true;
        }

        // Register this window with the requestpolicy service so that we can be
        // notified of blocked requests. When blocked requests happen, this
        // object's observerBlockedRequests() method will be called.
        this._rpServiceJSObject.addRequestObserver(this);

        this.setStatusbarIconStyle(this._rpService.prefs
            .getCharPref("statusbarIcon"));
        this._setPermissiveNotification(this._rpService.isBlockingDisabled());
      }
    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Unable to initialize requestpolicy.overlay.");
      throw e;
    }
  },

  setStatusbarIconStyle : function(iconStyle) {
    this._rpStatusbar.setAttribute("iconStyle", iconStyle);
  },

  onWindowClose : function(event) {
    this._rpServiceJSObject.removeRequestObserver(this);
    this._removeHistoryObserver();
    this._removeLocationObserver();
  },

  /**
   * Perform the actions required once the window has loaded. This just sets a
   * listener for when the content of the window has changed (a page is loaded).
   * 
   * @param {Event}
   *            event
   */
  onLoad : function(event) {
    try {
      // Info on detecting page load at:
      // http://developer.mozilla.org/En/Code_snippets/On_page_load
      var appcontent = this._isFennec ? event.currentTarget : document
          .getElementById("appcontent"); // browser
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
        // This seems to be a safe approach in that the MDC states that
        // javascript can't be used to initiate a click event on a link:
        // http://developer.mozilla.org/en/DOM/element.click
        appcontent.addEventListener("click", function(event) {
              // We're only interested in left-clicks on anchor tags.
              if (event.target.nodeName.toLowerCase() != "a"
                  || event.button != 0) {
                return;
              }
              requestpolicyOverlay._rpService.registerLinkClicked(
                  event.target.ownerDocument.URL, event.target.href);
            }, true);

        // Add a submit handler so we can register all form submissions and be
        // able to allow them.
        // As far as I can tell, calling a form's submit() method from
        // javascript will not cause this event listener to fire even though it
        // will submit the form, which makes things easier in that we don't have
        // to find another way to tell if the user submitted the form or if it
        // was done by javascript. However, I'm not sure on the specifics of why
        // submit() from javascript doesn't end up calling this. I can only
        // conclude it's the ame difference as with link clicks by humans vs.
        // click(), but that the documentation just doesn't state this (with the
        // exception that nonprivileged code can call submit(), but it just
        // doesn't result in a submit event going through the DOM).
        appcontent.addEventListener("submit", function(event) {
              if (event.target.nodeName.toLowerCase() != "form") {
                return;
              }
              requestpolicyOverlay._rpService.registerFormSubmitted(
                  event.target.ownerDocument.URL, event.target.action);
            }, true);

        if (this._isFennec) {
          appcontent.addEventListener("TabSelect", function(event) {
                requestpolicyOverlay.tabChanged();
              }, false);
        }
      }

      // Add an event listener for when the contentAreaContextMenu (generally
      // the right-click menu within the document) is shown.
      var contextMenu = document.getElementById("contentAreaContextMenu");
      if (contextMenu) {
        contextMenu.addEventListener("popupshowing",
            this._contextMenuOnPopupShowing, false);
      }

      // We consider the default place for the popup to be attached to the
      // context menu, so attach it there.
      this._attachPopupToContextMenu();

      // Listen for the user changing tab so we can update any notification or
      // indication of blocked requests.
      if (!this._isFennec) {
        var container = gBrowser.tabContainer;
        container.addEventListener("TabSelect", function(event) {
              requestpolicyOverlay.tabChanged();
            }, false);
        this._wrapAddTab();
        this._addLocationObserver();
        this._addHistoryObserver();
      }
      this._showInitialSetupDialog();

    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Unable to complete requestpolicy.overlay.onLoad actions.");
      throw e;
    }
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

    if (this._isFennec) {
      requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Should have shown redirect notification to <" + redirectTargetUri
              + ">, but it's not implemented yet on Fennec.");
      return;
    }

    if (!this._isTopLevelDocument(targetDocument)) {
      // Don't show notification if this isn't the main document of a tab;
      return;
    }

    var targetBrowser = gBrowser.getBrowserForDocument(targetDocument);
    var notificationBox = gBrowser.getNotificationBox(targetBrowser)
    var notificationValue = "request-policy-meta-redirect";

    // There doesn't seem to be a way to use the xul crop attribute with the
    // notification, so do our own cropping, showing at a minimum the entire
    // prePath.
    const maxLength = 50;
    if (redirectTargetUri.length < maxLength) {
      var shortUri = redirectTargetUri;
    } else {
      var prePathLength = requestpolicy.mod.DomainUtil
          .getPrePath(redirectTargetUri).length
          + 1;
      shortUri = redirectTargetUri.substring(0, Math.max(prePathLength,
              maxLength))
          + "...";
    }
    var notificationLabel = this._strbundle.getFormattedString(
        "redirectNotification", [shortUri]);

    var notificationButtonOptions = this._strbundle.getString("options");
    var notificationButtonAllow = this._strbundle.getString("allow");
    var notificationButtonDeny = this._strbundle.getString("deny");

    optionsPopupName = "requestpolicyRedirectNotificationOptions";
    var optionsPopup = document.getElementById(optionsPopupName);
    requestpolicy.menu.clearMenu(optionsPopup);
    var currentIdent = this._rpService
        .getUriIdentifier(targetDocument.location);
    var destIdent = this._rpService.getUriIdentifier(redirectTargetUri);

    requestpolicy.menu.addMenuItemTemporarilyAllowOriginToDest(optionsPopup,
        currentIdent, destIdent);
    requestpolicy.menu.addMenuItemAllowOriginToDest(optionsPopup, currentIdent,
        destIdent);

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
              var location = targetDocument.location;
              // When refreshing a page that wants to redirect, sometimes the
              // targetDocument.location is null. If that's the case, just use
              // do the redirection in the current content pane.
              if (targetDocument.location == null) {
                requestpolicy.mod.Logger
                    .dump("in callback: targetDocument.location == null, "
                        + "using content.location instead");
                location = content.location;
              }
              requestpolicy.mod.Logger.dump("User allowed redirection from <"
                  + location.href + "> to <" + redirectTargetUri + ">");
              location.href = redirectTargetUri;
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
   * Determines if documentToCheck is the main document loaded in any tab.
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

  /**
   * Determines if documentToCheck is the main document loaded in the currently
   * active tab.
   * 
   * @param {document}
   *            documentToCheck
   * @return {Boolean}
   */
  _isActiveTopLevelDocument : function(documentToCheck) {
    return documentToCheck == content.document;
  },

  /**
   * Performs actions required to be performed after a tab change.
   */
  tabChanged : function() {
    // TODO: verify the Fennec and all supported browser versions update the
    // status bar properly with only the ProgressListener. Once verified,
    // remove calls to tabChanged();
    // this._checkForBlockedContent(content.document);
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
    try {
      if (event.originalTarget.nodeName != "#document") {
        // It's a favicon. See the note at
        // http://developer.mozilla.org/En/Code_snippets/On_page_load
        return;
      }

      var document = event.target;
      if (!document) {
        // onAppContentLoaded getting called more often than it should? document
        // isn't set on new tab open when this is called.
        return;
      }
      requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "onAppContentLoaded called for " + document.documentURI);

      this._onDOMContentLoaded(document);

      if (this._isActiveTopLevelDocument(document)) {
        // Clear any notifications that may have been present.
        this._setBlockedContentNotification(false);
        this._checkForBlockedContent(document);
      }
    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger
          .severe(requestpolicy.mod.Logger.TYPE_ERROR,
              "Unable to complete requestpolicy.overlay.onAppContentLoaded actions.");
      throw e;
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
    try {
      var iframe = event.target;
      // Flock's special home page is about:myworld. It has (i)frames in it
      // that have no contentDocument. It's probably related to the fact that
      // that is an xul page.
      if (iframe.contentDocument === undefined) {
        return;
      }
      requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "onAppFrameContentLoaded called for <"
              + iframe.contentDocument.documentURI + "> in <"
              + iframe.ownerDocument.documentURI + ">");
      // TODO: maybe this can check if the iframe's documentURI is in the other
      // origins of the current document, and that way not just be limited to
      // direct children of the main document. That would require building the
      // other origins every time an iframe is loaded. Maybe, then, this should
      // use a timeout like observerBlockedRequests does.
      if (this._isActiveTopLevelDocument(iframe.ownerDocument)) {
        // This has an advantage over just relying on the
        // observeBlockedRequest() call in that this will clear a blocked
        // content notification if there no longer blocked content. Another way
        // to solve this would be to observe allowed requests as well as blocked
        // requests.
        this._checkForBlockedContent(iframe.ownerDocument);
      }
    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger
          .severe(requestpolicy.mod.Logger.TYPE_ERROR,
              "Unable to complete requestpolicy.overlay.onAppFrameContentLoaded actions.");
      throw e;
    }
  },

  /**
   * Checks if the document has blocked content and shows appropriate
   * notifications.
   */
  _checkForBlockedContent : function(document) {
    try {
      var documentUri = requestpolicy.mod.DomainUtil
          .stripFragment(document.documentURI);
      requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Checking for blocked content from page <" + documentUri + ">");
      this._blockedContentCheckLastTime = (new Date()).getTime();
      this._stopBlockedContentCheckTimeout();
      if (this._rpService.originHasRejectedRequests(documentUri)) {
        requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Main document <" + documentUri + "> has rejected requests.");
        this._setBlockedContentNotification(true);
        this._indicateBlockedVisibleObjects(document);
        return;
      }
      var otherOrigins = requestpolicy.mod.RequestUtil
          .getOtherOrigins(document);
      for (var i in otherOrigins) {
        for (var j in otherOrigins[i]) {
          requestpolicy.mod.Logger.dump("Checking for blocked content from "
              + j);
          if (this._rpService.originHasRejectedRequests(j)) {
            requestpolicy.mod.Logger.debug(
                requestpolicy.mod.Logger.TYPE_INTERNAL, "Other origin <" + j
                    + "> of main document <" + documentUri
                    + "> has rejected requests.");
            this._setBlockedContentNotification(true);
            this._indicateBlockedVisibleObjects(document);
            return;
          }
        }
      }
      this._setBlockedContentNotification(false);
    } catch (e) {
      requestpolicy.mod.Logger.severe(requestpolicy.mod.Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      requestpolicy.mod.Logger
          .severe(requestpolicy.mod.Logger.TYPE_ERROR,
              "Unable to complete requestpolicy.overlay._checkForBlockedContent actions.");
      throw e;
    }
  },

  _indicateBlockedVisibleObjects : function(document) {
    if (!this._rpService.prefs.getBoolPref("indicateBlockedObjects")) {
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
        img.title = "[" + this._rpService.getUriIdentifier(img.src) + "]"
            + (img.title ? " " + img.title : "");
        // We want it to be registered as a broken image so that the alt text
        // shows. By default, the blocked image will just not show up at all.
        // Setting src to null worked on firefox 3.0 but not 3.1. So, use a
        // local url that doesn't exist (using resource:// because chrome:// is
        // forbidden in this context).
        // It turns out that the broken resource trick causes "save page as" to
        // to fail. On the glorious plus side, it looks like Fx 3.5b4 works
        // with setting the src to null, as well.
        //img.src = "resource://doesnt/exist.png";
        img.src = null;
      }
    }
  },

  /**
   * Sets the blocked content notifications visible to the user.
   */
  _setBlockedContentNotification : function(isContentBlocked) {
    this._rpStatusbar.setAttribute("requestpolicyBlocked", isContentBlocked);
    if (!this._isFennec) {
      this._rpContextMenu
          .setAttribute("requestpolicyBlocked", isContentBlocked);
      this._toolbox.setAttribute("requestpolicyBlocked", isContentBlocked);
    }
  },

  /**
   * Sets the permissive status visible to the user for all windows.
   */
  _setPermissiveNotificationForAllWindows : function(isPermissive) {
    // We do it for all windows, not just the current one.
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
    var enumerator = wm.getEnumerator(null);
    while (enumerator.hasMoreElements()) {
      var window = enumerator.getNext();
      if ("requestpolicy" in window && "overlay" in window.requestpolicy) {
        window.requestpolicy.overlay._setPermissiveNotification(isPermissive);
      }
    }
  },

  /**
   * Sets the permissive status visible to the user for just this window.
   */
  _setPermissiveNotification : function(isPermissive) {
    this._rpStatusbar.setAttribute("requestpolicyPermissive", isPermissive);
    requestpolicy.menu.setItemAllowAllTemporarilyChecked(isPermissive);
    if (!this._isFennec) {
      this._rpContextMenu.setAttribute("requestpolicyPermissive", isPermissive);
      this._toolbox.setAttribute("requestpolicyPermissive", isPermissive);
    }
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

  observeBlockedLinkClickRedirect : function(sourcePageUri, linkDestUri,
      blockedRedirectUri) {
    // TODO: Figure out a good way to notify the user. For now, it should at
    // least be showing up in the menu the first time it happens. After that,
    // some caching issues seem to get in the way and the blocked request
    // isn't tried again, so there's no awareness of it.
    requestpolicy.mod.Logger.warning(
        requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
        "Observed blocked link click redirect from page <" + sourcePageUri
            + "> with redirect origin <" + linkDestUri
            + "> and redirect dest <" + blockedRedirectUri
            + ">. --- WARNING: other than the menu "
            + "showing this blocked request, there is no other indication.");
  },

  // TODO: observeBlockedFormSubmissionRedirect

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
            requestpolicy.overlay._checkForBlockedContent(document);
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
    requestpolicy.mod.Logger.warning(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "_onDOMContentLoaded called.");

    // Find all meta redirects.
    var metaTags = document.getElementsByTagName("meta");
    for (var i = 0; i < metaTags.length; i++) {
      if (metaTags[i].httpEquiv
          && metaTags[i].httpEquiv.toLowerCase() == "refresh") {
        // TODO: Register meta redirects so we can tell which blocked requests
        // were meta redirects in the statusbar menu.
        // TODO: move this logic to the requestpolicy service.
        var parts = requestpolicy.mod.DomainUtil
            .parseRefresh(metaTags[i].content);
        var delay = parts[0];
        var dest = parts[1];
        requestpolicy.mod.Logger.info(
            requestpolicy.mod.Logger.TYPE_META_REFRESH, "meta refresh to <"
                + dest + "> (" + delay
                + " second delay) found in document at <" + document.location
                + ">");
        if (dest != undefined) {
          if (this._rpServiceJSObject._blockingDisabled
              || this._rpService.isAllowedRedirect(document.location, dest)) {
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
            requestpolicy.overlay._rpService
                .registerLinkClicked(event.currentTarget.ownerDocument.URL,
                    event.currentTarget.href);
          }, false);
    }

    if (this._rpServiceJSObject._blockedRedirects[document.location]) {
      var dest = this._rpServiceJSObject._blockedRedirects[document.location];
      requestpolicy.mod.Logger.warning(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
          "Showing notification for blocked redirect. To <" + dest + "> "
              + "from <" + document.location + ">");
      this._showRedirectNotification(document, dest);
      delete this._rpServiceJSObject._blockedRedirects[document.location];
    }

    this._wrapWindowOpen(document.defaultView);
  },

  /**
   * Called as an event listener when popupshowing fires on the
   * contentAreaContextMenu.
   */
  _contextMenuOnPopupShowing : function() {
    requestpolicy.overlay._wrapOpenLink();
    requestpolicy.overlay._attachPopupToContextMenu();
  },

  /**
   * Called as an event listener when popuphidden fires on the
   * contentAreaContextMenu.
   */
  _contextMenuOnPopupHidden : function(event) {
    if (event.currentTarget != event.originalTarget) {
      return;
    }
    requestpolicy.overlay._attachPopupToStatusbar();
  },

  /**
   * Wraps the gContextMenu's openLink() function so that RequestPolicy can be
   * aware of the window being opened. The openLinkInTab() method doesn't need
   * to be wrapped because addTab() is wrapped elsewhere and that ends up being
   * called when openLinkInTab() is called.
   */
  _wrapOpenLink : function() {
    const rpService = this._rpService;

    if (!gContextMenu.requestpolicyOrigOpenLink) {
      gContextMenu.requestpolicyOrigOpenLink = gContextMenu.openLink;
      gContextMenu.openLink = function() {
        rpService.registerLinkClicked(gContextMenu.link.ownerDocument.URL,
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
      var newFirstCodeLine = "\n    requestpolicy.overlay.tabAdded(aURI, aReferrerURI);";
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
      this._rpService.registerLinkClicked(referrerUri.spec, tabUri);
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
    const rpService = this._rpService;

    if (!window.requestpolicyOrigOpen) {
      window.requestpolicyOrigOpen = window.open;
      window.open = function(url, windowName, windowFeatures) {
        rpService.registerLinkClicked(window.document.documentURI, url);
        return window.requestpolicyOrigOpen(url, windowName, windowFeatures);
      };
    }

    if (!window.requestpolicyOrigOpenDialog) {
      window.requestpolicyOrigOpenDialog = window.openDialog;
      window.openDialog = function() {
        // openDialog(url, name, features, arg1, arg2, ...)
        rpService
            .registerLinkClicked(window.document.documentURI, arguments[0]);
        return window.requestpolicyOrigOpenDialog.apply(this, arguments);
      };
    }
  },

  _addLocationObserver : function() {
    this.locationListener = {
      onLocationChange : function(aProgress, aRequest, aURI) {
        requestpolicy.overlay._checkForBlockedContent(content.document);
      },
      onStateChange : function() {
      },
      onProgressChange : function() {
      },
      onStatusChange : function() {
      },
      onSecurityChange : function() {
      },
      onLinkIconAvailable : function() {
      },

      QueryInterface : function(aIID) {
        if (aIID.equals(Components.interfaces.nsIWebProgressListener)
            || aIID.equals(Components.interfaces.nsISupportsWeakReference)
            || aIID.equals(Components.interfaces.nsISupports))
          return this;
        throw Components.results.NS_NOINTERFACE;
      }
    };

    gBrowser.addProgressListener(this.locationListener,
        Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
  },

  _removeLocationObserver : function() {
    gBrowser.removeProgressListener(this.locationListener);
  },

  _addHistoryObserver : function() {
    // Implements nsISHistoryListener (and nsISupportsWeakReference)
    this.historyListener = {
      OnHistoryGoBack : function(backURI) {
        requestpolicy.overlay._rpService
            .registerHistoryRequest(backURI.asciiSpec);
        return true;
      },

      OnHistoryGoForward : function(forwardURI) {
        requestpolicy.overlay._rpService
            .registerHistoryRequest(forwardURI.asciiSpec);
        return true;
      },

      OnHistoryGotoIndex : function(index, gotoURI) {
        requestpolicy.overlay._rpService
            .registerHistoryRequest(gotoURI.asciiSpec);
        return true;
      },

      OnHistoryNewEntry : function(newURI) {
      },

      OnHistoryPurge : function(numEntries) {
        return true;
      },

      OnHistoryReload : function(reloadURI, reloadFlags) {
        return true;
      },

      QueryInterface : function(aIID, aResult) {
        if (aIID.equals(Components.interfaces.nsISHistoryListener)
            || aIID.equals(Components.interfaces.nsISupportsWeakReference)
            || aIID.equals(Components.interfaces.nsISupports)) {
          return this;
        }
        throw Components.results.NS_NOINTERFACE;
      },

      GetWeakReference : function() {
        return Components.classes["@mozilla.org/appshell/appShellService;1"]
            .createInstance(Components.interfaces.nsIWeakReference);
      }
    };

    var sHistory = gBrowser.webNavigation.sessionHistory;
    sHistory.addSHistoryListener(this.historyListener);
  },

  _removeHistoryObserver : function() {
    var sHistory = gBrowser.webNavigation.sessionHistory;
    sHistory.removeSHistoryListener(this.historyListener);
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
    requestpolicy.menu.prepareMenu();
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
  getCurrentUriIdentifier : function getCurrentUriIdentifier() {
    return this._rpServiceJSObject.getUriIdentifier(this.getCurrentUri());
  },

  getCurrentUri : function getCurrentUriIdentifier() {
    return requestpolicy.mod.DomainUtil
        .stripFragment(content.document.documentURI);
  },

  /**
   * Reloads the current document if the user's preferences indicate it should
   * be reloaded.
   */
  _conditionallyReloadDocument : function() {
    if (this._rpService.prefs.getBoolPref("autoReload")) {
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
    this._rpServiceJSObject._blockingDisabled = !this._rpServiceJSObject._blockingDisabled;
    // Only reloading the current document. Should we reload all? Seems like it
    // would be unexpected to the user if all were reloaded.
    this
        ._setPermissiveNotificationForAllWindows(this._rpServiceJSObject._blockingDisabled);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows requests from the specified origin to any destination for the
   * duration of the browser session.
   */
  temporarilyAllowOrigin : function(originHost) {
    this._rpService.temporarilyAllowOrigin(originHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows the current document's origin to request from any destination for
   * the duration of the browser session.
   * 
   * @param {Event}
   *            event
   */
  temporarilyAllowCurrentOrigin : function(event) {
    // Note: the available variable "content" is different than the avaialable
    // "window.target".
    var host = this.getCurrentUriIdentifier();
    this._rpService.temporarilyAllowOrigin(host);
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
    this._rpService.temporarilyAllowDestination(destHost);
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
    this._rpService.temporarilyAllowOriginToDestination(originHost, destHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows requests from an origin, including in future browser sessions.
   */
  allowOrigin : function(originHost) {
    this._rpService.allowOrigin(originHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows the current document's origin to request from any destination,
   * including in future browser sessions.
   * 
   * @param {Event}
   *            event
   */
  allowCurrentOrigin : function(event) {
    var host = this.getCurrentUriIdentifier();
    this._rpService.allowOrigin(host);
    this._conditionallyReloadDocument();
  },

  /**
   * Allows requests to a destination, including in future browser sessions.
   * 
   * @param {String}
   *            destHost
   */
  allowDestination : function(destHost) {
    this._rpService.allowDestination(destHost);
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
    this._rpService.allowOriginToDestination(originHost, destHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Forbids an origin from requesting from any destination.
   * This revoke's temporary or permanent request permissions the origin had
   * been given.
   */
  forbidOrigin : function(originHost) {
    this._rpService.forbidOrigin(originHost);
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
  forbidCurrentOrigin : function(event) {
    var host = this.getCurrentUriIdentifier();
    this._rpService.forbidOrigin(host);
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
    this._rpService.forbidDestination(destHost);
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
    this._rpService.forbidOriginToDestination(originHost, destHost);
    this._conditionallyReloadDocument();
  },

  /**
   * Revokes all temporary permissions granted during the current session.
   * 
   * @param {Event}
   *            event
   */
  revokeTemporaryPermissions : function(event) {
    this._rpService.revokeTemporaryPermissions();
    this._conditionallyReloadDocument();
  },

  _performRedirectAfterDelay : function(document, redirectTargetUri, delay) {
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Registering delayed (" + delay + "s) redirect to <"
            + redirectTargetUri + "> from <" + document.documentURI + ">");
    const constDocument = document;
    const constRedirectTargetUri = redirectTargetUri;
    document.defaultView.setTimeout(function() {
          requestpolicy.overlay._performRedirect(constDocument,
              constRedirectTargetUri);
        }, delay * 1000);
  },

  _performRedirect : function(document, redirectTargetUri) {
    try {
      if (redirectTargetUri[0] == '/') {
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Redirecting to relative path <" + redirectTargetUri + "> from <"
                + document.documentURI + ">");
        document.location.pathname = redirectTargetUri;
      } else {
        // If there is no scheme, treat it as relative to the current directory.
        if (redirectTargetUri.indexOf(":") == -1) {
          // TODO: Move this logic to DomainUtil.
          var curDir = document.documentURI.split("/").slice(0, -1).join("/");
          redirectTargetUri = curDir + "/" + redirectTargetUri;
        }
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
            "Redirecting to <" + redirectTargetUri + "> from <"
                + document.documentURI + ">");
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
    window.openDialog("chrome://requestpolicy/content/prefWindow.xul",
        "requestpolicyPreferencesDialogWindow",
        "chrome, close, centerscreen, alwaysRaised");
  },

  _showInitialSetupDialog : function() {
    if (!this._rpService.prefs.getBoolPref("initialSetupDialogShown")) {
      this._rpService.prefs.setBoolPref("initialSetupDialogShown", true);
      this._rpServiceJSObject._prefService.savePrefFile(null);
      window.openDialog("chrome://requestpolicy/content/initialSetup.xul",
          "requestpolicyInitialSetupDialogWindow",
          "chrome, close, centerscreen, alwaysRaised");
    }
  },

  _attachPopupToContextMenu : function() {
    if (requestpolicy.overlay._isFennec) {
      return;
    }
    // Add the menupopup back to the contextmenu.
    if (!requestpolicy.overlay._rpContextMenu.firstChild) {
      requestpolicy.overlay._rpContextMenu.insertBefore(
          requestpolicy.overlay._menu, null);
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
    requestpolicy.overlay._statusbar.insertBefore(requestpolicy.overlay._menu,
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

// Initialize the requestpolicy.overlay object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestpolicy.overlay.init();
    }, false);

// Event handler for when the window is closed.
addEventListener("close", function(event) {
      requestpolicy.overlay.onWindowClose(event);
    }, false);

// Registers event handlers for documents loaded in the window.
addEventListener("load", function(event) {
      requestpolicy.overlay.onLoad(event);
    }, false);
