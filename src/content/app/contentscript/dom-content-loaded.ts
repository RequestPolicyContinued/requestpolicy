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

import { App } from "app/interfaces";
import { XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { C } from "data/constants";
import { BoundMethods } from "lib/classes/bound-methods";
import { EventListenerModule } from "lib/classes/event-listener-module";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import {parseRefresh} from "lib/utils/html-utils";

interface IDocumentInfo {
  anchorTags: Set<HTMLAnchorElement>;
  eventListeners: EventListenerModule;
  onDocumentUnload: () => void;
}

export class ManagerForDOMContentLoaded extends Module {
  private contentWindow = this.cfmm.content;

  private boundMethods = new BoundMethods(this);

  private eventListener = new EventListenerModule(
      this.moduleName,
      this.parentLog,
  );

  protected get subModules() {
    return {
      eventListener: this.eventListener,
    };
  }

  private documents: Map<Document, IDocumentInfo> = new Map();

  protected get dependencies() {
    return {
      bgCommunication: this.bgCommunication,
      blockedContent: this.blockedContent,
      uriServices: this.uriServices,
    };
  }

  constructor(
      parentLog: Common.ILog,
      protected readonly outerWindowID: number,
      private ci: XPCOM.nsXPCComponents_Interfaces,
      private cfmm: XPCOM.ContentFrameMessageManager,
      private bgCommunication: App.contentSide.ICommunicationToBackground,
      private blockedContent: App.contentSide.IManagerForBlockedContent,
      private uriServices: App.services.IUriService,
  ) {
    super(
        `AppContent[${outerWindowID}].contentSide.domContentLoaded`,
        parentLog,
    );
  }

  protected startupSelf() {
    this.eventListener.addListener(
        this.cfmm,
        "DOMContentLoaded",
        this.boundMethods.get(this.onDOMContentLoaded),
        true,
    );

    // DOMFrameContentLoaded is same DOMContentLoaded but also fires for
    // enclosed frames.
    this.eventListener.addListener(
        this.cfmm,
        "DOMFrameContentLoaded",
        this.boundMethods.get(this.onDOMFrameContentLoaded),
        true,
    );

    return MaybePromise.resolve(undefined);
  }

  private htmlAnchorTagClicked(event: any) {
    // Notify the main thread that a link has been clicked.
    // Note: The <a> element is `currentTarget`! See:
    // https://developer.mozilla.org/en-US/docs/Web/API/Event.currentTarget
    this.bgCommunication.run(() => {
      this.cfmm.sendSyncMessage(
          `${C.MM_PREFIX}notifyLinkClicked`,
          {
            dest: event.currentTarget.href,
            origin: event.currentTarget.ownerDocument.URL,
          },
      );
    });
  }

  /**
   * Determine if documentToCheck is the main document loaded in the currently
   * active tab.
   */
  private isActiveTopLevelDocument(documentToCheck: Document): boolean {
    return documentToCheck === this.contentWindow.document;
  }

  /**
   * Things to do when a page has loaded (after images, etc., have been loaded).
   */
  private onDOMContentLoaded(event: any) {
    // TODO: This is getting called multiple times for a page, should only be
    // called once.
    //    <--- the above comment is very old – is it (still) true that
    //         onDOMContentLoaded is called multiple times?
    const doc = event.originalTarget;
    if (doc.nodeName !== "#document") {
      // only documents
      return;
    }

    this.loadIntoDocument(doc);

    const pBlockedURIs = browser.runtime.sendMessage({
      documentURI: doc.documentURI,
      type: "notifyDocumentLoaded",
    }).then((aResponse) => {
      if (typeof aResponse !== "object" ||
          typeof aResponse.blockedURIs !== "object") {
        console.error("There seems to be no message " +
                      "listener for \"notifyDocumentLoaded\".");
        return null;
      }

      const {blockedURIs} = aResponse;
      // this.log.log("Received " +
      //              Object.getOwnPropertyNames(blockedURIs).length +
      //              " blocked URIs.");

      return blockedURIs;
    });

    pBlockedURIs.then((blockedURIs) => {
      if (blockedURIs !== null) {
        this.blockedContent.indicateBlockedVisibleObjects(
            doc,
            blockedURIs,
        );
      }
      return;
    }).catch((e) => {
      console.error(e);
    });

    pBlockedURIs.then((blockedURIs) => {
      if (blockedURIs !== null && this.isActiveTopLevelDocument(doc)) {
        this.cfmm.sendAsyncMessage(
            `${C.MM_PREFIX}notifyTopLevelDocumentLoaded`,
        );
      }
      return;
    }).catch((e) => {
      console.error(e);
    });
  }

  /**
   * Things to do when a page or a frame within the page has loaded.
   */
  private onDOMFrameContentLoaded(event: any) {
    // TODO: This only works for (i)frames that are direct children of the main
    // document, not (i)frames within those (i)frames.
    const iframe = event.target;
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
    if (this.isActiveTopLevelDocument(iframe.ownerDocument)) {
      this.bgCommunication.run(() => {
        this.cfmm.sendAsyncMessage(`${C.MM_PREFIX}notifyDOMFrameContentLoaded`);
      });
    }
  }

  /**
   * Perform the actions required once the DOM is loaded. This may be being
   * called for more than just the page content DOM. It seems to work for now.
   */
  private loadIntoDocument(doc: Document) {
    // Create a new environment for this Document and shut it down when
    // the document is unloaded.

    const eventListeners = new EventListenerModule("document", this.parentLog);

    const docInfo: IDocumentInfo = {
      anchorTags: new Set(),
      eventListeners,
      onDocumentUnload: this.unloadFromDocument.bind(this, doc),
    };
    eventListeners.startup().
        catch(this.log.onError("eventListeners.startup()"));
    eventListeners.addListener(
        doc.defaultView,
        "unload",
        docInfo.onDocumentUnload,
        false,
    );
    this.documents.set(doc, docInfo);

    const documentURI = (doc as any).documentURI as string;

    const metaRefreshes: IMetaRefresh[] = [];

    // Find all meta redirects.
    const metaTags = doc.getElementsByTagName("meta");
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < metaTags.length; i++) {
      const metaTag = metaTags[i];
      if (!metaTag.httpEquiv || metaTag.httpEquiv.toLowerCase() !== "refresh") {
        continue;
      }

      let originalDestURI = null;

      // TODO: Register meta redirects so we can tell which blocked requests
      // were meta redirects in the statusbar menu.
      // TODO: move this logic to the requestpolicy service.

      // The dest may be empty if the origin is what should be refreshed.
      // tslint:disable-next-line:prefer-const
      let {delay, destURI} = parseRefresh(metaTag.content);

      // If destURI isn't a valid uri, assume it's a relative uri.
      if (!this.uriServices.isValidUri(destURI)) {
        originalDestURI = destURI;
        destURI = ((doc as any).documentURIObject as XPCOM.nsIURI).
            resolve(destURI);
      }

      metaRefreshes.push({
        delay,
        destURI,
        originalDestURI,
      });
    }

    if (metaRefreshes.length > 0) {
      // meta refreshes have been found.

      this.log.info(`Number of meta refreshes found: ${metaRefreshes.length}`);

      const docShell = ((doc.defaultView as any) as XPCOM.nsIDOMWindow).
          QueryInterface<XPCOM.nsIInterfaceRequestor>(
              this.ci.nsIInterfaceRequestor,
          ).
          getInterface(this.ci.nsIWebNavigation).
          QueryInterface<XPCOM.nsIDocShell>(this.ci.nsIDocShell);
      if (!docShell.allowMetaRedirects) {
        this.log.warn(
            "Another extension disabled docShell.allowMetaRedirects.",
        );
      }

      this.bgCommunication.run(() => {
        this.cfmm.sendAsyncMessage(
            `${C.MM_PREFIX}handleMetaRefreshes`,
            {documentURI, metaRefreshes},
        );
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
    const anchorTags = Array.from(doc.getElementsByTagName("a"));
    for (const anchorTag of anchorTags) {
      eventListeners.addListener(
          anchorTag,
          "click",
          this.boundMethods.get(this.htmlAnchorTagClicked),
          false,
      );
      docInfo.anchorTags.add(anchorTag);
    }

    // TODO: Is it necessary to wrap the window's open() and
    //       openDialog() methods?

    // wrapWindowFunctions(doc.defaultView);
  }

  private unloadFromDocument(doc: Document) {
    const docInfo = this.documents.get(doc)!;

    docInfo.eventListeners.shutdown();

    this.documents.delete(doc);

    // unwrapWindowFunctions(doc.defaultView);
  }

  // If the following code will be used again, the Utils.wrapFunction()
  // and Utils.unwrapFunction() functions can be used instead.
  //
  /// **
  // * This function wraps an existing method of a window object.
  // * If that method is being called after being wrapped, first the custom
  // * function will be called and then the original function.
  // *
  // * @param {Window} aWindow
  // * @param {String} aFunctionName The name of the window's method.
  // * @param {Function} aNewFunction
  // */
  // public wrapWindowFunction(aWindow, aFunctionName, aNewFunction) {
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
  // }
  // public unwrapWindowFunction(aWindow, aFunctionName) {
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
  // }
  //
  /// **
  // * Wraps the window's open() and openDialog() methods so that RequestPolicy
  // * can know the origin and destination URLs of the window being opened.
  // * Assume
  // * that if window.open() calls have made it this far, it's a window the user
  // * wanted open (e.g. they have allowed the popup). Unfortunately,
  // * this method
  // * (or our timing of doing self) doesn't seem to work for popups that are
  // * allowed popups (the user has allowed popups from the domain). So, the
  // * workaround was to also add the 'if(aContext.nodeName == "xul:browser" &&
  // * aContext.currentURI && aContext.currentURI.spec == "about:blank")' to
  // * shouldLoad().
  // *
  // * @param {Window} aWindow
  // */
  // public wrapWindowFunctions(aWindow) {
  //  wrapWindowFunction(aWindow, "open",
  //      function(url, windowName, windowFeatures) {
  //        this.bgCommunication.run(function() {
  //          cfmm.sendSyncMessage(C.MM_PREFIX + "notifyLinkClicked",
  //                               {origin: aWindow.document.documentURI,
  //                                dest: url});
  //        });
  //      });
  //
  //  wrapWindowFunction(aWindow, "openDialog",
  //      function() {
  //        // openDialog(url, name, features, arg1, arg2, ...)
  //        this.bgCommunication.run(function() {
  //          cfmm.sendSyncMessage(C.MM_PREFIX + "notifyLinkClicked",
  //                               {origin: aWindow.document.documentURI,
  //                                dest: arguments[0]});
  //        });
  //      });
  // }
  // public unwrapWindowFunctions(aWindow) {
  //  unwrapWindowFunction(aWindow, "open");
  //  unwrapWindowFunction(aWindow, "openDialog");
  //  delete aWindow.rpOriginalFunctions;
  // }
}
