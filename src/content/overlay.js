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
Components.utils.import("resource://requestpolicy/JSON.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Logger.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/RequestUtil.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Util.jsm",
    requestpolicy.mod);

/**
 * Provides functionality for the overlay. An instance of this class exists for
 * each tab/window.
 */
requestpolicy.overlay = {

//  _extensionConflictInfoUri : "http://www.requestpolicy.com/conflict?ext=",

//  _prefetchInfoUri : "http://www.requestpolicy.com/help/prefetch.html",
//  _prefetchDisablingInstructionsUri : "http://www.requestpolicy.com/help/prefetch.html#disable",

  _toolbarButtonId : "requestpolicyToolbarButton",

  _overlayId : 0,

  _blockedContentCheckTimeoutDelay : 250, // milliseconds
  _blockedContentCheckTimeoutId : null,
  _blockedContentCheckMinWaitOnObservedBlockedRequest : 500,
  _blockedContentCheckLastTime : 0,

  _initialized : false,
  _rpService : null,

  // This is set by requestLog.js when it is initialized. We don't need to worry
  // about setting it here.
  requestLogTreeView : null,

  _strbundle : null,
  _menu : null,

  //_statusbar : null,
  //_rpStatusbar : null,
  //_rpContextMenu : null,
  _toolbox : null,
  _addonbar : null,
  _tabbar : null,

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

  _transparentImageDataUri : "data:image/gif;base64,R0lGODlhAQABAIAAA"
      + "AAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",

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
            .getService().wrappedJSObject;

        this._strbundle = document.getElementById("requestpolicyStrings");
        this._menu = document.getElementById("rp-popup");

        //this._statusbar = document.getElementById("status-bar");
        //this._rpStatusbar = document.getElementById("requestpolicyStatusbar");
        //this._rpContextMenu = document
        //    .getElementById("requestpolicyContextMenu");
        this._toolbox = document.getElementById("navigator-toolbox");
        this._addonbar = document.getElementById("addon-bar");
        this._tabbar = document.getElementById("TabsToolbar");

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
          document.getElementById("requestpolicy-preferencesSeparator").hidden = true;
        }

        // Register this window with the requestpolicy service so that we can be
        // notified of blocked requests. When blocked requests happen, this
        // object's observerBlockedRequests() method will be called.
        this._rpService.addRequestObserver(this);

        //this.setContextMenuEnabled(this._rpService.prefs
        //    .getBoolPref("contextMenu"));
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

  _installToolbarButtonOnce : function() {
    var util = requestpolicy.mod.Util;

    // SeaMonkey users have to use a toolbar button now. At the moment I can't
    // justify a bunch of special cases to support the statusbar when such a
    // tiny number of users have seamonkey and I can't even be sure that many of
    // those users want a statusbar icon.
    //if (!util.isFirefox()) {
    //  requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
    //    "Not performing toolbar button check: not Firefox.");
    //  return;
    //}

    if (util.compareVersions(util.lastAppVersion, "0.0") > 0) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Not performing toolbar button check: we've checked before.");
      return;
    }

    var toolbars = ["addon-bar", "nav-bar", "toolbar-menubar",
                    "PersonalToolbar", "TabsToolbar"];
    for (var i in toolbars) {
      var toolbarName = toolbars[i];
      if (this._isButtonInToolbar(toolbarName)) {
        requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Button already in toolbar: " + toolbarName);
        return;
      }
    }

    this._addButtonToNavBar();
  },

  _addButtonToNavBar : function() {
    var toolbar = document.getElementById("nav-bar");

    toolbar.insertItem(this._toolbarButtonId, null);
    toolbar.setAttribute("currentset", toolbar.currentSet);

    document.persist(toolbar.id, "currentset");
    requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
      "Adding toolbar button.");
    try {
      BrowserToolboxCustomizeDone(true);
    }
    catch (e) {
      requestpolicy.mod.Logger.info(requestpolicy.mod.Logger.TYPE_INTERNAL,
        "Adding toolbar button failed: " + e);
    }
  },

  _isButtonInToolbar : function(toolbarName) {
    if (!toolbarName) {
      toolbarName = "addon-bar";
    }
    var toolbar = document.getElementById(toolbarName);
    if (!toolbar) {
      return false;
    }
    var curSet = toolbar.currentSet.split(",");
    return curSet.indexOf(this._toolbarButtonId) != -1;
  },

  //setContextMenuEnabled : function(isEnabled) {
  //  this._rpContextMenu.setAttribute("hidden", !isEnabled);
  //},

  onWindowClose : function(event) {
    this._rpService.removeRequestObserver(this);
    this._removeHistoryObserver();
    this._removeLocationObserver();
  },

  /**
   * Perform the actions required once the window has loaded. This just sets a
   * listener for when the content of the window has changed (a page is loaded).
   * 
   * @param {Event}
   *          event
   */
  onLoad : function(event) {
    try {
      // This must be done here rather than from init() because during init()
      // we won't see if the toolbar button is already installed somewhere,
      // we'll only see the standard buttons when we inspect the toolbars.
      this._installToolbarButtonOnce();

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

        // Listen for click events so that we can allow requests that result from
        // user-initiated link clicks and form submissions.
        appcontent.addEventListener("click", function(event) {
              // If mozInputSource is undefined or zero, then this was a javascript-generated event.
              // If there is a way to forge mozInputSource from javascript, then that could be used
              // to bypass RequestPolicy.
              if (!event.mozInputSource) {
                return;
              }
              // The following show up as button value 0 for links and form input submit buttons:
              // * left-clicks
              // * enter key while focused
              // * space bar while focused (no event sent for links in this case)
              if (event.button != 0) {
                return;
              }
              // Link clicked.
              // I believe an empty href always gets filled in with the current URL so
              // it will never actually be empty. However, I don't know this for certain.
              if (event.target.nodeName.toLowerCase() == "a" && event.target.href) {
                requestpolicyOverlay._rpService.registerLinkClicked(
                    event.target.ownerDocument.URL, event.target.href);
                return;
              }
              // Form submit button clicked. This can either be directly (e.g. mouseclick,
              // enter/space while the the submit button has focus) or indirectly (e.g.
              // pressing enter when a text input has focus).
              if (event.target.nodeName.toLowerCase() == "input" &&
                  event.target.type.toLowerCase() == "submit" &&
                  event.target.form && event.target.form.action) {
                requestpolicyOverlay._rpService.registerFormSubmitted(
                  event.target.ownerDocument.URL, event.target.form.action);
                return;
              }
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
      //this._attachPopupToContextMenu();

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
      this._showWelcomeWindow();

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
   *          targetDocument
   * @param {String}
   *          redirectTargetUri
   * @param {int}
   *          delay
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

    var notificationButtonOptions = this._strbundle.getString("more");
    var notificationButtonOptionsKey = this._strbundle
        .getString("more.accesskey");
    var notificationButtonAllow = this._strbundle.getString("allow");
    var notificationButtonAllowKey = this._strbundle
        .getString("allow.accesskey");
    var notificationButtonDeny = this._strbundle.getString("deny");
    var notificationButtonDenyKey = this._strbundle
        .getString("deny.accesskey");

//    var optionsPopupName = "requestpolicyRedirectNotificationOptions";
//    var optionsPopup = document.getElementById(optionsPopupName);
//    while (optionsPopup.firstChild) {
//      optionsPopup.removeChild(optionsPopup.firstChild);
//    }
//    var currentIdent = this._rpService
//        .getUriIdentifier(targetDocument.location);
//    var destIdent = this._rpService.getUriIdentifier(redirectTargetUri);
//
//    requestpolicy.menu.addMenuItemTemporarilyAllowOriginToDest(optionsPopup,
//        currentIdent, destIdent);
//    requestpolicy.menu.addMenuItemAllowOriginToDest(optionsPopup, currentIdent,
//        destIdent);

    const rpServiceObj = this._rpService;

    var notification = notificationBox
        .getNotificationWithValue(notificationValue);
    if (notification) {
      notification.label = notificationLabel;
    } else {
      var buttons = [{
            label : notificationButtonAllow,
            accessKey : notificationButtonAllowKey,
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
              // Fx 3.7a5+ calls shouldLoad for location.href changes.
              rpServiceObj.registerAllowedRedirect(location.href,
                  redirectTargetUri);
              location.href = redirectTargetUri;
            }
          }, {
            label : notificationButtonDeny,
            accessKey : notificationButtonDenyKey,
            popup : null,
            callback : function() {
              // Do nothing. The notification closes when this is called.
            }
//          }, {
//            label : notificationButtonOptions,
//            accessKey : notificationButtonOptionsKey,
//            popup : optionsPopupName,
//            callback : null
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
   *          documentToCheck
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
   *          documentToCheck
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
   *          event
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
        // We don't do this immediately anymore because slow systems might have
        // this slow down the loading of the page, which is noticable
        // especially with CSS loading delays (it's not unlikely that slow
        // webservers have a hand in this, too).
        // Note that the change to _setBlockedContentCheckTimeout seems to have
        // added a bug where opening a blank tab and then quickly switching back
        // to the original tab can cause the original tab's blocked content
        // notification to be cleared. A simple compensation was to decrease
        // the timeout from 1000ms to 250ms, making it much less likely the tab
        // switch can be done in time for a blank opened tab. This isn't a real
        // solution, though.
        // this._checkForBlockedContent(document);
        this._setBlockedContentCheckTimeout();
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
   *          event
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
    // TODO: this probably needs to be rewritten or at least thought through
    // again in light of it being years later and much of RP changing. It's
    // likely that there's wasted work happening during time-critical page
    // loading going on in here.
    try {
      var documentUri = requestpolicy.mod.DomainUtil
          .stripFragment(document.documentURI);
      requestpolicy.mod.Logger.debug(requestpolicy.mod.Logger.TYPE_INTERNAL,
          "Checking for blocked content from page <" + documentUri + ">");
      this._blockedContentCheckLastTime = (new Date()).getTime();
      this._stopBlockedContentCheckTimeout();
      if (requestpolicy.mod.RequestUtil.originHasRejectedRequests(documentUri)) {
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
          if (requestpolicy.mod.RequestUtil.originHasRejectedRequests(j)) {
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
    var rejectedRequests = requestpolicy.mod.RequestUtil.getDirectRejectedRequests(
        document.location);
    var blockedUris = {};
    for (var destBase in rejectedRequests) {
      for (var destIdent in rejectedRequests[destBase]) {
        for (var destUri in rejectedRequests[destBase][destIdent]) {
          blockedUris[destUri] = true;
        }
      }
    }

    // Ideally, want the image to be a broken image so that the alt text
    // shows. By default, the blocked image will just not show up at all.
    // Setting img.src to a broken resource:// causes "save page as" to fail
    // for some earlier Fx 3.x versions. Also, using a broken resource://
    // causes our width setting to be ignored, as does using null for img.src.
    // With Firefox 4, setting img.src to null doesn't work reliably for
    // having the rest of the styles (e.g. background and border) applied.
    // So, for now we're punting on trying to display alt text. We'll just use
    // a transparent image as the replacement image.
    // Note that with our changes to the image here, "save page as" works but
    // different data is saved depending on what type of "save page as" the
    // user performs. With "save all files", the saved source includes the
    // original, blocked image src. With "web page, complete" the saved source
    // has changes we make here to show the blocked request indicator.

    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      // Note: we're no longer checking img.requestpolicyBlocked here.
      if (!img.requestpolicyIdentified && img.src in blockedUris) {
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
            + (img.title ? " " + img.title : "")
            + (img.alt ? " " + img.alt : "");
        img.src = this._transparentImageDataUri;
      }
    }
  },

  /**
   * Sets the blocked content notifications visible to the user.
   */
  _setBlockedContentNotification : function(isContentBlocked) {
    //this._rpStatusbar.setAttribute("requestpolicyBlocked", isContentBlocked);
    if (!this._isFennec) {
    //  this._rpContextMenu
    //      .setAttribute("requestpolicyBlocked", isContentBlocked);
      this._toolbox.setAttribute("requestpolicyBlocked", isContentBlocked);
    }
    if (this._addonbar) {
      this._addonbar.setAttribute("requestpolicyBlocked", isContentBlocked);
      this._tabbar.setAttribute("requestpolicyBlocked", isContentBlocked);
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
    //this._rpStatusbar.setAttribute("requestpolicyPermissive", isPermissive);
    //requestpolicy.menu.setItemAllowAllTemporarilyChecked(isPermissive);
    if (!this._isFennec) {
      //this._rpContextMenu.setAttribute("requestpolicyPermissive", isPermissive);
      this._toolbox.setAttribute("requestpolicyPermissive", isPermissive);
    }
    if (this._addonbar) {
      this._addonbar.setAttribute("requestpolicyPermissive", isPermissive);
      this._tabbar.setAttribute("requestpolicyPermissive", isPermissive);
    }
  },

  /**
   * This function is called when any allowed requests happen. This must be as
   * fast as possible because request processing blocks until this function
   * returns.
   * 
   * @param {}
   *          originUri
   * @param {}
   *          destUri
   */
  observeAllowedRequest : function(originUri, destUri) {
    if (this.requestLogTreeView) {
      this.requestLogTreeView.addAllowedRequest(originUri, destUri);
    }
  },

  /**
   * This function is called when any blocked requests happen. This must be as
   * fast as possible because request processing blocks until this function
   * returns.
   * 
   * @param {}
   *          originUri
   * @param {}
   *          destUri
   */
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

  /**
   * If the RP service noticed a blocked top-level document request, look for
   * a tab where the current location is the same as the origin of the blocked
   * request. If we find one, show a redirect notification. Note that if there
   * is more than one tab in this window open to the same origin, then we only
   * show the notification in the first one we find. However, if there are
   * multiple windows open and two different windows have a tab open to this
   * same origin, then the first tab at that location in each window will show
   * the redirect notification. This is because the RP service informs each
   * window separately to look for a document to show a notification in.
   */
  observeBlockedTopLevelDocRequest : function (originUri, destUri) {
    const document = this._getDocumentAtUri(originUri);
    if (!document) {
      return;
    }
    // We're called indirectly from shouldLoad so we can't block.
    window.setTimeout(
      function() {
        requestpolicy.overlay._showRedirectNotification(
          document, destUri, 0);
      }, 0);
  },

  _getDocumentAtUri : function(uri) {
    var num = gBrowser.browsers.length;
    for (var i = 0; i < num; i++) {
      if (gBrowser.getBrowserAtIndex(i).currentURI.spec == uri) {
        return gBrowser.getBrowserAtIndex(i).contentDocument;
      }
    }
    return null;
  },

  // TODO: observeBlockedFormSubmissionRedirect

  _updateNotificationDueToBlockedContent : function() {
    if (!this._blockedContentCheckTimeoutId) {
      this._setBlockedContentCheckTimeout();
    }
  },

  _setBlockedContentCheckTimeout : function() {
    const document = content.document;
    this._blockedContentCheckTimeoutId = window.setTimeout(
        function() {
          requestpolicy.overlay._checkForBlockedContent(document);
        }, this._blockedContentCheckTimeoutDelay);
  },

  _stopBlockedContentCheckTimeout : function() {
    if (this._blockedContentCheckTimeoutId) {
      window.clearTimeout(this._blockedContentCheckTimeoutId);
      this._blockedContentCheckTimeoutId = null;
    }
  },

  _getDocShellAllowMetaRedirects : function(document) {
    var docShell = document.defaultView
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShell);
    return docShell.allowMetaRedirects;
  },

  /**
   * Perform the actions required once the DOM is loaded. This may be being
   * called for more than just the page content DOM. It seems to work for now.
   * 
   * @param {Event}
   *          event
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
        // The dest may be empty if the origin is what should be refreshed. This
        // will be handled by DomainUtil.determineRedirectUri().
        var dest = parts[1];
        requestpolicy.mod.Logger.info(
            requestpolicy.mod.Logger.TYPE_META_REFRESH, "meta refresh to <"
                + dest + "> (" + delay
                + " second delay) found in document at <" + document.location
                + ">");
        // If dest isn't a valid uri, assume it's a relative uri.
        if (!requestpolicy.mod.DomainUtil.isValidUri(dest)) {
          var origDest = dest;
          dest = document.documentURIObject.resolve(dest);
          requestpolicy.mod.Logger.info(
              requestpolicy.mod.Logger.TYPE_META_REFRESH,
              "meta refresh destination <" + origDest
                  + "> appeared to be relative to <" + document.documentURI
                  + ">, so it has been resolved to <" + dest + ">");
        }

        if (!this._getDocShellAllowMetaRedirects(document)) {
          requestpolicy.mod.Logger.warning(
              requestpolicy.mod.Logger.TYPE_META_REFRESH,
              "Another extension disabled docShell.allowMetaRedirects.");
        }

        // We don't automatically perform any allowed redirects. Instead, we
        // just detect when they will be blocked and show a notification. If
        // the docShell has allowMetaRedirects disabled, it will be respected.
        if (!this._rpService._blockingDisabled
            && !this._rpService.isAllowedRedirect(document.location.href, dest)) {
          // Ignore redirects to javascript. The browser will ignore them, as well.
          if (requestpolicy.mod.DomainUtil.getUriObject(dest)
                .schemeIs("javascript")) {
            requestpolicy.mod.Logger.warning(
                requestpolicy.mod.Logger.TYPE_META_REFRESH,
                "Ignoring redirect to javascript URI <" + dest + ">");
            continue;
          }
          // The request will be blocked by shouldLoad.
          this._showRedirectNotification(document, dest, delay);
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

    if (this._rpService._blockedRedirects[document.location]) {
      var dest = this._rpService._blockedRedirects[document.location];
      requestpolicy.mod.Logger.warning(
          requestpolicy.mod.Logger.TYPE_HEADER_REDIRECT,
          "Showing notification for blocked redirect. To <" + dest + "> "
              + "from <" + document.location + ">");
      this._showRedirectNotification(document, dest);
      delete this._rpService._blockedRedirects[document.location];
    }

    this._wrapWindowOpen(document.defaultView);
  },

  /**
   * Called as an event listener when popupshowing fires on the
   * contentAreaContextMenu.
   */
  _contextMenuOnPopupShowing : function() {
    requestpolicy.overlay._wrapOpenLink();
    /*requestpolicy.overlay._attachPopupToContextMenu();*/
  },

  /**
   * Called as an event listener when popuphidden fires on the
   * contentAreaContextMenu.
   */
  //_contextMenuOnPopupHidden : function(event) {
  //  if (event.currentTarget != event.originalTarget) {
  //    return;
  //  }
  //  /*requestpolicy.overlay._attachPopupToStatusbar();*/
  //},

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

      // For reference, the addTab() function signature looks like this:
      // function addTab(aURI, aReferrerURI, aCharset, aPostData, aOwner,
      // aAllowThirdPartyFixup) {";
      // where it's possible that only two arguments are used and aReferrerURI
      // is a hash of the other arguments as well as new ones.
      // See https://www.requestpolicy.com/dev/ticket/38

      // In order to keep our code from breaking if the signature of addTab
      // changes (even just a change in variable names, for example), we'll
      // simply insert our own line right after the first curly brace in the
      // string representation of the addTab function.
      var addTabString = gBrowser.addTab.toString();
      var firstCurlyBrace = addTabString.indexOf("{");
      var addTabParts = [];
      // Includes the '{'
      addTabParts[0] = addTabString.substring(0, firstCurlyBrace + 1);
      // Starts after the '{'
      addTabParts[1] = addTabString.substring(firstCurlyBrace + 1);

      // We use 'arguments' so that we aren't dependent on the names of two
      // parameters, as it seems not unlikely that these could change due to
      // the second parameter's purpose having been changed.
      var newFirstCodeLine = "\n    requestpolicy.overlay.tabAdded(arguments[0], arguments[1]);";
      // Finally, add our line to the beginning of the addTab function.
      eval("gBrowser.addTab = " + addTabParts[0] + newFirstCodeLine
          + addTabParts[1]);
    }
  },

  /**
   * This is called by the modified addTab().
   * 
   * @param {String}
   *          url
   * @param {nsIURI/hash}
   *          referrerURI
   */
  tabAdded : function(url, referrerURI) {
    // The second argument to addTab was changed to a hash.
    // See https://www.requestpolicy.com/dev/ticket/38
    if (referrerURI && !(referrerURI instanceof Components.interfaces.nsIURI)) {
      if ("referrerURI" in referrerURI) {
        referrerURI = referrerURI.referrerURI;
      } else {
        referrerURI = null;
      }
    }
    if (referrerURI) {
      this._rpService.registerLinkClicked(referrerURI.spec, url);
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
   *          window
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
        return window.requestpolicyOrigOpenDialog.apply(window, arguments);
      };
    }
  },

  _addLocationObserver : function() {
    this.locationListener = {
      onLocationChange : function(aProgress, aRequest, aURI) {
        // This gets called both for tab changes and for history navigation.
        // The timer is running on the main window, not the document's window,
        // so we want to stop the timer when the tab is changed.
        requestpolicy.overlay._stopBlockedContentCheckTimeout();
        requestpolicy.overlay._checkForBlockedContent(content.document);
      },
      // Though unnecessary for Gecko 2.0, I'm leaving in onSecurityChange for
      // SeaMonkey because of https://bugzilla.mozilla.org/show_bug.cgi?id=685466
      onSecurityChange : function() {
      },

      QueryInterface : function(aIID) {
        if (aIID.equals(Components.interfaces.nsIWebProgressListener)
            || aIID.equals(Components.interfaces.nsISupportsWeakReference)
            || aIID.equals(Components.interfaces.nsISupports))
          return this;
        throw Components.results.NS_NOINTERFACE;
      }
    };

    // https://developer.mozilla.org/en/Code_snippets/Progress_Listeners
    // "Starting in Gecko 2.0, all events are optional. The tabbrowser only
    // notifies you of the events for which you provide a callback."
    gBrowser.addProgressListener(this.locationListener);
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
    try {
      sHistory.removeSHistoryListener(this.historyListener);
    } catch (e) {
      // When closing the last window in a session where additional windows
      // have been opened and closed, this will sometimes fail (bug #175).
    }
  },

  /**
   * Called before the popup menu is shown.
   * 
   * @param {Event}
   *          event
   */
  onPopupShowing : function(event) {
//    if (event.currentTarget != event.originalTarget) {
//      return;
//    }
    requestpolicy.menu.prepareMenu();
  },

  /**
   * Called after the popup menu is hidden.
   * 
   * @param {Event}
   *          event
   */
  onPopupHiding : function(event) {
    var rulesChanged = requestpolicy.menu.processQueuedRuleChanges();
    if (rulesChanged || this._needsReloadOnMenuClose) {
      //if (this._rpService.prefs.getBoolPref("autoReload")) {
        content.document.location.reload(false);
      //}
    }
    this._needsReloadOnMenuClose = false;
//    if (event.currentTarget != event.originalTarget) {
//      return;
//    }
    // Leave the popup attached to the context menu, as we consider that the
    // default location for it.
    //this._attachPopupToContextMenu();
  },

  /**
   * Determines the top-level document's uri identifier based on the current
   * identifier level setting.
   * 
   * @return {String} The current document's identifier.
   */
  getTopLevelDocumentUriIdentifier : function() {
    return this._rpService.getUriIdentifier(this
        .getTopLevelDocumentUri());
  },

  /**
   * Get the top-level document's uri.
   */
  getTopLevelDocumentUri : function() {
    // We don't just retrieve the translations array once during init because
    // we're not sure if it will be fully populated during init. This is
    // especially a concern given the async addon manager API in Firefox 4.
    var translations = this._rpService.getTopLevelDocTranslations();
    if (translations.length) {
      var docURI = content.document.documentURI;
      for (var i = 0; i < translations.length; i++) {
        if (docURI.indexOf(translations[i][0]) == 0) {
          return translations[i][1];
        }
      }
    }
    return requestpolicy.mod.DomainUtil
        .stripFragment(content.document.documentURI);
  },

  /**
   * Toggles disabling of all blocking for the current session.
   * 
   * @param {Event}
   *          event
   */
  toggleTemporarilyAllowAll : function(event) {
    var disabled = !this._rpService._blockingDisabled;
    this._rpService.setBlockingDisabled(disabled);

    // Change the link displayed in the menu.
    document.getElementById('rp-link-enable-blocking').hidden = !disabled;
    document.getElementById('rp-link-disable-blocking').hidden = disabled;

    this._setPermissiveNotificationForAllWindows(disabled);
  },

  /**
   * Allows requests from the specified origin to any destination for the
   * duration of the browser session.
   */
  temporarilyAllowOrigin : function(originHost) {
    this._rpService.temporarilyAllowOrigin(originHost);
  },

  /**
   * Allows the current document's origin to request from any destination for
   * the duration of the browser session.
   * 
   * @param {Event}
   *          event
   */
  temporarilyAllowCurrentOrigin : function(event) {
    // Note: the available variable "content" is different than the avaialable
    // "window.target".
    var host = this.getTopLevelDocumentUriIdentifier();
    this._rpService.temporarilyAllowOrigin(host);
  },

  /**
   * Allows a destination to be requested from any origin for the duration of
   * the browser session.
   * 
   * @param {String}
   *          destHost
   */
  temporarilyAllowDestination : function(destHost) {
    this._rpService.temporarilyAllowDestination(destHost);
  },

  /**
   * Allows a destination to be requested from a single origin for the duration
   * of the browser session.
   * 
   * @param {String}
   *          originHost
   * @param {String}
   *          destHost
   */
  temporarilyAllowOriginToDestination : function(originHost, destHost) {
    this._rpService.temporarilyAllowOriginToDestination(originHost, destHost);
  },

  /**
   * Allows requests from an origin, including in future browser sessions.
   */
  allowOrigin : function(originHost) {
    this._rpService.allowOrigin(originHost);
  },

  /**
   * Allows the current document's origin to request from any destination,
   * including in future browser sessions.
   * 
   * @param {Event}
   *          event
   */
  allowCurrentOrigin : function(event) {
    var host = this.getTopLevelDocumentUriIdentifier();
    this._rpService.allowOrigin(host);
  },

  /**
   * Allows requests to a destination, including in future browser sessions.
   * 
   * @param {String}
   *          destHost
   */
  allowDestination : function(destHost) {
    this._rpService.allowDestination(destHost);
  },

  /**
   * Allows requests to a destination from a single origin, including in future
   * browser sessions.
   * 
   * @param {String}
   *          originHost
   * @param {String}
   *          destHost
   */
  allowOriginToDestination : function(originHost, destHost) {
    this._rpService.allowOriginToDestination(originHost, destHost);
  },

  /**
   * Forbids an origin from requesting from any destination. This revoke's
   * temporary or permanent request permissions the origin had been given.
   */
  forbidOrigin : function(originHost) {
    this._rpService.forbidOrigin(originHost);
  },

  /**
   * Forbids the current document's origin from requesting from any destination.
   * This revoke's temporary or permanent request permissions the origin had
   * been given.
   * 
   * @param {Event}
   *          event
   */
  forbidCurrentOrigin : function(event) {
    var host = this.getTopLevelDocumentUriIdentifier();
    this._rpService.forbidOrigin(host);
  },

  /**
   * Forbids a destination from being requested by any origin. This revoke's
   * temporary or permanent request permissions the destination had been given.
   * 
   * @param {String}
   *          destHost
   */
  forbidDestination : function(destHost) {
    this._rpService.forbidDestination(destHost);
  },

  /**
   * Forbids a destination from being requested by a single origin. This
   * revoke's temporary or permanent request permissions the destination had
   * been given.
   * 
   * @param {String}
   *          originHost
   * @param {String}
   *          destHost
   */
  forbidOriginToDestination : function(originHost, destHost) {
    this._rpService.forbidOriginToDestination(originHost, destHost);
  },

  addAllowRule : function(ruleData) {
    this._rpService.addAllowRule(ruleData);
  },

  addTemporaryAllowRule : function(ruleData) {
    this._rpService.addTemporaryAllowRule(ruleData);
  },

  removeAllowRule : function(ruleData) {
    this._rpService.removeAllowRule(ruleData);
  },

  addDenyRule : function(ruleData) {
    this._rpService.addDenyRule(ruleData);
  },

  addTemporaryDenyRule : function(ruleData) {
    this._rpService.addTemporaryDenyRule(ruleData);
  },

  removeDenyRule : function(ruleData) {
    this._rpService.removeDenyRule(ruleData);
  },

  /**
   * Revokes all temporary permissions granted during the current session.
   * 
   * @param {Event}
   *          event
   */
  revokeTemporaryPermissions : function(event) {
    this._rpService.revokeTemporaryPermissions();
    this._needsReloadOnMenuClose = true;
    var popup = document.getElementById('rp-popup');
    popup.hidePopup();
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

  openMenuByHotkey : function() {
    var popup = document.getElementById('rp-popup');
    // Ideally we'd put the popup in its normal place based on the rp toolbar
    // button but let's not count on that being visible. So, we'll be safe and
    // anchor it within the content element. However, there's no good way to
    // right-align a popup. So, we can either let it be left aligned or we can
    // figure out where we think the top-left corner should be. And that's what
    // we do.
    // The first time the width will be 0. The default value is determined by
    // logging it or you can probably figure it out from the CSS which doesn't
    // directly specify the width of the entire popup.
    //requestpolicy.mod.Logger.dump('popup width: ' + popup.clientWidth);
    var popupWidth = popup.clientWidth ? 730 : popup.clientWidth;
    var anchor = document.getElementById('content');
    var contentWidth = anchor.clientWidth;
    // Take a few pixels off so it doesn't cover the browser chrome's border.
    var xOffset = contentWidth - popupWidth - 2;
    popup.openPopup(anchor, 'overlap', xOffset);
  },

//  showExtensionConflictInfo : function() {
//    var ext = this._rpService.getConflictingExtensions();
//    var extJson = requestpolicy.mod.JSON.stringify(ext);
//    this._openInNewTab(this._extensionConflictInfoUri
//        + encodeURIComponent(extJson));
//  },

//  showPrefetchInfo : function() {
//    this._openInNewTab(this._prefetchInfoUri);
//  },
//
//  showPrefetchDisablingInstructions : function() {
//    this._openInNewTab(this._prefetchDisablingInstructionsUri);
//  },

  _showWelcomeWindow : function() {
    if (!this._rpService.prefs.getBoolPref("welcomeWindowShown")) {
      this._rpService.prefs.setBoolPref("welcomeWindowShown", true);
      this._rpService._prefService.savePrefFile(null);
      window.setTimeout(function() {
        var tab = gBrowser.addTab("chrome://requestpolicy/content/settings/setup.html");
        gBrowser.selectedTab = tab;
      }, 0);
    }
  },

  openToolbarPopup : function(anchor) {
//    requestpolicy.overlay._toolbox.insertBefore(requestpolicy.overlay._menu,
//        null);
    this._menu.openPopup(anchor, 'after_start', 0, 0, true, true);
  },

  openPrefs : function() {
    this.openSettingsTab('chrome://requestpolicy/content/settings/basicprefs.html');
  },

  openPolicyManager : function() {
    this.openSettingsTab('chrome://requestpolicy/content/settings/yourpolicy.html');
  },

  openHelp : function() {
    var tab = gBrowser.addTab('https://www.requestpolicy.com/help-1.0.html');
    gBrowser.selectedTab = tab;
  },

//  openAbout : function() {
//    var tab = gBrowser.addTab('https://www.requestpolicy.com/about.html');
//    gBrowser.selectedTab = tab;
//  },

  openSettingsTab : function (url) {
    // Modified from the example at
    // https://developer.mozilla.org/en-US/docs/Code_snippets/Tabbed_browser
    var attrName = 'RequestPolicySettingsTab';
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
    for (var found = false, index = 0, tabbrowser = wm.getEnumerator('navigator:browser').getNext().gBrowser;
         index < tabbrowser.tabContainer.childNodes.length && !found;
         index++) {
      var currentTab = tabbrowser.tabContainer.childNodes[index];
      if (currentTab.hasAttribute(attrName)) {
        gBrowser.getBrowserForTab(currentTab).loadURI(url);
        tabbrowser.selectedTab = currentTab;
        // Focus *this* browser window in case another one is currently focused
        tabbrowser.ownerDocument.defaultView.focus();
        found = true;
      }
    }
    if (!found) {
      // Our tab isn't open. Open it now.
      var browserEnumerator = wm.getEnumerator("navigator:browser");
      var tabbrowser = browserEnumerator.getNext().gBrowser;
      var newTab = tabbrowser.addTab(url);
      newTab.setAttribute(attrName, "xyz");
      tabbrowser.selectedTab = newTab;
      // Focus *this* browser window in case another one is currently focused
      tabbrowser.ownerDocument.defaultView.focus();
    }
  },

  clearRequestLog : function() {
    this.requestLogTreeView.clear();
  },

  toggleRequestLog : function() {
    var requestLog = document.getElementById("requestpolicy-requestLog");
    var requestLogSplitter = document.getElementById("requestpolicy-requestLog-splitter");
    var requestLogFrame = document.getElementById("requestpolicy-requestLog-frame");
    //var openRequestLog = document.getElementById("requestpolicyOpenRequestLog");

    // TODO: figure out how this should interact with the new menu.
    //var closeRequestLog = document
    //    .getElementById("requestpolicyCloseRequestLog");
    var closeRequestLog = {};

    if (requestLog.hidden) {
      requestLogFrame.setAttribute("src",
          "chrome://requestpolicy/content/requestLog.xul");
      requestLog.hidden = requestLogSplitter.hidden = closeRequestLog.hidden = false;
      //openRequestLog.hidden = true;
    } else {
      requestLogFrame.setAttribute("src", "about:blank");
      requestLog.hidden = requestLogSplitter.hidden = closeRequestLog.hidden = true;
      //openRequestLog.hidden = false;
      this.requestLogTreeView = null;
    }
  }

};

// Initialize the requestpolicy.overlay object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestpolicy.overlay.init();
    }, false);

// Event handler for when the window is closed. We listen for "unload" rather
// than "close" because "close" will fire when a print preview opened from this
// window is closed.
addEventListener("unload", function(event) {
      requestpolicy.overlay.onWindowClose(event);
    }, false);

// Registers event handlers for documents loaded in the window.
addEventListener("load", function(event) {
      requestpolicy.overlay.onLoad(event);
    }, false);
