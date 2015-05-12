/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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


/**
 * Provides functionality for the overlay. An instance of this class exists for
 * each tab/window.
 */
requestpolicy.overlay = (function() {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;

  let {ScriptLoader, XPCOMUtils} = (function() {
    let mod = {};
    Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm", mod);
    Cu.import("resource://gre/modules/XPCOMUtils.jsm", mod);
    return mod;
  }());

  // iMod: Alias for ScriptLoader.importModule
  let iMod = ScriptLoader.importModule;
  let {Environment, ProcessEnvironment} = iMod("lib/environment");
  let {ManagerForMessageListeners} = iMod("lib/manager-for-message-listeners");
  let {Logger} = iMod("lib/logger");
  let {rpPrefBranch, Prefs} = iMod("lib/prefs");
  let {RequestProcessor} = iMod("lib/request-processor");
  let {PolicyManager} = iMod("lib/policy-manager");
  let {DomainUtil} = iMod("lib/utils/domains");
  let {StringUtils} = iMod("lib/utils/strings");
  let {DOMUtils} = iMod("lib/utils/dom");
  let {WindowUtils} = iMod("lib/utils/windows");
  let {C} = iMod("lib/utils/constants");

  let gBrowser = WindowUtils.getTabBrowser(window);

  let $id = document.getElementById.bind(document);

  //let _extensionConflictInfoUri = "http://www.requestpolicy.com/conflict?ext=";

  //let _prefetchInfoUri = "http://www.requestpolicy.com/help/prefetch.html";
  //let _prefetchDisablingInstructionsUri = "http://www.requestpolicy.com/help/prefetch.html#disable";


  // create an environment for this overlay.
  let OverlayEnvironment = new Environment(ProcessEnvironment, "OverlayEnv");
  // manage this overlay's message listeners:
  let mlManager = new ManagerForMessageListeners(OverlayEnvironment,
                                                 window.messageManager);


  let initialized = false;

  let toolbarButtonId = "rpcontinuedToolbarButton";

  let overlayId = 0;

  let blockedContentStateUpdateDelay = 250; // milliseconds
  let blockedContentCheckTimeoutId = null;
  let blockedContentCheckMinWaitOnObservedBlockedRequest = 500;
  let blockedContentCheckLastTime = 0;

  let popupElement = null;

  //let statusbar = null;

  // TODO: get back entry in context menu
  // https://github.com/RequestPolicyContinued/requestpolicy/issues/353
  //let rpContextMenu = null;

  let toolbox = null;

  let isFennec = false;



  let self = {
    // This is set by request-log.js when it is initialized. We don't need to worry
    // about setting it here.
    requestLog: null
  };


  self.toString = function() {
    return "[requestpolicy.overlay " + overlayId + "]";
  };

  /**
   * Initialize the object. This must be done after the DOM is loaded.
   */
  self.init = function() {
    try {
      if (initialized === false) {
        initialized = true;
        overlayId = (new Date()).getTime();

        requestpolicy.menu.init();

        popupElement = $id("rpc-popup");

        //statusbar = $id("status-bar");
        //rpContextMenu = $id("rpcontinuedContextMenu");
        toolbox = $id("navigator-toolbox");

        var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULAppInfo);
        isFennec = (appInfo.ID === "{a23983c0-fd0e-11dc-95ff-0800200c9a66}");

        if (isFennec) {
          Logger.dump("Detected Fennec.");
          // Set an attribute for CSS usage.
          popupElement.setAttribute("fennec", "true");
          popupElement.setAttribute("position", "after_end");
        }

        // Register this window with the requestpolicy service so that we can be
        // notified of blocked requests. When blocked requests happen, this
        // object's observerBlockedRequests() method will be called.
        RequestProcessor.addRequestObserver(self);

        //self.setContextMenuEnabled(rpPrefBranch.getBoolPref("contextMenu"));

        OverlayEnvironment.shutdownOnUnload(window);
        OverlayEnvironment.startup();

        // Tell the framescripts that the overlay is ready. The
        // listener must be added immediately.
        mlManager.addListener("isOverlayReady", function() {
          return true;
        });
        window.messageManager.broadcastAsyncMessage(C.MM_PREFIX +
                                                    "overlayIsReady", true);
      }
    } catch (e) {
      Logger.severe(Logger.TYPE_ERROR,
          "Fatal Error, " + e + ", stack was: " + e.stack);
      Logger.severe(Logger.TYPE_ERROR,
          "Unable to initialize requestpolicy.overlay.");
      throw e;
    }
  };

  //setContextMenuEnabled : function(isEnabled) {
  //  rpContextMenu.setAttribute("hidden", !isEnabled);
  //},

  OverlayEnvironment.addShutdownFunction(
      Environment.LEVELS.INTERFACE,
      function() {
        RequestProcessor.removeRequestObserver(self);
        self._unwrapAddTab();
        self._removeHistoryObserver();
        self._removeLocationObserver();
      });

  OverlayEnvironment.addShutdownFunction(
    Environment.LEVELS.UI,
    function() {
      let requestLog = $id("rpcontinued-requestLog");

      // If the request log is found and is opened.
      // The XUL elements of the request log might have already
      // been removed.
      if (!!requestLog && requestLog.hidden === false) {
        self.toggleRequestLog();
      }
    });

  function addAppcontentTabSelectListener() {
    // Info on detecting page load at:
    // http://developer.mozilla.org/En/Code_snippets/On_page_load
    var appcontent = $id("appcontent"); // browser
    if (appcontent) {
      if (isFennec) {
        OverlayEnvironment.elManager.addListener(appcontent, "TabSelect",
                                                 self.tabChanged, false);
      }
    }
  }
  OverlayEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        addAppcontentTabSelectListener);

  /**
   * Add an event listener for when the contentAreaContextMenu (generally
   * the right-click menu within the document) is shown.
   */
  function addContextMenuListener() {
    var contextMenu = $id("contentAreaContextMenu");
    if (contextMenu) {
      OverlayEnvironment.elManager.addListener(contextMenu, "popupshowing",
                                               self._contextMenuOnPopupShowing,
                                               false);
    }
  }
  OverlayEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        addContextMenuListener);

  function addTabContainerTabSelectListener() {
    // We consider the default place for the popup to be attached to the
    // context menu, so attach it there.
    //self._attachPopupToContextMenu();

    // Listen for the user changing tab so we can update any notification or
    // indication of blocked requests.
    if (!isFennec) {
      var container = gBrowser.tabContainer;

      let tabSelectCallback = function(event) {
        self.tabChanged();
      };

      OverlayEnvironment.elManager.addListener(container, "TabSelect",
                                               tabSelectCallback, false);

      self._wrapAddTab();
      self._addLocationObserver();
      self._addHistoryObserver();
    }
  }
  OverlayEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        addTabContainerTabSelectListener);




  mlManager.addListener("notifyDocumentLoaded", function(message) {
    let {documentURI} = message.data;

    // the <browser> element of the corresponding tab.
    let browser = message.target;

    let blockedURIs = {};

    if (rpPrefBranch.getBoolPref("indicateBlockedObjects")) {
      var indicateBlacklisted = rpPrefBranch
          .getBoolPref("indicateBlacklistedObjects");

      var rejectedRequests = RequestProcessor._rejectedRequests
          .getOriginUri(documentURI);
      for (var destBase in rejectedRequests) {
        for (var destIdent in rejectedRequests[destBase]) {
          for (var destUri in rejectedRequests[destBase][destIdent]) {
            // case 1: indicateBlacklisted == true
            //         ==> indicate the object has been blocked
            //
            // case 2: indicateBlacklisted == false
            // case 2a: all requests have been blocked because of a blacklist
            //          ==> do *not* indicate
            //
            // case 2b: at least one of the blocked (identical) requests has been
            //          blocked by a rule *other than* the blacklist
            //          ==> *do* indicate
            let requests = rejectedRequests[destBase][destIdent][destUri];
            if (indicateBlacklisted ||
                self._containsNonBlacklistedRequests(requests)) {
              blockedURIs[destUri] = blockedURIs[destUri] ||
                  {identifier: DomainUtil.getIdentifier(destUri)};
            }
          }
        }
      }
    }

    if ("requestpolicy" in browser &&
        documentURI in browser.requestpolicy.blockedRedirects) {
      // bad smell: do not save blocked requests in the <browser> obj
      var dest = browser.requestpolicy.blockedRedirects[documentURI];
      Logger.warning(Logger.TYPE_HEADER_REDIRECT,
          "Showing notification for blocked redirect. To <" + dest +
          "> " + "from <" + documentURI + ">");
      self._showRedirectNotification(browser, dest);

      delete browser.requestpolicy.blockedRedirects[documentURI];
    }

    // send the list of blocked URIs back to the frame script
    return {blockedURIs: blockedURIs};
  });



  mlManager.addListener("notifyTopLevelDocumentLoaded", function (message) {
    // Clear any notifications that may have been present.
    self._setContentBlockedState(false);
    // We don't do this immediately anymore because slow systems might have
    // this slow down the loading of the page, which is noticable
    // especially with CSS loading delays (it's not unlikely that slow
    // webservers have a hand in this, too).
    // Note that the change to _updateBlockedContentStateAfterTimeout seems to have
    // added a bug where opening a blank tab and then quickly switching back
    // to the original tab can cause the original tab's blocked content
    // notification to be cleared. A simple compensation was to decrease
    // the timeout from 1000ms to 250ms, making it much less likely the tab
    // switch can be done in time for a blank opened tab. This isn't a real
    // solution, though.
    self._updateBlockedContentStateAfterTimeout();
  });



  mlManager.addListener("notifyDOMFrameContentLoaded", function (message) {
    // This has an advantage over just relying on the
    // observeBlockedRequest() call in that this will clear a blocked
    // content notification if there no longer blocked content. Another way
    // to solve this would be to observe allowed requests as well as blocked
    // requests.
    blockedContentCheckLastTime = (new Date()).getTime();
    self._stopBlockedContentCheckTimeout();
    self._updateBlockedContentState(message.target);
  });



  mlManager.addListener("handleMetaRefreshes", function(message) {
    self.handleMetaRefreshes(message);
  });



  mlManager.addListener("notifyLinkClicked", function (message) {
    RequestProcessor.registerLinkClicked(message.data.origin,
                                         message.data.dest);
  });



  mlManager.addListener("notifyFormSubmitted", function (message) {
    RequestProcessor.registerFormSubmitted(message.data.origin,
                                           message.data.dest);
  });



  self.handleMetaRefreshes = function(message) {
    Logger.dump("Handling meta refreshes...");

    let {documentURI, metaRefreshes} = message.data;
    let browser = message.target;

    for (let i = 0, len = metaRefreshes.length; i < len; ++i) {
      let {delay, destURI, originalDestURI} = metaRefreshes[i];

      Logger.info(Logger.TYPE_META_REFRESH, "meta refresh to <" +
          destURI + "> (" + delay + " second delay) found in document at <" +
          documentURI + ">");

      if (originalDestURI) {
        Logger.info(Logger.TYPE_META_REFRESH,
            "meta refresh destination <" + originalDestURI + "> " +
            "appeared to be relative to <" + documentURI + ">, so " +
            "it has been resolved to <" + destURI + ">");
      }

      // We don't automatically perform any allowed redirects. Instead, we
      // just detect when they will be blocked and show a notification. If
      // the docShell has allowMetaRedirects disabled, it will be respected.
      if (!Prefs.isBlockingDisabled() &&
          !RequestProcessor.isAllowedRedirect(documentURI, destURI)) {
        // Ignore redirects to javascript. The browser will ignore them, as well.
        if (DomainUtil.getUriObject(destURI).schemeIs("javascript")) {
          Logger.warning(Logger.TYPE_META_REFRESH,
              "Ignoring redirect to javascript URI <" + destURI + ">");
          continue;
        }
        // The request will be blocked by shouldLoad.
        self._showRedirectNotification(browser, destURI, delay);
      }
    }
  };


  /**
   * Takes an URI, crops it if necessary, and returns it.
   * It's ensured that the returned URI isn't longer than a specified length,
   * but the prePath is never cropped, so that the resulting string might be
   * longer than aMaxLength.
   *
   * (There doesn't seem to be a way to use the xul crop attribute with the
   * notification.)
   *
   * @param {String} aUri
   * @param {Int} aMaxLength
   *
   * @returns {String} the URI, eventually cropped
   *
   */
  function cropUri(aUri, aMaxLength) {
    if (aUri.length < aMaxLength) {
      return aUri;
    } else {
      let prePathLength = DomainUtil.getPrePath(aUri).length + 1;
      let len = Math.max(prePathLength, aMaxLength);
      return aUri.substring(0, len) + "...";
    }
  }


  /**
   * Shows a notification that a redirect was requested by a page (meta refresh
   * or with headers).
   *
   * @param {<browser> element} browser
   * @param {string} redirectTargetUri
   * @param {number} delay
   * @param {string=} redirectOriginUri
   * @return {boolean} whether showing the notification succeeded
   */
  // TODO, bad smell: Instead of the <browser> etc. hand over a `Request`
  //                  object that contains everything. This requires
  //                  e.g. a `MetaRedirectRequest` class.
  self._showRedirectNotification = function(browser, redirectTargetUri, delay,
                                            redirectOriginUri) {
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

    // redirectOriginUri is optional and is not necessary for <meta> redirects.
    let isOriginUndefined = redirectOriginUri === undefined;
    redirectOriginUri = redirectOriginUri || self.getTopLevelDocumentUri();

    if (isFennec) {
      Logger.warning(Logger.TYPE_INTERNAL,
          "Should have shown redirect notification to <" + redirectTargetUri +
          ">, but it's not implemented yet on Fennec.");
      return false;
    }

    var notificationBox = gBrowser.getNotificationBox(browser);
    var notificationValue = "request-policy-meta-redirect";

    // prepare the notification's label
    let notificationLabel;
    if (isOriginUndefined) {
      notificationLabel = StringUtils.$str("redirectNotification",
          [cropUri(redirectTargetUri, 50)]);
    } else {
      notificationLabel = StringUtils.$str("redirectNotificationWithOrigin",
          [cropUri(redirectOriginUri, 50), cropUri(redirectTargetUri, 50)]);
    }


    var addRuleMenuName = "rpcontinuedRedirectAddRuleMenu";
    var addRulePopup = $id(addRuleMenuName);
    DOMUtils.removeChildren(addRulePopup);

    let m = requestpolicy.menu;
    var originBaseDomain = DomainUtil.getBaseDomain(redirectOriginUri);
    var destBaseDomain = DomainUtil.getBaseDomain(redirectTargetUri);

    var origin = null, dest = null;
    if (originBaseDomain !== null) {
      origin = m._addWildcard(originBaseDomain);
    }
    if (destBaseDomain !== null) {
      dest = m._addWildcard(destBaseDomain);
    }

    let mayPermRulesBeAdded = WindowUtils.mayPermanentRulesBeAdded(window);

    let cm = requestpolicy.classicmenu;

    if (destBaseDomain !== null) {
      cm.addMenuItemTemporarilyAllowDest(addRulePopup, dest);
      if (mayPermRulesBeAdded) {
        cm.addMenuItemAllowDest(addRulePopup, dest);
      }
    }

    if (originBaseDomain !== null && destBaseDomain !== null) {
      cm.addMenuSeparator(addRulePopup);
    }

    if (originBaseDomain !== null) {
      cm.addMenuItemTemporarilyAllowOrigin(addRulePopup, origin);
      if (mayPermRulesBeAdded) {
        cm.addMenuItemAllowOrigin(addRulePopup, origin);
      }
    }

    if (originBaseDomain !== null && destBaseDomain !== null) {
      cm.addMenuSeparator(addRulePopup);

      cm.addMenuItemTemporarilyAllowOriginToDest(addRulePopup, origin, dest);
      if (mayPermRulesBeAdded) {
        cm.addMenuItemAllowOriginToDest(addRulePopup, origin, dest);
      }
    }




    var notification = notificationBox
        .getNotificationWithValue(notificationValue);
    if (notification) {
      notification.label = notificationLabel;
    } else {
      var buttons = [
        {
          label: StringUtils.$str("allow"),
          accessKey: StringUtils.$str("allow.accesskey"),
          popup: null,
          callback: function() {
            // Fx 3.7a5+ calls shouldLoad for location.href changes.

            // TODO: currently the allow button ignores any additional
            //       HTTP response headers [1]. Maybe there is a way to take
            //       those headers into account (e.g. `Set-Cookie`?), or maybe
            //       this is not necessary at all.
            // [1] https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Response_fields

            RequestProcessor.registerAllowedRedirect(
                browser.documentURI.specIgnoringRef, redirectTargetUri);

            browser.messageManager.sendAsyncMessage(C.MM_PREFIX + "setLocation",
                {uri: redirectTargetUri});
          }
        },
        {
          label: StringUtils.$str("deny"),
          accessKey: StringUtils.$str("deny.accesskey"),
          popup: null,
          callback: function() {
            // Do nothing. The notification closes when this is called.
          }
        },
        {
          label: StringUtils.$str("addRule"),
          accessKey: StringUtils.$str("addRule.accesskey"),
          popup: addRuleMenuName,
          callback: null
        }
        // TODO: add a "read more about URL redirection" button, targetting to
        //       https://en.wikipedia.org/wiki/URL_redirection
      ];
      const priority = notificationBox.PRIORITY_WARNING_MEDIUM;
      notificationBox.appendNotification(notificationLabel, notificationValue,
          "chrome://browser/skin/Info.png", priority, buttons);
    }
    return true;
  };


  /**
   * Performs actions required to be performed after a tab change.
   */
  self.tabChanged = function() {
    // TODO: verify the Fennec and all supported browser versions update the
    // status bar properly with only the ProgressListener. Once verified,
    // remove calls to tabChanged();
    // self._updateBlockedContentState(content.document);
  };

  self._containsNonBlacklistedRequests = function(requests) {
    for (let i = 0, len = requests.length; i < len; i++) {
      if (!requests[i].isOnBlacklist()) {
        // This request has not been blocked by the blacklist
        return true;
      }
    }
    return false;
  };

  /**
   * Checks if the document has blocked content and shows appropriate
   * notifications.
   */
  self._updateBlockedContentState = function() {
    try {
      let browser = gBrowser.selectedBrowser;
      let uri = DomainUtil.stripFragment(browser.currentURI.spec);
      Logger.debug(Logger.TYPE_INTERNAL,
          "Checking for blocked requests from page <" + uri + ">");

      // TODO: this needs to be rewritten. checking if there is blocked
      // content could be done much more efficiently.
      let documentContainsBlockedContent = RequestProcessor
          .getAllRequestsInBrowser(browser).containsBlockedRequests();
      self._setContentBlockedState(documentContainsBlockedContent);

      let logText = documentContainsBlockedContent ?
                    "Requests have been blocked." :
                    "No requests have been blocked.";
      Logger.debug(Logger.TYPE_INTERNAL, logText);
    } catch (e) {
      Logger.severeError(
          "Unable to complete _updateBlockedContentState actions: " + e, e);
    }
  };

  /**
   * Sets the blocked content notifications visible to the user.
   */
  self._setContentBlockedState = function(isContentBlocked) {
    var button = $id(toolbarButtonId);
    if (button) {
      button.setAttribute("rpcontinuedBlocked", isContentBlocked);
    }
  };

  /**
   * Update RP's "permissive" status, which is to true or false.
   */
  function updatePermissiveStatus() {
    var button = $id(toolbarButtonId);
    if (button) {
      let isPermissive = Prefs.isBlockingDisabled();
      button.setAttribute("rpcontinuedPermissive", isPermissive);
    }
  }
  /**
   * register a pref observer
   */
  function updatePermissiveStatusOnPrefChanges() {
    OverlayEnvironment.obMan.observeRPPref(
        ["startWithAllowAllEnabled"],
        function(subject, topic, data) {
          if (topic === "nsPref:changed") {
            updatePermissiveStatus();
          }
        });
  }
  OverlayEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        updatePermissiveStatusOnPrefChanges);
  // initially set the Permissive Status
  OverlayEnvironment.addStartupFunction(Environment.LEVELS.UI,
                                        updatePermissiveStatus);

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
  self.observeAllowedRequest = function(originUri, destUri) {
    if (self.requestLog) {
      self.requestLog.addAllowedRequest(originUri, destUri);
    }
  };

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
  self.observeBlockedRequest = function(originUri, destUri) {
    self._updateNotificationDueToBlockedContent();
    if (self.requestLog) {
      self.requestLog.addBlockedRequest(originUri, destUri);
    }
  };

  /**
   * This function gets called when a top-level document request has been
   * blocked.
   * This function is called during shouldLoad(). As shouldLoad shoudn't be
   * blocked, it's better to set a timeout here.
   */
  self.observeBlockedTopLevelDocRequest = function (browser, originUri,
                                                    destUri) {
    // This function is called during shouldLoad() so set a timeout to
    // avoid blocking shouldLoad.
    window.setTimeout(function() {
      requestpolicy.overlay._showRedirectNotification(browser, destUri, 0);
    }, 0);
  };

  // TODO: observeBlockedFormSubmissionRedirect

  self._updateNotificationDueToBlockedContent = function() {
    if (!blockedContentCheckTimeoutId) {
      self._updateBlockedContentStateAfterTimeout();
    }
  };

  self._updateBlockedContentStateAfterTimeout = function() {
    const browser = gBrowser.selectedBrowser;
    blockedContentCheckTimeoutId = window.setTimeout(function() {
      requestpolicy.overlay._updateBlockedContentState(browser);
    }, blockedContentStateUpdateDelay);
  };

  self._stopBlockedContentCheckTimeout = function() {
    if (blockedContentCheckTimeoutId) {
      window.clearTimeout(blockedContentCheckTimeoutId);
      blockedContentCheckTimeoutId = null;
    }
  };

  /**
   * Called as an event listener when popupshowing fires on the
   * contentAreaContextMenu.
   */
  self._contextMenuOnPopupShowing = function() {
    requestpolicy.overlay._wrapOpenLink();
    /*requestpolicy.overlay._attachPopupToContextMenu();*/
  };

  /**
   * Wraps (overrides) the following methods of gContextMenu
   * - openLink()
   * - openLinkInPrivateWindow()
   * - openLinkInCurrent()
   * so that RequestPolicy can register a link-click.
   *
   * The original methods are defined in Firefox' nsContextMenu.js:
   * http://mxr.mozilla.org/mozilla-central/source/browser/base/content/nsContextMenu.js
   *
   * The openLinkInTab() method doesn't need to be wrapped because new tabs are already
   * recognized by tabAdded(), which is wrapped elsewhere. The tabAdded() function ends up
   * being called when openLinkInTab() is called.
   *
   * TODO: There are even more similar methods in gContextMenu (frame-specific),
   *       and perhaps the number will increase in future. Frame-specific contextMenu-
   *       entries are working, but are registered e.g. as "new window opened" by
   *       the subsequent shouldLoad() call.
   */
  self._wrapOpenLink = function() {
    if (!gContextMenu.requestpolicyMethodsOverridden) {
      gContextMenu.requestpolicyMethodsOverridden = true;

      gContextMenu.openLink = function() {
        RequestProcessor.registerLinkClicked(this.target.ownerDocument.URL, this.linkURL);
        return this.__proto__.openLink.call(this); // call the overridden method
      };

      // Below, we check whether the functions exist before overriding it, because
      // those functions have been introduced in later versions of Firefox than openLink().

      if (gContextMenu.openLinkInPrivateWindow) {
        gContextMenu.openLinkInPrivateWindow = function() {
          RequestProcessor.registerLinkClicked(this.target.ownerDocument.URL, this.linkURL);
          return this.__proto__.openLinkInPrivateWindow.call(this);
        };
      }

      if (gContextMenu.openLinkInCurrent) {
        gContextMenu.openLinkInCurrent = function() {
          RequestProcessor.registerLinkClicked(this.target.ownerDocument.URL, this.linkURL);
          return this.__proto__.openLinkInCurrent.call(this);
        };
      }
    }
  };

  /**
   * Modifies the addTab() function so that RequestPolicy can be aware of the
   * tab being opened. Assume that if the tab is being opened, it was an action
   * the user wanted (e.g. the equivalent of a link click). Using a TabOpen
   * event handler, I was unable to determine the referrer, so that approach
   * doesn't seem to be an option. This doesn't actually wrap addTab because the
   * extension TabMixPlus modifies the function rather than wraps it, so
   * wrapping it will break tabs if TabMixPlus is installed.
   */
  self._wrapAddTab = function() {
    if (!gBrowser.requestpolicyAddTabModified) {
      gBrowser.requestpolicyAddTabModified = true;

      // For reference, the addTab() function signature looks like this:
      // function addTab(aURI, aReferrerURI, aCharset, aPostData, aOwner,
      // aAllowThirdPartyFixup) {";
      // where it's possible that only two arguments are used and aReferrerURI
      // is a hash of the other arguments as well as new ones.
      // See https://github.com/RequestPolicyContinued/requestpolicy/issues/38

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
      eval("gBrowser.addTab = " + addTabParts[0] + newFirstCodeLine +
           addTabParts[1]);
    }
  };



  self._unwrapAddTab = function() {
    if (gBrowser.requestpolicyAddTabModified === true) {
      // get the addTab() function as a string
      let addTabString = gBrowser.addTab.toString();

      // define the regular expression that should find the existing code
      // line that RequestPolicy added.
      let codeLineRE = /(\n    )?requestpolicy\.overlay\.tabAdded\(arguments\[0\], arguments\[1\]\);/;

      // use the regular expression
      let newAddTabString = addTabString.replace(codeLineRE, "");

      // apply the changes
      eval("gBrowser.addTab = " + newAddTabString);

      delete gBrowser.requestpolicyAddTabModified;
    }
  };

  /**
   * This is called by the modified addTab().
   *
   * @param {String}
   *          url
   * @param {nsIURI/hash}
   *          referrerURI
   */
  self.tabAdded = function(url, referrerURI) {
    // The second argument to addTab was changed to a hash.
    // See https://github.com/RequestPolicyContinued/requestpolicy/issues/38
    if (referrerURI && !(referrerURI instanceof Components.interfaces.nsIURI)) {
      if ("referrerURI" in referrerURI) {
        referrerURI = referrerURI.referrerURI;
      } else {
        referrerURI = null;
      }
    }
    if (referrerURI) {
      RequestProcessor.registerLinkClicked(referrerURI.spec, url);
    }
  };

  self._addLocationObserver = function() {
    self.locationListener = {
      onLocationChange : function(aProgress, aRequest, aURI) {
        // This gets called both for tab changes and for history navigation.
        // The timer is running on the main window, not the document's window,
        // so we want to stop the timer when the tab is changed.
        requestpolicy.overlay._stopBlockedContentCheckTimeout();
        requestpolicy.overlay
            ._updateBlockedContentState(gBrowser.selectedBrowser);
      },

      QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener",
                                             "nsISupportsWeakReference"])
    };

    // https://developer.mozilla.org/en/Code_snippets/Progress_Listeners
    gBrowser.addProgressListener(self.locationListener);
  };

  self._removeLocationObserver = function() {
    gBrowser.removeProgressListener(self.locationListener);
  };

  self._addHistoryObserver = function() {
    // Implements nsISHistoryListener (and nsISupportsWeakReference)
    self.historyListener = {
      OnHistoryGoBack : function(backURI) {
        RequestProcessor.registerHistoryRequest(backURI.asciiSpec);
        return true;
      },

      OnHistoryGoForward : function(forwardURI) {
        RequestProcessor.registerHistoryRequest(forwardURI.asciiSpec);
        return true;
      },

      OnHistoryGotoIndex : function(index, gotoURI) {
        RequestProcessor.registerHistoryRequest(gotoURI.asciiSpec);
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
        if (aIID.equals(Components.interfaces.nsISHistoryListener) ||
            aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
            aIID.equals(Components.interfaces.nsISupports)) {
          return this;
        }
        throw Components.results.NS_NOINTERFACE;
      },

      GetWeakReference : function() {
        return Components.classes["@mozilla.org/appshell/appShellService;1"]
            .createInstance(Components.interfaces.nsIWeakReference);
      }
    };

    // there seems to be a bug in Firefox ESR 24 -- the session history is
    // null. After waiting a few miliseconds it's available. To be sure this
    let tries = 0, waitTime = 20, maxTries = 10;
    let tryAddingSHistoryListener = function() {
      ++tries;
      try {
        let sHistory = gBrowser.webNavigation.sessionHistory;
        sHistory.addSHistoryListener(self.historyListener);
        return;
      } catch (e) {
        if (tries >= maxTries) {
          Logger.severeError("Can't add session history listener, even " +
              "after " + tries + " tries. "+e, e);
          return;
        }
        // call this function again in a few miliseconds.
        setTimeout(tryAddingSHistoryListener, waitTime);
      }
    };
    tryAddingSHistoryListener();
  };

  self._removeHistoryObserver = function() {
    var sHistory = gBrowser.webNavigation.sessionHistory;
    try {
      sHistory.removeSHistoryListener(self.historyListener);
    } catch (e) {
      // When closing the last window in a session where additional windows
      // have been opened and closed, this will sometimes fail (bug #175).
    }
  };

  /**
   * Called before the popup menu is shown.
   *
   * @param {Event}
   *          event
   */
  self.onPopupShowing = function(event) {
  //    if (event.currentTarget != event.originalTarget) {
  //      return;
  //    }
    requestpolicy.menu.prepareMenu();
  };

  /**
   * Called after the popup menu has been hidden.
   *
   * @param {Event}
   *          event
   */
  self.onPopupHidden = function(event) {
    var rulesChanged = requestpolicy.menu.processQueuedRuleChanges();
    if (rulesChanged || self._needsReloadOnMenuClose) {
      if (rpPrefBranch.getBoolPref("autoReload")) {
        let mm = gBrowser.selectedBrowser.messageManager;
        mm.sendAsyncMessage(C.MM_PREFIX + "reload");
      }
    }
    self._needsReloadOnMenuClose = false;
  //    if (event.currentTarget != event.originalTarget) {
  //      return;
  //    }
    // Leave the popup attached to the context menu, as we consider that the
    // default location for it.
    //self._attachPopupToContextMenu();
  };

  /**
   * Determines the top-level document's uri identifier based on the current
   * identifier level setting.
   *
   * @return {String} The current document's identifier.
   */
  self.getTopLevelDocumentUriIdentifier = function() {
    return DomainUtil.getIdentifier(self.getTopLevelDocumentUri());
  };

  /**
   * Get the top-level document's uri.
   */
  self.getTopLevelDocumentUri = function() {
    let uri = gBrowser.selectedBrowser.currentURI.spec;
    return RequestProcessor.getTopLevelDocTranslation(uri) ||
        DomainUtil.stripFragment(uri);
  };

  /**
   * Toggles disabling of all blocking for the current session.
   *
   * @param {Event}
   *          event
   */
  self.toggleTemporarilyAllowAll = function(event) {
    var disabled = !Prefs.isBlockingDisabled();
    Prefs.setBlockingDisabled(disabled);

    // Change the link displayed in the menu.
    $id("rpc-link-enable-blocking").hidden = !disabled;
    $id("rpc-link-disable-blocking").hidden = disabled;
  };

  /**
   * Allows requests from the specified origin to any destination for the
   * duration of the browser session.
   */
  self.temporarilyAllowOrigin = function(originHost) {
    PolicyManager.temporarilyAllowOrigin(originHost);
  };

  /**
   * Allows the current document's origin to request from any destination for
   * the duration of the browser session.
   *
   * @param {Event}
   *          event
   */
  self.temporarilyAllowCurrentOrigin = function(event) {
    // Note: the available variable "content" is different than the avaialable
    // "window.target".
    var host = self.getTopLevelDocumentUriIdentifier();
    PolicyManager.temporarilyAllowOrigin(host);
  };

  /**
   * Allows a destination to be requested from any origin for the duration of
   * the browser session.
   *
   * @param {String}
   *          destHost
   */
  self.temporarilyAllowDestination = function(destHost) {
    PolicyManager.temporarilyAllowDestination(destHost);
  };

  /**
   * Allows a destination to be requested from a single origin for the duration
   * of the browser session.
   *
   * @param {String}
   *          originHost
   * @param {String}
   *          destHost
   */
  self.temporarilyAllowOriginToDestination = function(originHost, destHost) {
    PolicyManager.temporarilyAllowOriginToDestination(originHost, destHost);
  };

  /**
   * Allows requests from an origin, including in future browser sessions.
   */
  self.allowOrigin = function(originHost) {
    PolicyManager.allowOrigin(originHost);
  };

  /**
   * Allows the current document's origin to request from any destination,
   * including in future browser sessions.
   *
   * @param {Event}
   *          event
   */
  self.allowCurrentOrigin = function(event) {
    var host = self.getTopLevelDocumentUriIdentifier();
    PolicyManager.allowOrigin(host);
  };

  /**
   * Allows requests to a destination, including in future browser sessions.
   *
   * @param {String}
   *          destHost
   */
  self.allowDestination = function(destHost) {
    PolicyManager.allowDestination(destHost);
  };

  /**
   * Allows requests to a destination from a single origin, including in future
   * browser sessions.
   *
   * @param {String}
   *          originHost
   * @param {String}
   *          destHost
   */
  self.allowOriginToDestination = function(originHost, destHost) {
    PolicyManager.allowOriginToDestination(originHost, destHost);
  };

  /**
   * Revokes all temporary permissions granted during the current session.
   *
   * @param {Event}
   *          event
   */
  self.revokeTemporaryPermissions = function(event) {
    PolicyManager.revokeTemporaryRules();
    self._needsReloadOnMenuClose = true;
    popupElement.hidePopup();
  };

  self._openInNewTab = function(uri) {
    gBrowser.selectedTab = gBrowser.addTab(uri);
  };

  self.openMenuByHotkey = function() {
    // Ideally we'd put the popup in its normal place based on the rp toolbar
    // button but let's not count on that being visible. So, we'll be safe and
    // anchor it within the content element. However, there's no good way to
    // right-align a popup. So, we can either let it be left aligned or we can
    // figure out where we think the top-left corner should be. And that's what
    // we do.
    // The first time the width will be 0. The default value is determined by
    // logging it or you can probably figure it out from the CSS which doesn't
    // directly specify the width of the entire popup.
    //Logger.dump('popup width: ' + popup.clientWidth);
    var popupWidth = popupElement.clientWidth ? 730 : popupElement.clientWidth;
    var anchor = $id("content");
    var contentWidth = anchor.clientWidth;
    // Take a few pixels off so it doesn't cover the browser chrome's border.
    var xOffset = contentWidth - popupWidth - 2;
    popupElement.openPopup(anchor, "overlap", xOffset);
  };

  //  showExtensionConflictInfo : function() {
  //    var ext = RequestProcessor.getConflictingExtensions();
  //    var extJson = JSON.stringify(ext);
  //    self._openInNewTab(self._extensionConflictInfoUri
  //        + encodeURIComponent(extJson));
  //  },

  //  showPrefetchInfo : function() {
  //    self._openInNewTab(self._prefetchInfoUri);
  //  },
  //
  //  showPrefetchDisablingInstructions : function() {
  //    self._openInNewTab(self._prefetchDisablingInstructionsUri);
  //  },

  self.openToolbarPopup = function(anchor) {
  //    requestpolicy.overlay._toolbox.insertBefore(requestpolicy.overlay.popupElement,
  //        null);
    popupElement.openPopup(anchor, "after_start", 0, 0, true, true);
  };

  function openLinkInNewTab(url, relatedToCurrent) {
    window.openUILinkIn(url, "tab", {relatedToCurrent: !!relatedToCurrent});
    popupElement.hidePopup();
  }

  self.openPrefs = openLinkInNewTab.bind(this, "about:requestpolicy", true);
  self.openPolicyManager = openLinkInNewTab.bind(this,
      "about:requestpolicy?yourpolicy", true);
  self.openHelp = openLinkInNewTab.bind(this,
      "https://github.com/RequestPolicyContinued/requestpolicy/wiki/Help-and-Support");


  self.clearRequestLog = function() {
    self.requestLog.clear();
  };

  self.toggleRequestLog = function() {
    var requestLog = $id("rpcontinued-requestLog");
    var requestLogSplitter = $id("rpcontinued-requestLog-splitter");
    var requestLogFrame = $id("rpcontinued-requestLog-frame");
    //var openRequestLog = $id("requestpolicyOpenRequestLog");

    // TODO: figure out how this should interact with the new menu.
    //var closeRequestLog = $id("requestpolicyCloseRequestLog");
    var closeRequestLog = {};

    if (requestLog.hidden) {
      requestLogFrame.setAttribute("src",
          "chrome://rpcontinued/content/ui/request-log.xul");
      requestLog.hidden = requestLogSplitter.hidden = closeRequestLog.hidden = false;
      //openRequestLog.hidden = true;
    } else {
      requestLogFrame.setAttribute("src", "about:blank");
      requestLog.hidden = requestLogSplitter.hidden = closeRequestLog.hidden = true;
      //openRequestLog.hidden = false;
      self.requestLog = null;
    }
  };

  return self;
}());
