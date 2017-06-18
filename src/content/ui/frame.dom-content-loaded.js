/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

/* exported ManagerForDOMContentLoaded */
/* global mm, overlayComm, framescriptEnv, ManagerForBlockedContent */

var ManagerForDOMContentLoaded = (function() {
  let self = {};

  /* global Components */
  const {interfaces: Ci, utils: Cu} = Components;

  let {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  let {Logger} = importModule("lib/logger");
  let {DomainUtil} = importModule("lib/utils/domains");
  let {Utils} = importModule("lib/utils");
  let {Environment} = importModule("lib/environment");
  let {C} = importModule("lib/utils/constants");

  let {content} = mm;

  //============================================================================

  function htmlAnchorTagClicked(event) {
    // Notify the main thread that a link has been clicked.
    // Note: The <a> element is `currentTarget`! See:
    // https://developer.mozilla.org/en-US/docs/Web/API/Event.currentTarget
    overlayComm.run(function() {
      mm.sendSyncMessage(C.MM_PREFIX + "notifyLinkClicked",
                         {origin: event.currentTarget.ownerDocument.URL,
                          dest: event.currentTarget.href});
    });
  }

  /**
   * Determines if documentToCheck is the main document loaded in the currently
   * active tab.
   *
   * @param {document} documentToCheck
   * @return {Boolean}
   */
  function isActiveTopLevelDocument(documentToCheck) {
    return documentToCheck === content.document;
  }

  /**
   * Things to do when a page has loaded (after images, etc., have been loaded).
   *
   * @param {Event} event
   */
  function onDOMContentLoaded(event) {
    // TODO: This is getting called multiple times for a page, should only be
    // called once.
    //    <--- the above comment is very old – is it (still) true that
    //         onDOMContentLoaded is called multiple times?
    var doc = event.originalTarget;
    if (doc.nodeName !== "#document") {
      // only documents
      return;
    }

    onDocumentLoaded(doc);

    overlayComm.run(function() {
      let answers = mm.sendSyncMessage(C.MM_PREFIX + "notifyDocumentLoaded",
                                       {documentURI: doc.documentURI});
      if (answers.length === 0) {
        Logger.warning(Logger.TYPE_ERROR, "There seems to be no message " +
                       "listener for \"notifyDocumentLoaded\".");
      } else {
        // take only one answer. If there are more answers, they are ignored
        // ==> there must be only one listener for 'notifyDocumentLoaded'
        let answer = answers[0];

        var blockedURIs = answer.blockedURIs;
        //console.debug("Received " +
        //              Object.getOwnPropertyNames(blockedURIs).length +
        //              " blocked URIs.");

        // Indicating blocked visible objects isn't an urgent task, so this should
        // be done async.
        Utils.runAsync(function() {
          ManagerForBlockedContent.indicateBlockedVisibleObjects(doc,
              blockedURIs);
        });
      }

      if (isActiveTopLevelDocument(doc)) {
        mm.sendAsyncMessage(C.MM_PREFIX + "notifyTopLevelDocumentLoaded");
      }
    });
  }

  /**
   * Things to do when a page or a frame within the page has loaded.
   *
   * @param {Event} event
   */
  function onDOMFrameContentLoaded(event) {
    // TODO: This only works for (i)frames that are direct children of the main
    // document, not (i)frames within those (i)frames.
    var iframe = event.target;
    // Flock's special home page is about:myworld. It has (i)frames in it
    // that have no contentDocument. It's probably related to the fact that
    // that is an xul page.
    if (iframe.contentDocument === undefined) {
      return;
    }

    // TODO: maybe this can check if the iframe's documentURI is in the other
    // origins of the current document, and that way not just be limited to
    // direct children of the main document. That would require building the
    // other origins every time an iframe is loaded. Maybe, then, this should
    // use a timeout like observerBlockedRequests does.
    if (isActiveTopLevelDocument(iframe.ownerDocument)) {
      overlayComm.run(function() {
        mm.sendAsyncMessage(C.MM_PREFIX + "notifyDOMFrameContentLoaded");
      });
    }
  }

  /**
   * Perform the actions required once the DOM is loaded. This may be being
   * called for more than just the page content DOM. It seems to work for now.
   *
   * @param {Document} doc
   */
  function onDocumentLoaded(doc) {
    // Create a new Environment for this Document and shut it down when
    // the document is unloaded.
    let DocEnv = new Environment(framescriptEnv, "DocEnv");
    DocEnv.shutdownOnUnload(doc.defaultView);
    // start up the Environment immediately, as it won't have any startup
    // functions.
    DocEnv.startup();

    let documentURI = doc.documentURI;

    let metaRefreshes = [];

    // Find all meta redirects.
    var metaTags = doc.getElementsByTagName("meta");
    for (var i = 0; i < metaTags.length; i++) {
      let metaTag = metaTags[i];
      if (!metaTag.httpEquiv || metaTag.httpEquiv.toLowerCase() !== "refresh") {
        continue;
      }

      let originalDestURI = null;

      // TODO: Register meta redirects so we can tell which blocked requests
      // were meta redirects in the statusbar menu.
      // TODO: move this logic to the requestpolicy service.

      // The dest may be empty if the origin is what should be refreshed. This
      // will be handled by DomainUtil.determineRedirectUri().
      let {delay, destURI} = DomainUtil.parseRefresh(metaTag.content);

      // If destURI isn't a valid uri, assume it's a relative uri.
      if (!DomainUtil.isValidUri(destURI)) {
        originalDestURI = destURI;
        destURI = doc.documentURIObject.resolve(destURI);
      }

      metaRefreshes.push({delay: delay, destURI: destURI,
                          originalDestURI: originalDestURI});
    }

    if (metaRefreshes.length > 0) {
      // meta refreshes have been found.

      Logger.info(Logger.TYPE_META_REFRESH,
                  "Number of meta refreshes found: " + metaRefreshes.length);

      var docShell = doc.defaultView
                             .QueryInterface(Ci.nsIInterfaceRequestor)
                             .getInterface(Ci.nsIWebNavigation)
                             .QueryInterface(Ci.nsIDocShell);
      if (!docShell.allowMetaRedirects) {
        Logger.warning(Logger.TYPE_META_REFRESH,
            "Another extension disabled docShell.allowMetaRedirects.");
      }

      overlayComm.run(function() {
        mm.sendAsyncMessage(C.MM_PREFIX + "handleMetaRefreshes",
            {documentURI: documentURI, metaRefreshes: metaRefreshes});
      });
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
    // TODO: is it possible to implement this differently?
    var anchorTags = doc.getElementsByTagName("a");
    for (let anchorTag of anchorTags) {
      anchorTag.addEventListener("click", htmlAnchorTagClicked, false);
    }
    DocEnv.addShutdownFunction(Environment.LEVELS.INTERFACE, function() {
      for (let anchorTag of anchorTags) {
        anchorTag.removeEventListener("click", htmlAnchorTagClicked, false);
      }
    });

    // TODO: Is it necessary to wrap the window's open() and
    //       openDialog() methods?

    //wrapWindowFunctions(doc.defaultView);
    //DocEnv.addShutdownFunction(Environment.LEVELS.INTERFACE, function() {
    //  unwrapWindowFunctions(doc.defaultView);
    //});
  }

  // If the following code will be used again, the Utils.wrapFunction()
  // and Utils.unwrapFunction() functions can be used instead.
  //
  ///**
  // * This function wraps an existing method of a window object.
  // * If that method is being called after being wrapped, first the custom
  // * function will be called and then the original function.
  // *
  // * @param {Window} aWindow
  // * @param {String} aFunctionName The name of the window's method.
  // * @param {Function} aNewFunction
  // */
  //function wrapWindowFunction(aWindow, aFunctionName, aNewFunction) {
  //  aWindow.rpOriginalFunctions = aWindow.rpOriginalFunctions || {};
  //  let originals = aWindow.rpOriginalFunctions;
  //
  //  if (!(aFunctionName in originals)) {
  //    originals[aFunctionName] = aWindow[aFunctionName];
  //    aWindow[aFunctionName] = function() {
  //      aNewFunction.apply(aWindow, arguments);
  //      return originals[aFunctionName].apply(aWindow, arguments);
  //    }
  //  }
  //}
  //function unwrapWindowFunction(aWindow, aFunctionName) {
  //  if (typeof aWindow.rpOriginalFunctions !== 'object') {
  //    return;
  //  }
  //  let originals = aWindow.rpOriginalFunctions;
  //
  //  if (aFunctionName in originals) {
  //    aWindow[aFunctionName] =
  //        originals[aFunctionName];
  //    delete originals[aFunctionName];
  //  }
  //}
  //
  ///**
  // * Wraps the window's open() and openDialog() methods so that RequestPolicy
  // * can know the origin and destination URLs of the window being opened. Assume
  // * that if window.open() calls have made it this far, it's a window the user
  // * wanted open (e.g. they have allowed the popup). Unfortunately, this method
  // * (or our timing of doing self) doesn't seem to work for popups that are
  // * allowed popups (the user has allowed popups from the domain). So, the
  // * workaround was to also add the 'if(aContext.nodeName == "xul:browser" &&
  // * aContext.currentURI && aContext.currentURI.spec == "about:blank")' to
  // * shouldLoad().
  // *
  // * @param {Window} aWindow
  // */
  //function wrapWindowFunctions(aWindow) {
  //  wrapWindowFunction(aWindow, "open",
  //      function(url, windowName, windowFeatures) {
  //        overlayComm.run(function() {
  //          mm.sendSyncMessage(C.MM_PREFIX + "notifyLinkClicked",
  //                             {origin: aWindow.document.documentURI,
  //                              dest: url});
  //        });
  //      });
  //
  //  wrapWindowFunction(aWindow, "openDialog",
  //      function() {
  //        // openDialog(url, name, features, arg1, arg2, ...)
  //        overlayComm.run(function() {
  //          mm.sendSyncMessage(C.MM_PREFIX + "notifyLinkClicked",
  //                             {origin: aWindow.document.documentURI,
  //                              dest: arguments[0]});
  //        });
  //      });
  //}
  //function unwrapWindowFunctions(aWindow) {
  //  unwrapWindowFunction(aWindow, "open");
  //  unwrapWindowFunction(aWindow, "openDialog");
  //  delete aWindow.rpOriginalFunctions;
  //}

  framescriptEnv.elManager.addListener(mm, "DOMContentLoaded",
                                       onDOMContentLoaded, true);

  // DOMFrameContentLoaded is same DOMContentLoaded but also fires for
  // enclosed frames.
  framescriptEnv.elManager.addListener(mm, "DOMFrameContentLoaded",
                                       onDOMFrameContentLoaded, true);

  return self;
}());
