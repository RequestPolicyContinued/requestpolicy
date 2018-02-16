/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Martin Kimmerle
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

import {C} from "lib/constants";

const TARGET_NAME = "webext-side-settings-migration-controller";
const REMOTE_TARGET_NAME = "legacy-side-settings-migration-controller";

// =============================================================================

// a little hack for non-ui-testing
const defaultBrowser = C.BUILD_ALIAS === "non-ui-testing" ?
    {runtime: null, storage: null} : browser;
let currentBrowser = defaultBrowser;
function _injectBrowser(aNewBrowser: any) {
  if (C.BUILD_ALIAS !== "non-ui-testing") return;
  currentBrowser = aNewBrowser || defaultBrowser;
}
type tBrowser = typeof browser;
function getBrowser() {
  return currentBrowser as tBrowser;
}

// =============================================================================

type StorageMessageType = "full-storage" | "storage-change" |
    "request:full-storage";
type StorageChange = browser.storage.StorageChange;
interface IStorageChanges { [key: string]: StorageChange; }

// =============================================================================

class Controller {
  private lastStorageChange: string | null = null;

  public startup() {
    const {runtime, storage} = getBrowser();
    return storage.local.get(
        "lastStorageChange",
    ).then((result) => {
      this.lastStorageChange = result.lastStorageChange || null;
      runtime.onMessage.addListener(this.receiveMessage.bind(this));
      return this.sendStartupMessage();
    });
  }

  private sendStartupMessage(): Promise<void> {
    const p = this.sendMessage("startup", {
      lastStorageChange: this.lastStorageChange,
      ready: true,
    });
    p.catch((e) => {
      console.error("Failed to send webex-side startup message");
      console.dir(e);
      return Promise.reject(e);
    });
    return p;
  }

  private getFullStorage() {
    return getBrowser().storage.local.get(null);
  }

  private setFullStorage(aFullStorage: {[key: string]: any}) {
    return getBrowser().storage.local.set(aFullStorage);
  }

  private applyStorageChange(aStorageChanges: IStorageChanges) {
    const keysToRemove: string[] = [];
    let hasKeysToSet = false;
    const keysToSet: {[key: string]: any} = {};
    // tslint:disable-next-line prefer-const
    for (let key of Object.keys(aStorageChanges)) {
      const change = aStorageChanges[key];
      if ("newValue" in change) {
        keysToSet[key] = change.newValue;
        hasKeysToSet = true;
      } else {
        keysToRemove.push(key);
      }
    }
    const {storage} = getBrowser();
    const hasKeysToRemove = keysToRemove.length !== 0;
    const promises = [];
    if (hasKeysToRemove) promises.push(storage.local.remove(keysToRemove));
    if (hasKeysToSet) promises.push(storage.local.set(keysToSet));
    return Promise.all(promises);
  }

  private receiveMessage(
      aMessage: any,
      aSender: browser.runtime.MessageSender,
      aSendResponse: (rv: any) => void,
  ): Promise<any> | void {
    if (aMessage.target !== TARGET_NAME) return;
    switch (aMessage.type) {
      case "startup":
        if (aMessage.value === "ready") return this.sendStartupMessage();
        return Promise.reject(`Unknown value '${aMessage.value}' (startup).`);
      case "request":
        switch (aMessage.value) {
          case "full-storage":
            return this.respond("request:full-storage", this.getFullStorage());
          default:
            return Promise.reject(`Unknown '${aMessage.value}' request.`);
        }
      case "full-storage":
        return this.respond(
            "full-storage",
            this.setFullStorage(aMessage.value),
        );
      case "storage-change":
        return this.respond("storage-change",
            this.applyStorageChange(aMessage.value as StorageChange));
      default:
        return Promise.reject(`Unknown type '${aMessage.type}'.`);
    }
  }

  private createMessage(aType: string, aValue: any) {
    return {
      target: REMOTE_TARGET_NAME,
      type: aType,
      value: aValue,
    };
  }

  private sendMessage(aType: string, aValue: any): Promise<void> {
    return getBrowser().runtime.sendMessage(this.createMessage(aType, aValue));
  }

  private respond<T = void>(
      aMsgType: StorageMessageType,
      aPromise: Promise<T>,
  ) {
    const responseMsgType = `${aMsgType}:response`;
    return aPromise.then((value?: T) => this.createMessage(
        responseMsgType,
        value,
    )).catch((e: any) => this.createMessage(
        responseMsgType,
        {error: e.toString()},
    ));
  }
}

let controller: Controller;

export const WebextSideSettingsMigrationController = {
  startup(): Promise<void> {
    controller = new Controller();
    return controller.startup();
  },
  _injectBrowser,
  get _controller() {
    return controller;
  },
};
