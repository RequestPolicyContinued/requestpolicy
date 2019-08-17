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

import { App } from "app/interfaces";
import { API } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { C } from "data/constants";
import { IConnection } from "lib/classes/connection";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import {defer} from "lib/utils/js-utils";

type StorageMessageType = "full-storage" | "storage-changes" |
    "request:full-storage";
interface IResponse {
  target: string;
  type: StorageMessageType;
  value: any;
}

export class StorageMigrationToWebExtension extends Module
    implements App.migration.storage.IStorageMigrationToWebExtension {
  protected get debugEnabled() { return C.LOG_STORAGE_MIGRATION; }

  private shouldSendFullStorage: boolean = true;
  private lastStorageChange: string | null = null;

  private dStorageReadyForAccess = defer<void>();
  private dInitialSync = defer<void>();
  private initialSyncState: "not started" | "started" | "done" = "not started";

  private connectionToEWE: IConnection;

  // FIXME: this is only necessary for testing -- bad style!
  private dWaitingForEWE = defer<void>();

  private get storageArea() { return this.storageApi.local; }
  private get onStorageChanged() { return this.storageApi.onChanged; }

  constructor(
      log: Common.ILog,
      private storageApi: typeof browser.storage,  // badword-linter:allow:browser.storage:
      private pConnectionToEWE: Promise<IConnection>,
  ) {
    super("app.migration.storage.xpcomToWE", log);

    pConnectionToEWE.then((c) => this.connectionToEWE = c).
        catch(this.log.onError("connectionToEWE"));
  }

  protected startupSelf() {
    return MaybePromise.resolve(this.startupSelfAsync());
  }

  protected startupSelfAsync(): Promise<void> {
    const pGotLastStorageChange =
        this.storageArea.get("lastStorageChange").then((result) => {
          this.lastStorageChange =
              (result.lastStorageChange as string | undefined) || null;
          this.debugLog.log(
              `got "lastStorageChange": ${result.lastStorageChange}`,
          );
        }).catch(this.log.onError("get lastStorageChange"));
    const pGotConnectionToEWE = this.debugEnabled ?
        this.pConnectionToEWE.then(() => {
          this.debugLog.log(`got connection to EWE`);
        }) : (this.pConnectionToEWE as Promise<any>);
    return Promise.all([
      pGotConnectionToEWE,
      pGotLastStorageChange,
    ]).then(() => {
      this.connectionToEWE.onMessage.
          addListener(this.receiveMessage.bind(this));
      const p = this.connectionToEWE.sendMessage(
          this.createMessage("startup", "ready"),
      );
      this.debugLog.log("waiting for the EWE to be ready");
      this.dWaitingForEWE.resolve(undefined);
      return p;
    }).then(() => {
      this.debugLog.log(
          "the EWE is ready. waiting for synchronization to be done",
      );
      return this.dInitialSync.promise;
    }).then(() => {
      this.debugLog.log("synchronization done");
      this.onStorageChanged.addListener(this.storageChanged.bind(this));
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
    if (aResponse.target !== "legacy-side-storage-migration-controller") {
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

  private getFullWebextStorage(): Promise<API.storage.api.StorageObject> {
    return this.connectionToEWE.sendMessage(
        this.createMessage("request", "full-storage")).then((response: any) => {
      this.assertSuccessful(response, "request:full-storage");
      return response.value as API.storage.api.StorageObject;
    });
  }

  private pullFullStorage(): Promise<void> {
    this.debugLog.log(`requesting full storage from the EWE`);
    return this.getFullWebextStorage().then((fullStorage) => {
      this.debugLog.log(
          `got full storage from the EWE. storing the full storage...`,
      );
      return this.storageArea.set(fullStorage);
    }).then(() => {
      this.debugLog.log(
          `done storing the full storage, pull done.`,
      );
      this.shouldSendFullStorage = false;
    });
  }

  private sendFullStorage(): Promise<void> {
    const p = this.storageArea.get(null).then((fullStorage) => {
      this.debugLog.log(`sending full storage to the EWE`);
      return this.connectionToEWE.sendMessage(
          this.createMessage("full-storage", fullStorage));
    }).then((response: any) => {
      this.assertSuccessful(response, "full-storage");
      this.debugLog.log(`successfully sent full storage to the EWE`);
      this.shouldSendFullStorage = false;
    });
    p.catch(this.log.onError(
        "Error on sending the full storage to the embedded WebExtension:",
    ));
    return p;
  }

  private storageChanged(
      aStorageChanges: API.storage.api.ChangeDict,
  ): Promise<void> {
    this.debugLog.log("obtaining storage change:", aStorageChanges);
    if (!this.isStorageReadyForAccess) {
      this.log.error("Not ready for storage changes yet!");
    }
    if (this.shouldSendFullStorage) {
      return this.sendFullStorage();
    }
    this.debugLog.log(
        "going to send storage change to the EWE:",
        aStorageChanges,
    );
    return this.connectionToEWE.sendMessage(
        this.createMessage("storage-changes", aStorageChanges),
    ).then((response: any) => {
      this.assertSuccessful(response, "storage-changes");
      this.debugLog.log("successfully sent storage change to the EWE");
    }).catch((e: any) => {
      this.log.error(
          "Error on sending storage changes to the empedded WebExtension:",
          e);
      this.shouldSendFullStorage = true;
      return this.sendFullStorage();
    });
  }

  private receiveMessage(
      aMessage: any,
  ): void {
    if (aMessage.target !== "legacy-side-storage-migration-controller") return;
    if (aMessage.type !== "startup") return;
    if (!aMessage.value.ready) return;
    if (this.initialSyncState !== "not started") return;
    this.initialSyncState = "started";
    this.debugLog.log(
        `got EWE-side lastStorageChange: ${aMessage.value.lastStorageChange}`,
    );
    const isPull =
        !aMessage.value.lastStorageChange ? false :
        !this.lastStorageChange ? true :
        (
          new Date(aMessage.value.lastStorageChange) >
          new Date(this.lastStorageChange)
        );
    const pushOrPull = isPull ? "pull" : "push";
    this.debugLog.log(
        `going to perform storage synchronization (${pushOrPull})`,
    );
    const pInitialSync = isPull ?
        this.pullFullStorage() :
        this.sendFullStorage();
    pInitialSync.catch((e: any) => {
      this.log.error(`Error on initial sync (${pushOrPull}):`, e);
    });
    this.dInitialSync.resolve(pInitialSync.then(() => {
      this.initialSyncState = "done";
    }));
    if (isPull) {
      this.dStorageReadyForAccess.resolve(pInitialSync);
    } else {
      this.dStorageReadyForAccess.resolve(undefined);
    }
  }

  private createMessage(aType: string, aValue: any) {
    return {
      target: "storage-migration-from-xpcom",
      type: aType,
      value: aValue,
    };
  }
}
