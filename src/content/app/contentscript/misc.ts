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
import { EventListenerModule } from "lib/classes/event-listener-module";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

export class ContentscriptMisc extends Module {
  private readonly contentWindow = this.cfmm.content;

  private eventListener = new EventListenerModule(
      this.moduleName, this.parentLog,
  );
  private eventListenerCallbacks = {
    mouseClicked: this.mouseClicked.bind(this),
  };
  private msgListenerCallbacks = {
    reloadDocument: this.reloadDocument.bind(this),
  };

  protected get subModules() {
    return {
      eventListener: this.eventListener,
    };
  }

  protected get startupPreconditions() {
    return [
      this.bgCommunication.whenReady,
      this.msgListener.whenReady,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      protected readonly outerWindowID: number,
      private readonly cfmm: XPCOM.nsIContentFrameMessageManager,
      private readonly bgCommunication:
          App.contentSide.ICommunicationToBackground,
      private readonly msgListener: App.contentSide.IMessageListenerModule,
  ) {
    super(`AppContent[${outerWindowID}].contentSide.misc`, parentLog);
  }

  public reloadDocument() {
    this.contentWindow.document.location.reload(false);
  }

  public setLocation(aUri: string, aReplace: boolean) {
    if (aReplace) {
      this.contentWindow.document.location.replace(aUri);
    } else {
      this.contentWindow.document.location.assign(aUri);
    }
  }

  // Listen for click events so that we can allow requests that result from
  // user-initiated link clicks and form submissions.
  public mouseClicked(event: any) {
    // If mozInputSource is undefined or zero, then this was a
    // javascript-generated event. If there is a way to forge mozInputSource
    // from javascript, then that could be used to bypass RequestPolicy.
    if (!event.mozInputSource) {
      return;
    }
    // The following show up as button value 0 for links and form input submit
    // buttons:
    // * left-clicks
    // * enter key while focused
    // * space bar while focused (no event sent for links in this case)
    if (event.button !== 0) {
      return;
    }
    // Link clicked.
    // I believe an empty href always gets filled in with the current URL so
    // it will never actually be empty. However, I don't know this for certain.
    if (event.target.nodeName.toLowerCase() === "a" && event.target.href) {
      this.bgCommunication.run(() => {
        this.cfmm.sendSyncMessage(
            `${C.MM_PREFIX}notifyLinkClicked`,
            {
              dest: event.target.href,
              origin: event.target.ownerDocument.URL,
            },
        );
      });
      return;
    }
    // Form submit button clicked. This can either be directly (e.g. mouseclick,
    // enter/space while the the submit button has focus) or indirectly (e.g.
    // pressing enter when a text input has focus).
    if (event.target.nodeName.toLowerCase() === "input" &&
        event.target.type.toLowerCase() === "submit" &&
        event.target.form && event.target.form.action) {
      this.bgCommunication.run(() => {
        this.cfmm.sendSyncMessage(
            `${C.MM_PREFIX}registerFormSubmitted`,
            {
              dest: event.target.form.action,
              origin: event.target.ownerDocument.URL,
            },
        );
      });
      return;
    }
  }

  protected startupSelf() {
    this.msgListener.addListener(
        "reload", this.msgListenerCallbacks.reloadDocument,
    );

    this.msgListener.addListener("setLocation", (message) => {
      const replace = "replaceUri" in message.data &&
          message.data.replaceUri === this.contentWindow.document.location.href;
      this.setLocation(message.data.uri, replace);
    });

    this.eventListener.addListener(
        this.cfmm.content,
        "click",
        this.eventListenerCallbacks.mouseClicked,
        true,
    );

    return MaybePromise.resolve(undefined);
  }
}
