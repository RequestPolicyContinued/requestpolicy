/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2009 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
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

import {Environment, MainEnvironment} from "content/lib/environment";
import {ManagerForMessageListeners}
    from "content/lib/manager-for-message-listeners";
import {Log} from "content/models/log";
import {ManagerForPrefObservers} from "content/lib/manager-for-pref-observer";
import {Storage} from "content/models/storage";
import {RequestProcessor} from "content/lib/request-processor";
import {PolicyManager} from "content/lib/policy-manager";
import {DomainUtil} from "content/lib/utils/domains";
import {StringUtils} from "content/lib/utils/strings";
import {WindowUtils} from "content/lib/utils/windows";
import {JSUtils} from "content/lib/utils/javascript";
import {Utils} from "content/lib/utils";
import {DOMUtils} from "content/lib/utils/dom";
import {C} from "content/lib/utils/constants";
import {CompatibilityRules} from "content/models/compatibility-rules";

const {LOG_FLAG_STATE} = C;

/**
 * Provides functionality for the overlay. An instance of this class exists for
 * each tab/window.
 *
 * @param {Window} window
 */
export function loadOverlayIntoWindow(window) {
  let {document, rpcontinued} = window;

  // ===========================================================================

  let gBrowser = WindowUtils.getTabBrowser(window);

  let $id = document.getElementById.bind(document);

  // create an environment for this overlay.
  let OverlayEnvironment = new Environment(MainEnvironment, "OverlayEnv");
  // manage this overlay's message listeners:
  let mlManager = new ManagerForMessageListeners(OverlayEnvironment,
                                                 window.messageManager);

  function setTimeout(aFn, aDelay) {
    return window.setTimeout(function() {
      if (OverlayEnvironment.isShuttingDownOrShutDown()) {
        // eslint-disable-next-line no-console
        console.log("[RequestPolicy] Not calling delayed function " +
            "because of add-on shutdown.");
        return;
      }
      aFn.call(null);
    }, aDelay);
  }

  let initialized = false;

  let toolbarButtonId = "rpcontinuedToolbarButton";

  let overlayId = 0;

  let blockedContentStateUpdateDelay = 250; // milliseconds
  let blockedContentCheckTimeoutId = null;
  // let blockedContentCheckLastTime = 0;

  let popupElement = null;

  // let statusbar = null;
  // let toolbox = null;

  let isFennec = false;

  let self = {
    // This is set by the request log when it is initialized.
    // We don't need to worry about setting it here.
    requestLog: null,
    OverlayEnvironment: OverlayEnvironment,
  };

  self.toString = function() {
    return "[rpcontinued.overlay " + overlayId + "]";
  };

  /**
   * Initialize the object. This must be done after the DOM is loaded.
   */
  self.init = function() {
    try {
      if (initialized === false) {
        initialized = true;
        overlayId = (new Date()).getTime();

        rpcontinued.menu.init();

        popupElement = $id("rpc-popup");

        // statusbar = $id("status-bar");
        // toolbox = $id("navigator-toolbox");

        const appInfo = Cc["@mozilla.org/xre/app-info;1"].
            getService(Ci.nsIXULAppInfo);
        isFennec = appInfo.name === "Fennec";

        browser.runtime.getBrowserInfo().then((appInfo) => {
          if (appInfo.name === "Fennec") {
            Log.log("Detected Fennec.");
            // Set an attribute for CSS usage.
            popupElement.setAttribute("fennec", "true");
            popupElement.setAttribute("position", "after_end");
          }
          return;
        }).catch(e => {
          console.error("Error on Fennec detection. Details:");
          console.dir(e);
        });

        // Register this window with the requestpolicy service so that we can be
        // notified of blocked requests. When blocked requests happen, this
        // object's observerBlockedRequests() method will be called.
        RequestProcessor.addRequestObserver(self);

        setContextMenuEntryEnabled(Storage.get("contextMenu"));

        OverlayEnvironment.shutdownOnUnload(window);
        OverlayEnvironment.startup();

        // Tell the framescripts that the overlay is ready. The
        // listener must be added immediately.
        mlManager.addListener("isOverlayReady", function() {
          return true;
        }, function() {
          return false;
        });
        window.messageManager.broadcastAsyncMessage(C.MM_PREFIX +
                                                    "overlayIsReady", true);
      }
    } catch (e) {
      console.error(
          "[FATAL] Unable to initialize rpcontinued.overlay. Details:");
      console.dir(e);
      // eslint-disable-next-line no-throw-literal
      throw e;
    }
  };

  function setContextMenuEntryEnabled(isEnabled) {
    let contextMenuEntry = $id("rpcontinuedContextMenuEntry");
    contextMenuEntry.setAttribute("hidden", !isEnabled);
  }

  OverlayEnvironment.addShutdownFunction(
      Environment.LEVELS.INTERFACE,
      function() {
        RequestProcessor.removeRequestObserver(self);
        unwrapAddTab();
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
    const appcontent = $id("appcontent"); // browser
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
    const contextMenu = $id("contentAreaContextMenu");
    if (contextMenu) {
      OverlayEnvironment.elManager.addListener(contextMenu, "popupshowing",
                                               self._contextMenuOnPopupShowing,
                                               false);
    }
  }
  OverlayEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        addContextMenuListener);

  function addTabContainerTabSelectListener() {
    // Listen for the user changing tab so we can update any notification or
    // indication of blocked requests.
    if (!isFennec) {
      const container = gBrowser.tabContainer;

      let tabSelectCallback = function(event) {
        self.tabChanged();
      };

      OverlayEnvironment.elManager.addListener(container, "TabSelect",
                                               tabSelectCallback, false);

      wrapAddTab();
      self._addLocationObserver();
      self._addHistoryObserver();
    }
  }
  OverlayEnvironment.addStartupFunction(Environment.LEVELS.INTERFACE,
                                        addTabContainerTabSelectListener);

  mlManager.addListener("notifyTopLevelDocumentLoaded", function(message) {
    // Clear any notifications that may have been present.
    self._setContentBlockedState(false);
    // We don't do this immediately anymore because slow systems might have
    // this slow down the loading of the page, which is noticable
    // especially with CSS loading delays (it's not unlikely that slow
    // webservers have a hand in this, too).
    // Note that the change to _updateBlockedContentStateAfterTimeout seems to
    // have added a bug where opening a blank tab and then quickly switching
    // back to the original tab can cause the original tab's blocked content
    // notification to be cleared. A simple compensation was to decrease
    // the timeout from 1000ms to 250ms, making it much less likely the tab
    // switch can be done in time for a blank opened tab. This isn't a real
    // solution, though.
    self._updateBlockedContentStateAfterTimeout();
  });

  mlManager.addListener("notifyDOMFrameContentLoaded", function(message) {
    // This has an advantage over just relying on the
    // observeBlockedRequest() call in that this will clear a blocked
    // content notification if there no longer blocked content. Another way
    // to solve this would be to observe allowed requests as well as blocked
    // requests.
    // blockedContentCheckLastTime = (new Date()).getTime();
    self._stopBlockedContentCheckTimeout();
    self._updateBlockedContentState(message.target);
  });

  mlManager.addListener("handleMetaRefreshes", function(message) {
    self.handleMetaRefreshes(message);
  });

  mlManager.addListener("notifyLinkClicked", function(message) {
    RequestProcessor.registerLinkClicked(message.data.origin,
                                         message.data.dest);
  });

  mlManager.addListener("notifyFormSubmitted", function(message) {
    RequestProcessor.registerFormSubmitted(message.data.origin,
                                           message.data.dest);
  });

  self.handleMetaRefreshes = function(message) {
    Log.log("Handling meta refreshes...");

    let {documentURI, metaRefreshes} = message.data;
    let browser = message.target;

    for (let i = 0, len = metaRefreshes.length; i < len; ++i) {
      let {delay, destURI, originalDestURI} = metaRefreshes[i];

      Log.log("meta refresh to <" +
          destURI + "> (" + delay + " second delay) found in document at <" +
          documentURI + ">");

      if (originalDestURI) {
        Log.log(
            "meta refresh destination <" + originalDestURI + "> " +
            "appeared to be relative to <" + documentURI + ">, so " +
            "it has been resolved to <" + destURI + ">");
      }

      // We don't automatically perform any allowed redirects. Instead, we
      // just detect when they will be blocked and show a notification. If
      // the docShell has allowMetaRedirects disabled, it will be respected.
      if (!Storage.isBlockingDisabled() &&
          !RequestProcessor.isAllowedRedirect(documentURI, destURI)) {
        // Ignore redirects to javascript. The browser will ignore them
        // as well.
        if (DomainUtil.getUriObject(destURI).schemeIs("javascript")) {
          Log.warn(
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
   * @return {String} the URI, possibly cropped
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
   * @param {Browser} browser
   * @param {string} redirectTargetUri
   * @param {number} delay
   * @param {string=} redirectOriginUri
   * @return {boolean} whether showing the notification succeeded
   */
  // TODO, bad smell: Instead of the <browser> etc. hand over a `Request`
  //                  object that contains everything. This requires
  //                  e.g. a `MetaRedirectRequest` class.
  self._showRedirectNotification = function(browser, redirectTargetUri, delay,
      redirectOriginUri, replaceIfPossible) {
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
      Log.warning(
          "Should have shown redirect notification to <" + redirectTargetUri +
          ">, but it's not implemented yet on Fennec.");
      return false;
    }

    const notificationBox = gBrowser.getNotificationBox(browser);
    const notificationValue = "request-policy-meta-redirect";

    // prepare the notification's label
    let notificationLabel;
    if (isOriginUndefined) {
      notificationLabel = StringUtils.$str("redirectNotification",
          [cropUri(redirectTargetUri, 50)]);
    } else {
      notificationLabel = StringUtils.$str("redirectNotificationWithOrigin",
          [cropUri(redirectOriginUri, 50), cropUri(redirectTargetUri, 50)]);
    }

    const addRuleMenuName = "rpcontinuedRedirectAddRuleMenu";
    const addRulePopup = $id(addRuleMenuName);
    const {classicmenu} = rpcontinued;
    classicmenu.emptyMenu(addRulePopup);

    let m = rpcontinued.menu;
    const originBaseDomain = DomainUtil.getBaseDomain(redirectOriginUri);
    const destBaseDomain = DomainUtil.getBaseDomain(redirectTargetUri);

    let origin = null;
    let dest = null;
    if (originBaseDomain !== null) {
      origin = m._addWildcard(originBaseDomain);
    }
    if (destBaseDomain !== null) {
      dest = m._addWildcard(destBaseDomain);
    }

    let mayPermRulesBeAdded = WindowUtils.mayPermanentRulesBeAdded(window);

    const allowRedirection = function() {
      // Fx 3.7a5+ calls shouldLoad for location.href changes.

      // TODO: currently the allow button ignores any additional
      //       HTTP response headers [1]. Maybe there is a way to take
      //       those headers into account (e.g. `Set-Cookie`?), or maybe
      //       this is not necessary at all.
      // [1] https://en.wikipedia.org/wiki/List_of_HTTP_header_fields#Response_fields

      RequestProcessor.registerAllowedRedirect(redirectOriginUri,
                                               redirectTargetUri);

      let data = {
        uri: redirectTargetUri,
      };
      if (replaceIfPossible) {
        data.replaceUri = redirectOriginUri;
      }
      browser.messageManager.sendAsyncMessage(C.MM_PREFIX + "setLocation",
          data);
    };

    function addMenuItem(aRuleSpec) {
      aRuleSpec.allow = true;
      classicmenu.addMenuItem(addRulePopup, aRuleSpec, () => {
        if (Storage.get("autoReload")) {
          allowRedirection();
        }
      });
    }
    function addMenuSeparator() {
      classicmenu.addMenuSeparator(addRulePopup);
    }

    {
      // allow ALL
      let label = StringUtils.$str("allowAllRedirections");
      classicmenu.addCustomMenuItem(addRulePopup, label, () => {
        maybeOpenLinkInNewTab(
            browser.runtime.getURL("content/settings/defaultpolicy.html"),
            [], true);
      });
      addMenuSeparator();
    }

    if (destBaseDomain !== null) {
      addMenuItem({dest});
      if (mayPermRulesBeAdded) {
        addMenuItem({dest});
      }
    }

    if (originBaseDomain !== null && destBaseDomain !== null) {
      addMenuSeparator();
    }

    if (originBaseDomain !== null) {
      addMenuItem({origin, temp: true});
      if (mayPermRulesBeAdded) {
        addMenuItem({origin});
      }
    }

    if (originBaseDomain !== null && destBaseDomain !== null) {
      addMenuSeparator();

      addMenuItem({origin, dest, temp: true});
      if (mayPermRulesBeAdded) {
        addMenuItem({origin, dest});
      }
    }

    const notification = notificationBox
        .getNotificationWithValue(notificationValue);
    if (notification) {
      notification.label = notificationLabel;
    } else {
      const buttons = [
        {
          label: StringUtils.$str("allow"),
          accessKey: StringUtils.$str("allow.accesskey"),
          popup: null,
          callback: allowRedirection,
        },
        {
          label: StringUtils.$str("deny"),
          accessKey: StringUtils.$str("deny.accesskey"),
          popup: null,
          callback: function() {
            // Do nothing. The notification closes when this is called.
          },
        },
        {
          label: StringUtils.$str("addRule"),
          accessKey: StringUtils.$str("addRule.accesskey"),
          popup: addRuleMenuName,
          callback: null,
        },
        // TODO: add a "read more about URL redirection" button, targetting to
        //       https://en.wikipedia.org/wiki/URL_redirection
      ];
      const priority = notificationBox.PRIORITY_WARNING_MEDIUM;

      let notificationElem = notificationBox.appendNotification(
          notificationLabel, notificationValue,
          "chrome://rpcontinued/skin/requestpolicy-icon-blocked.png",
          priority, buttons);

      // Let the notification persist at least 300ms. This is needed in the
      // following scenario:
      //     If an URL is entered on an empty tab (e.g. "about:blank"),
      //     and that URL redirects to another URL with a different
      //     host, and that redirect is blocked by RequestPolicy,
      //     then immediately after blocking the redirect Firefox will make
      //     a location change, maybe back from the blocked URL to
      //     "about:blank". In any case, when the location changes, the
      //     function `notificationbox.removeTransientNotifications()`
      //     is called. It checks for the `persistence` and `timeout`
      //     properties. See MDN documentation:
      //     https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/notification
      // See also issue #722.
      notificationElem.timeout = Date.now() + 300;
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

  /**
   * Checks if the document has blocked content and shows appropriate
   * notifications.
   */
  self._updateBlockedContentState = function() {
    RequestProcessor.whenReady.then(() => {
      let browser = gBrowser.selectedBrowser;
      let uri = DomainUtil.stripFragment(browser.currentURI.spec);
      if (LOG_FLAG_STATE) {
        Log.log(
            "Checking for blocked requests from page <" + uri + ">");
      }

      // TODO: this needs to be rewritten. checking if there is blocked
      // content could be done much more efficiently.
      let documentContainsBlockedContent = RequestProcessor
          .getAllRequestsInBrowser(browser).containsBlockedRequests();
      self._setContentBlockedState(documentContainsBlockedContent);

      if (LOG_FLAG_STATE) {
        let logText = documentContainsBlockedContent ?
                      "Requests have been blocked." :
                      "No requests have been blocked.";
        Log.log(logText);
      }

      return Promise.resolve();
    }).catch(e => {
      console.error("[SEVERE] " +
          "Unable to complete _updateBlockedContentState actions. Details:");
      console.dir(e);
    });
  };

  /**
   * Sets the blocked content notifications visible to the user.
   *
   * @param {boolean} isContentBlocked
   */
  self._setContentBlockedState = function(isContentBlocked) {
    const button = $id(toolbarButtonId);
    let contextMenuEntry = $id("rpcontinuedContextMenuEntry");
    if (button) {
      button.setAttribute("rpcontinuedBlocked", isContentBlocked);
      contextMenuEntry.setAttribute("rpcontinuedBlocked", isContentBlocked);
    }
  };

  /**
   * Update RP's "permissive" status, which is to true or false.
   */
  function updatePermissiveStatus() {
    const button = $id(toolbarButtonId);
    let contextMenuEntry = $id("rpcontinuedContextMenuEntry");
    if (button) {
      let isPermissive = Storage.isBlockingDisabled();
      button.setAttribute("rpcontinuedPermissive", isPermissive);
      contextMenuEntry.setAttribute("rpcontinuedPermissive", isPermissive);
    }
  }
  /**
   * register a pref observer
   */
  function updatePermissiveStatusOnPrefChanges() {
    ManagerForPrefObservers.get(OverlayEnvironment).
        addListener("startWithAllowAllEnabled", updatePermissiveStatus);
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
   * @param {string} originUri
   * @param {string} destUri
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
   * @param {string} originUri
   * @param {string} destUri
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
   *
   * @param {browser} browser
   * @param {string} originUri
   * @param {string} destUri
   */
  self.observeBlockedTopLevelDocRequest = function(browser, originUri,
                                                   destUri) {
    // This function is called during shouldLoad() so set a timeout to
    // avoid blocking shouldLoad.
    setTimeout(function() {
      rpcontinued.overlay._showRedirectNotification(browser, destUri, 0,
          originUri);
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
    blockedContentCheckTimeoutId = setTimeout(function() {
      try {
        rpcontinued.overlay._updateBlockedContentState(browser);
      } catch (e) {
        // It's possible that the add-on has been disabled
        // in the meantime.
      }
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
    rpcontinued.overlay._wrapOpenLink();
  };

  /**
   * @this {nsContextMenu}
   */
  function onOpenLinkViaContextMenu() {
    let origin = window.gContextMenuContentData ?
        window.gContextMenuContentData.docLocation :
        this.target.ownerDocument.URL;
    let dest = this.linkURL;
    RequestProcessor.registerLinkClicked(origin, dest);
  }

  function wrapFunctionErrorCallback(aMessage, aError) {
    console.error(aMessage);
    console.dir(aError);
  }

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
   * The openLinkInTab() method doesn't need to be wrapped because new tabs
   * are already recognized by tabAdded(), which is wrapped elsewhere.
   * The tabAdded() function ends up being called when openLinkInTab()
   * is called.
   *
   * TODO: There are even more similar methods in gContextMenu (frame-specific),
   *       and perhaps the number will increase in future. Frame-specific
   *       contextMenu entries are working, but are registered e.g. as
   *       "new window opened" by the subsequent shouldLoad() call.
   */
  self._wrapOpenLink = function() {
    Utils.wrapFunction(
        window.gContextMenu, "openLink", wrapFunctionErrorCallback,
        onOpenLinkViaContextMenu);
    Utils.wrapFunction(
        window.gContextMenu, "openLinkInPrivateWindow",
        wrapFunctionErrorCallback, onOpenLinkViaContextMenu);
    Utils.wrapFunction(
        window.gContextMenu, "openLinkInCurrent", wrapFunctionErrorCallback,
        onOpenLinkViaContextMenu);
  };

  /**
   * Wraps the addTab() function so that RequestPolicy can be aware of the
   * tab being opened. Assume that if the tab is being opened, it was an action
   * the user wanted (e.g. the equivalent of a link click). Using a TabOpen
   * event handler, I (Justin) was unable to determine the referrer,
   * so that approach doesn't seem to be an option.
   *
   * TODO: Give examples when the wrap is necessary.
   *
   * Details on addTab():
   * - https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/tabbrowser#m-addTab
   * - See mozilla-central: "base/content/tabbrowser.xml"
   */
  function wrapAddTab() {
    Utils.wrapFunction(gBrowser, "addTab", wrapFunctionErrorCallback, tabAdded);
  }

  /**
   * Unwrap the addTab() function.
   */
  function unwrapAddTab() {
    Utils.unwrapFunction(gBrowser, "addTab");
  }

  /**
   * This is called by the modified addTab().
   *
   * @param {string} aURI
   * @param {(nsIURI|{referrerURI: nsIURI})} aReferrerURI The referrer or an
   *     object containing the referrer.
   */
  function tabAdded(aURI, aReferrerURI) {
    let referrerURI = aReferrerURI;

    // The second argument can be an object of parameters.
    if (typeof aReferrerURI === "object" &&
        !(referrerURI instanceof Ci.nsIURI)) {
      referrerURI = aReferrerURI.referrerURI;
    }

    if (referrerURI) {
      RequestProcessor.registerLinkClicked(referrerURI.spec, aURI);
    }
  }

  self._addLocationObserver = function() {
    self.locationListener = {
      onLocationChange: function(aProgress, aRequest, aURI) {
        // This gets called both for tab changes and for history navigation.
        // The timer is running on the main window, not the document's window,
        // so we want to stop the timer when the tab is changed.
        rpcontinued.overlay._stopBlockedContentCheckTimeout();
        rpcontinued.overlay
            ._updateBlockedContentState(gBrowser.selectedBrowser);
      },

      QueryInterface: XPCOMUtils.generateQI(["nsIWebProgressListener",
                                             "nsISupportsWeakReference"]),
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
      OnHistoryGoBack: function(backURI) {
        RequestProcessor.registerHistoryRequest(backURI.asciiSpec);
        return true;
      },

      OnHistoryGoForward: function(forwardURI) {
        RequestProcessor.registerHistoryRequest(forwardURI.asciiSpec);
        return true;
      },

      OnHistoryGotoIndex: function(index, gotoURI) {
        RequestProcessor.registerHistoryRequest(gotoURI.asciiSpec);
        return true;
      },

      OnHistoryNewEntry: function(newURI) {
      },

      OnHistoryPurge: function(numEntries) {
        return true;
      },

      OnHistoryReload: function(reloadURI, reloadFlags) {
        return true;
      },

      QueryInterface: function(aIID, aResult) {
        if (aIID.equals(Ci.nsISHistoryListener) ||
            aIID.equals(Ci.nsISupportsWeakReference) ||
            aIID.equals(Ci.nsISupports)) {
          return this;
        }
        // eslint-disable-next-line no-throw-literal
        throw Cr.NS_NOINTERFACE;
      },

      GetWeakReference: function() {
        return Cc["@mozilla.org/appshell/appShellService;1"]
            .createInstance(Ci.nsIWeakReference);
      },
    };

    // there seems to be a bug in Firefox ESR 24 -- the session history is
    // null. After waiting a few miliseconds it's available. To be sure this
    let tries = 0;
    let waitTime = 20;
    let maxTries = 10;
    let tryAddingSHistoryListener = function() {
      ++tries;
      try {
        // FIXME: [e10s] The DocShell (and webNavigation) lives in the
        //               content process.
        let sHistory = gBrowser.webNavigation.sessionHistory;
        sHistory.addSHistoryListener(self.historyListener);
        return;
      } catch (e) {
        if (tries >= maxTries) {
          console.error("[SEVERE] Can't add session history listener, even " +
              "after " + tries + " tries. Details:");
          console.dir(e);
          return;
        }
        // call this function again in a few miliseconds.
        setTimeout(function() {
          // Prevent the `setTimeout` warning of the AMO Validator.
          tryAddingSHistoryListener();
        }, waitTime);
      }
    };
    tryAddingSHistoryListener();
  };

  self._removeHistoryObserver = function() {
    const sHistory = gBrowser.webNavigation.sessionHistory;
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
   * @param {Event} event
   */
  self.onPopupShowing = function(event) {
    // if (event.currentTarget != event.originalTarget) {
    //   return;
    // }
    rpcontinued.menu.prepareMenu();
  };

  /**
   * Called after the popup menu has been hidden.
   *
   * @param {Event} event
   */
  self.onPopupHidden = function(event) {
    const rulesChanged = rpcontinued.menu.processQueuedRuleChanges();
    if (rulesChanged || self._needsReloadOnMenuClose) {
      if (Storage.get("autoReload")) {
        let mm = gBrowser.selectedBrowser.messageManager;
        mm.sendAsyncMessage(C.MM_PREFIX + "reload");
      }
    }
    self._needsReloadOnMenuClose = false;
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
   *
   * @return {string}
   */
  self.getTopLevelDocumentUri = function() {
    let uri = gBrowser.selectedBrowser.currentURI.spec;
    return CompatibilityRules.getTopLevelDocTranslation(uri) ||
        DomainUtil.stripFragment(uri);
  };

  /**
   * Toggles disabling of all blocking for the current session.
   *
   * @param {Event} event
   */
  self.toggleTemporarilyAllowAll = function(event) {
    const disabled = !Storage.isBlockingDisabled();
    Storage.setBlockingDisabled(disabled);

    // Change the link displayed in the menu.
    $id("rpc-link-enable-blocking").hidden = !disabled;
    $id("rpc-link-disable-blocking").hidden = disabled;
  };

  /**
   * Revokes all temporary permissions granted during the current session.
   *
   * @param {Event} event
   */
  self.revokeTemporaryPermissions = function(event) {
    PolicyManager.revokeTemporaryRules();
    self._needsReloadOnMenuClose = true;
    popupElement.hidePopup();
  };

  /**
   * Open the menu at the browsing content.
   *
   * The menu is aligned to the top right.
   */
  self.openMenuAtContent = function() {
    // There's no good way to right-align a popup. So, we can either
    // let it be left aligned or we can figure out where we think the
    // top-left corner should be. And that's what we do.
    // The first time the width will be 0. The default value is determined by
    // logging it or you can probably figure it out from the CSS which doesn't
    // directly specify the width of the entire popup.
    // Log.log('popup width: ' + popup.clientWidth);
    const popupWidth = popupElement.clientWidth === 0 ? 730 :
        popupElement.clientWidth;
    const anchor = $id("content");
    const contentWidth = anchor.clientWidth;
    // Take a few pixels off so it doesn't cover the browser chrome's border.
    const xOffset = contentWidth - popupWidth - 2;
    popupElement.openPopup(anchor, "overlap", xOffset);
  };

  self.openMenuAtToolbarButton = function() {
    let anchor = $id("rpcontinuedToolbarButton");
    // rpcontinued.overlay._toolbox.insertBefore(
    //     rpcontinued.overlay.popupElement, null);
    popupElement.openPopup(anchor, "after_start", 0, 0, true, true);
  };

  /**
   * Open RequestPolicy's menu.
   *
   * If the toolbar button is visible, it will be placed there. Otherwise
   * it will be placed near the browsing content.
   */
  self.openMenu = function() {
    // `setTimeout` is needed in certain cases where the toolbar button
    // is actually hidden. For example, it can reside in the Australis
    // menu. By delaying "openMenu" the menu will be closed in the
    // meantime, and the toolbar button will be detected as invisible.
    setTimeout(function() {
      if (self.isToolbarButtonVisible()) {
        self.openMenuAtToolbarButton();
      } else {
        self.openMenuAtContent();
      }
    }, 0);
  };

  /**
   * Close RequestPolicy's menu.
   */
  self.closeMenu = function() {
    rpcontinued.menu.close();
  };

  self.toggleMenu = function() {
    if ($id("rpc-popup").state === "closed") {
      self.openMenu();
    } else {
      self.closeMenu();
    }
  };

  self.isToolbarButtonVisible = function() {
    return DOMUtils.isElementVisible($id("rpcontinuedToolbarButton"));
  };

  function openLinkInNewTab(url, relatedToCurrent) {
    window.openUILinkIn(url, "tab", {relatedToCurrent: !!relatedToCurrent});
    popupElement.hidePopup();
  }

  function maybeOpenLinkInNewTab(url, equivalentURLs, relatedToCurrent) {
    let possibleURLs = equivalentURLs.concat(url);
    let tabbrowser = window.gBrowser;

    let selectedTabIndex = tabbrowser.tabContainer.selectedIndex;
    let numTabs = tabbrowser.tabs.length;

    // Start iterating at the currently selected tab.
    let indexes = JSUtils.leftRotateArray(JSUtils.range(numTabs),
        selectedTabIndex);
    for (let index of indexes) {
      let currentBrowser = tabbrowser.getBrowserAtIndex(index);
      let currentURI = currentBrowser.currentURI.spec;
      if (JSUtils.arrayIncludes(possibleURLs, currentURI)) {
        // The URL is already opened. Select this tab.
        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];
        popupElement.hidePopup();
        return;
      }
    }

    openLinkInNewTab(url, relatedToCurrent);
  }

  self.openPrefs = maybeOpenLinkInNewTab.bind(null,
      browser.runtime.getURL("content/settings/basicprefs.html"),
      [], true);
  self.openPolicyManager = maybeOpenLinkInNewTab.bind(null,
      browser.runtime.getURL("content/settings/yourpolicy.html"), [], true);
  self.openHelp = maybeOpenLinkInNewTab.bind(null, "https://github.com/" +
      "RequestPolicyContinued/requestpolicy/wiki/Help-and-Support", []);

  self.clearRequestLog = function() {
    self.requestLog.clear();
  };

  self.toggleRequestLog = function() {
    const requestLog = $id("rpcontinued-requestLog");
    const requestLogSplitter = $id("rpcontinued-requestLog-splitter");
    const requestLogFrame = $id("rpcontinued-requestLog-frame");
    // var openRequestLog = $id("rpcontinuedOpenRequestLog");

    // TODO: figure out how this should interact with the new menu.
    // var closeRequestLog = $id("requestpolicyCloseRequestLog");
    const closeRequestLog = {};

    if (requestLog.hidden) {
      requestLogFrame.setAttribute("src",
          "chrome://rpcontinued/content/ui/request-log/request-log.xul");
      requestLog.hidden = false;
      requestLogSplitter.hidden = false;
      closeRequestLog.hidden = false;
      // openRequestLog.hidden = true;
    } else {
      requestLogFrame.setAttribute("src", "about:blank");
      requestLog.hidden = true;
      requestLogSplitter.hidden = true;
      closeRequestLog.hidden = true;
      // openRequestLog.hidden = false;
      self.requestLog = null;
    }
  };

  window.rpcontinued.overlay = self;
}
