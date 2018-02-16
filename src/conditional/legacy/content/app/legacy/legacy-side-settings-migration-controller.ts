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

import { IConnection } from "lib/classes/connection";
import { Module } from "lib/classes/module";
import {defer} from "lib/utils/js-utils";
import { Log } from "models/log";

type StorageMessageType = "full-storage" | "storage-change" |
    "request:full-storage";
interface IResponse {
  target: string;
  type: StorageMessageType;
  value: any;
}

export class LegacySideSettingsMigrationController extends Module {
  private shouldSendFullStorage: boolean = true;
  private lastStorageChange: string | null = null;

  private dStorageReadyForAccess = defer<void>();
  private dInitialSync = defer<void>();

  // FIXME: this is only necessary for testing -- bad style!
  private dWaitingForEWE = defer<void>();

  constructor(
      log: Log,
      private storage: typeof browser.storage,
      private connectionToEWE: IConnection,
  ) {
    super("Legacy settings migration", log);
  }

  protected startupSelf(): Promise<void> {
    const pGotLastStorageChange =
        this.storage.local.get("lastStorageChange").then((result) => {
          this.lastStorageChange = result.lastStorageChange || null;
        });
    return Promise.all([
      this.connectionToEWE.whenReady,
      pGotLastStorageChange,
    ]).then(() => {
      this.connectionToEWE.onMessage.
          addListener(this.receiveMessage.bind(this));
      this.storage.onChanged.addListener(this.storageChanged.bind(this));
      this.connectionToEWE.sendMessage(this.createMessage("startup", "ready"));
      this.dWaitingForEWE.resolve(undefined);
      return this.dInitialSync.promise;
    });
  }

  public get pWaitingForEWE() { return this.dWaitingForEWE.promise; }
  public get pStorageReadyForAccess() {
    return this.dStorageReadyForAccess.promise;
  }
  public get isStorageReadyForAccess() {
    return this.dStorageReadyForAccess.promiseState === "fulfilled";
  }
  public get pInitialSync() { return this.dInitialSync.promise; }

  private assertSuccessful(
      aResponse: IResponse,
      aType: StorageMessageType,
  ) {
    if (!aResponse) {
      throw new Error("No response");
    }
    let msg;
    const expectedType = `${aType}:response`;
    if (aResponse.target !== "legacy-side-settings-migration-controller") {
      msg = "Incorrect target.";
    } else if (aResponse.type !== expectedType) {
      msg = `incorrect response type. expected "${expectedType}".`;
    } else if (aResponse.value && "error" in aResponse.value) {
      msg = "Response value contains an error.";
    }
    if (msg) {
      this.log.error(msg, aResponse);
      throw new Error(msg);
    }
  }

  private getFullWebextStorage(): Promise<browser.storage.StorageResults> {
    return this.connectionToEWE.sendMessage(
        this.createMessage("request", "full-storage")).then((response: any) => {
      this.assertSuccessful(response, "request:full-storage");
      return response.value as browser.storage.StorageResults;
    });
  }

  private pullFullStorage(): Promise<void> {
    return this.getFullWebextStorage().then((fullStorage) => {
      return this.storage.local.set(fullStorage);
    }).then(() => {
      this.shouldSendFullStorage = false;
    });
  }

  private sendFullStorage(): Promise<void> {
    const p = this.storage.local.get(null).then((fullStorage) => {
      return this.connectionToEWE.sendMessage(
          this.createMessage("full-storage", fullStorage));
    }).then((response: any) => {
      this.assertSuccessful(response, "full-storage");
      this.shouldSendFullStorage = false;
    });
    p.catch((e: any) => {
      this.log.error(
          "Error on sending the full storage to the embedded WebExtension:",
          e);

    });
    return p;
  }

  private storageChanged(
      aStorageChange: browser.storage.StorageChange,
  ): Promise<void> {
    if (!this.isStorageReadyForAccess) {
      this.log.error("Not ready for storage changes yet!");
    }
    if (this.shouldSendFullStorage) {
      return this.sendFullStorage();
    }
    return this.connectionToEWE.sendMessage(
        this.createMessage("storage-change", aStorageChange),
    ).then((response: any) => {
      this.assertSuccessful(response, "storage-change");
    }).catch((e: any) => {
      this.log.error(
          "Error on sending StorageChange to the empedded WebExtension:",
          e);
      this.shouldSendFullStorage = true;
      return this.sendFullStorage();
    });
  }

  private receiveMessage(
      aMessage: any,
      aSender: browser.runtime.MessageSender,
      aSendResponse: (rv: any) => void,
  ): void {
    if (aMessage.target !== "legacy-side-settings-migration-controller") return;
    if (aMessage.type !== "startup") return;
    if (!aMessage.value.ready) return;
    const isPull =
        !aMessage.value.lastStorageChange ? false :
        !this.lastStorageChange ? true :
        (
          new Date(aMessage.value.lastStorageChange) >
          new Date(this.lastStorageChange)
        );
    const pInitialSync = isPull ?
        this.pullFullStorage() :
        this.sendFullStorage();
    pInitialSync.catch((e: any) => {
      this.log.error(`Error on initial sync (${isPull ? "pull" : "push"}):`, e);
    });
    this.dInitialSync.resolve(pInitialSync);
    if (isPull) {
      this.dStorageReadyForAccess.resolve(pInitialSync);
    } else {
      this.dStorageReadyForAccess.resolve(undefined);
    }
  }

  private createMessage(aType: string, aValue: any) {
    return {
      target: "webext-side-settings-migration-controller",
      type: aType,
      value: aValue,
    };
  }
}
