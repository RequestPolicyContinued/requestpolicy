/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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
import { Module } from "lib/classes/module";
import { defer } from "lib/utils/js-utils";

// =============================================================================
// constants
// =============================================================================

/**
 * The states of the communication channel to with the overlay.
 * @enum {number}
 */
const States = {
  WAITING: 0,
  // tslint:disable-next-line:object-literal-sort-keys
  RUNNING: 1,
  STOPPED: 2,
};

type Runnable = () => void;

// =============================================================================
// FramescriptToBackgroundCommunication
// =============================================================================

export class FramescriptToBackgroundCommunication extends Module {
  /**
   * A queue of runnables that wait for the overlay to be ready.
   * As it's a queue, the functions `pop` and `shift` have to be
   * used.
   */
  private waitingRunnables: Runnable[] = [];
  private state = States.WAITING;

  private dCommunicationStarted = defer<void>();

  private msgListenerCallbacks = {
    startCommunication: this.startCommunication.bind(this),
  };

  constructor(
      parentLog: Common.ILog,
      private readonly cfmm: XPCOM.nsIContentFrameMessageManager,
      private readonly msgListener: App.utils.IMessageListener<
          XPCOM.nsIContentFrameMessageManager
      >,
  ) {
    super("app.contentSide.bgCommunication", parentLog);
  }

  /**
   * Add a function that will be called now or later.
   */
  public run(aRunnable: Runnable) {
    switch (this.state) {
      case States.RUNNING:
        // this.log.log("Immediately running function.");
        aRunnable.call(null);
        break;

      case States.WAITING:
        // this.log.log("Remembering runnable.");
        this.waitingRunnables.push(aRunnable);
        break;

      default:
        // this.log.log("Ignoring runnable.");
        break;
    }
  }

  protected get subModules() {
    return {
      msgListener: this.msgListener,
    };
  }

  protected startupSelf() {
    return this.startCommNowOrLater();
  }

  protected shutdownSelf() {
    return this.stopCommunication();
  }

  /**
   * Check whether the Background is ready. If it is, start the
   * communication. If not, wait for the overlay to be ready.
   */
  private startCommNowOrLater(): Promise<void> {
    const answers = this.cfmm.sendSyncMessage(
        `${C.MM_PREFIX}isOverlayReady`,
    );
    if (answers.length > 0 && answers[0] === true) {
      this.startCommunication();
    } else {
      // The Background is not ready yet, so listen for the message.
      // Add the listener immediately.
      this.msgListener.addListener(
          "overlayIsReady",
          this.msgListenerCallbacks.startCommunication,
          undefined,
          true,
      );
    }
    return this.dCommunicationStarted.promise;
  }

  /**
   * The overlay is ready.
   */
  private startCommunication() {
    if (this.state === States.WAITING) {
      // this.log.log("The Background is ready!");
      this.state = States.RUNNING;

      while (this.waitingRunnables.length > 0) {
        const runnable = this.waitingRunnables.shift()!;
        // this.log.log("Lazily running function.");
        runnable.call(null);
      }

      this.dCommunicationStarted.resolve(undefined);
    }
  }

  private stopCommunication(): Promise<void> {
    this.state = States.STOPPED;
    return Promise.resolve();
  }
}
