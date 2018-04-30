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

import { Common } from "common/interfaces";
import { IConnection } from "lib/classes/connection";
import { Module } from "lib/classes/module";

const TARGET_NAME = "storage-migration-from-xpcom";
const REMOTE_TARGET_NAME = "legacy-side-storage-migration-controller";

// =============================================================================

type StorageMessageType = "full-storage" | "storage-change" |
    "request:full-storage";
type StorageChange = browser.storage.StorageChange;
interface IStorageChanges { [key: string]: StorageChange; }

// =============================================================================

export class StorageMigrationFromXpcom extends Module {
  private lastStorageChange: string | null = null;
  private connectionToLegacy: IConnection;

  constructor(
      log: Common.ILog,
      private pConnectionToLegacy: Promise<IConnection>,
      private storage: typeof browser.storage,
  ) {
    super("ewe.storageMigrationFromXpcom", log);

    pConnectionToLegacy.then((c) => this.connectionToLegacy = c).
        catch(this.log.onError("connectionToLegacy"));
  }

  public startupSelf() {
    return this.storage.local.get(
        "lastStorageChange",
    ).then((result) => {
      this.lastStorageChange =
          (result.lastStorageChange as string | undefined) || null;
      return this.pConnectionToLegacy;
    }).then(() => {
      this.connectionToLegacy.onMessage.addListener(
          this.receiveMessage.bind(this));
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
    return this.storage.local.get(null);
  }

  private setFullStorage(aFullStorage: {[key: string]: any}) {
    return this.storage.local.set(aFullStorage);
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
    const hasKeysToRemove = keysToRemove.length !== 0;
    const promises: Array<Promise<void>> = [];
    if (hasKeysToRemove) promises.push(this.storage.local.remove(keysToRemove));
    if (hasKeysToSet) promises.push(this.storage.local.set(keysToSet));
    return Promise.all(promises);
  }

  private receiveMessage(
      aMessage: any,
  ): Promise<any> | void {
    if (aMessage.target !== TARGET_NAME) return;
    switch (aMessage.type) {
      case "startup":
        if (aMessage.value === "ready") return this.sendStartupMessage();
        return Promise.reject(`Unknown value '${aMessage.value}' (startup).`);
      case "request":
        switch (aMessage.value) {
          case "full-storage":
            return this.respond(
                "request:full-storage",
                () => this.getFullStorage(),
            );
          default:
            return Promise.reject(`Unknown '${aMessage.value}' request.`);
        }
      case "full-storage":
        return this.respond(
            "full-storage",
            () => this.setFullStorage(aMessage.value),
        );
      case "storage-change":
        return this.respond(
            "storage-change",
            () => this.applyStorageChange(aMessage.value as StorageChange));
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
    return this.connectionToLegacy.sendMessage(
        this.createMessage(aType, aValue),
    );
  }

  private async respond<T = void>(
      aMsgType: StorageMessageType,
      getResponseValue: () => Promise<T>,
  ) {
    const responseMsgType = `${aMsgType}:response`;
    try {
      return getResponseValue().then((value?: T) => this.createMessage(
          responseMsgType,
          value,
      ));
    } catch (e) {
      return this.createMessage(
          responseMsgType,
          {error: e.toString()},
      );
    }
  }
}
