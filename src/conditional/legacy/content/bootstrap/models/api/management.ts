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

import { IListenInterface } from "content/lib/classes/listeners";
import { Module } from "content/lib/classes/module";
import { createListenersMap } from "content/lib/utils/listener-factories";
import { Log } from "content/models/log";

const {AddonManager} = Cu.import("resource://gre/modules/AddonManager.jsm", {});

type Addon = any;
type ExtensionInfo = browser.management.ExtensionInfo;
type AddonListenerCallback =
    "onEnabled" | "onDisabled" | "onInstalled" | "onUninstalled";

export class Management extends Module {
  public onEnabled: IListenInterface;
  public onDisabled: IListenInterface;
  public onInstalled: IListenInterface;
  public onUninstalled: IListenInterface;

  protected moduleName = "management";

  private addonListener: any = {};

  private MANAGEMENT_EVENTS = Object.freeze([
    "onEnabled",
    "onDisabled",
    "onInstalled",
    "onUninstalled",
  ]);

  private events = createListenersMap(this.MANAGEMENT_EVENTS);

  constructor({log}: {log: Log}) {
    super({log});

    this.MANAGEMENT_EVENTS.forEach((aEvent) => {
      this.addonListener[aEvent] =
          this.onAddonListenerEvent.bind(this, aEvent);
    });
  }

  public get backgroundApi() {
    return {
      get: this.get.bind(this),
      getAll: this.getAll.bind(this),
      getSelf: this.getSelf.bind(this),

      onDisabled: this.events.interfaces.onDisabled,
      onEnabled: this.events.interfaces.onEnabled,
      onInstalled: this.events.interfaces.onInstalled,
      onUninstalled: this.events.interfaces.onUninstalled,
    };
  }

  public get(aId: string) {
    const p = new Promise((resolve, reject) => {
      AddonManager.getAddonByID(aId, (addon: Addon) => {
        try {
          if (addon) {
            resolve(this.mapAddonInfoToWebextExtensionInfo(addon));
          } else {
            reject();
          }
        } catch (e) {
          console.error("browser.management.get()");
          console.dir(e);
          reject(e);
        }
      });
    });
    p.catch((e) => {
      if (!e) {
        // the extension does not exist
        return;
      }
      this.log.error("get()", e);
    });
    return p;
  }

  public getAll() {
    const pExtensionInfo = new Promise((resolve) => (
      AddonManager.getAllAddons(resolve)
    )).then((addons: any[]) => (
      addons.map(this.mapAddonInfoToWebextExtensionInfo)
    ));
    pExtensionInfo.catch(this.log.onError("getAll()"));
    return pExtensionInfo;
  }

  public getSelf() {
    return this.get("/* @echo EXTENSION_ID */");
  }

  protected async startupSelf() {
    AddonManager.addAddonListener(this.addonListener);
  }

  protected async shutdownSelf() {
    AddonManager.removeAddonListener(this.addonListener);
  }

  private mapAddonInfoToWebextExtensionInfo(aAddon: Addon): ExtensionInfo {
    const {
      id,
      isActive: enabled,
      name,
      version,
    } = aAddon;

    return Object.freeze({
      enabled,
      id,
      name,
      version,
    }) as ExtensionInfo;
  }

  private mapAddonListenerCallbackToManagementEventName(
      aCallbackName: AddonListenerCallback,
  ) {
    switch (aCallbackName) {
      case "onEnabled": return "onEnabled";
      case "onDisabled": return "onDisabled";
      case "onInstalled": return "onInstalled";
      case "onUninstalled": return "onUninstalled";
      // eslint-disable-next-line no-throw-literal
      default: throw new Error(`Unhandled callback name "${aCallbackName}".`);
    }
  }

  private onAddonListenerEvent(
      aALCallbackName: AddonListenerCallback,
      aAddon: Addon,
  ) {
    const webextEventName = this.
        mapAddonListenerCallbackToManagementEventName(aALCallbackName);
    const extensionInfo = this.mapAddonInfoToWebextExtensionInfo(aAddon);
    this.events.listenersMap[webextEventName].emit(extensionInfo);
  }
}
