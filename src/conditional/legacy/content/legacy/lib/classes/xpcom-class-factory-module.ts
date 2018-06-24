/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

import { XPCOM, JSMs } from "bootstrap/api/interfaces";
import { Module } from "lib/classes/module";
import { XPConnectService } from "bootstrap/api/services/xpconnect-service";
import { Common } from "common/interfaces";

export abstract class XpcomClassFactoryModule extends Module {
  protected abstract readonly XPCOM_CATEGORIES: string[];

  protected abstract readonly classDescription: string;
  protected abstract readonly interfaceID: string;
  protected abstract readonly contractID: string;

  private readonly classID = this.xpcComponentID(this.interfaceID);

  // nsISupports interface implementation
  public QueryInterface = this.XPCOMUtils.generateQI(
      this.getImplementedInterfaces(),
  );

  constructor(
      moduleName: string,
      parentLog: Common.ILog,
      protected readonly xpconnectService: XPConnectService,
      protected readonly xpcComponentInterfaces: XPCOM.nsXPCComponents_Interfaces,
      protected readonly xpcComponentResults: XPCOM.nsXPCComponents_Results,
      protected readonly xpcComponentID: XPCOM.nsXPCComponents["ID"],
      protected readonly XPCOMUtils: JSMs.XPCOMUtils,
  ) {
    super(moduleName, parentLog);
  }

  protected getImplementedInterfaces(): XPCOM.nsIJSID[] {
    return [this.xpcComponentInterfaces.nsIFactory];
  }

  protected async startupSelf() {
    const nTimes = 10;
    for (let i = 0; i < nTimes; ++i) {
      try {
        this.register();
        return;
      } catch (e) {
        if (e.result === this.xpcComponentResults.NS_ERROR_FACTORY_EXISTS) {
          // When upgrading restartless the old factory might still exist.
          await Promise.resolve();
          continue;
        } else {
          this.log.error("Failed to register factory! Details:", e);
          return;
        }
      }
    }
    this.log.error(`Failed to register factory ${nTimes} times!`);
  }

  protected shutdownSelf() {
    return this.unregister();
  }

  protected beforeUnregistering(): void {}

  private register() {
    const catMan = this.xpconnectService.getCategoryManagerService();
    const registrar = this.xpconnectService.getComponentRegistrar();

    registrar.registerFactory(
        this.classID, this.classDescription, this.contractID,
        this
    );

    for (let category of this.XPCOM_CATEGORIES) {
      catMan.addCategoryEntry(
          category, this.contractID, this.contractID, false,
          true
      );
    }
  }

  private async unregister() {
    this.beforeUnregistering();

    const catMan = this.xpconnectService.getCategoryManagerService();
    const registrar = this.xpconnectService.getComponentRegistrar();

    for (const category of this.XPCOM_CATEGORIES) {
      catMan.deleteCategoryEntry(category, this.contractID, false);
    }

    // This needs to run asynchronously, see bug 753687
    await Promise.resolve();

    registrar.unregisterFactory(this.classID, this);
  }

  // ---------------------------------------------------------------------------
  // nsIFactory interface implementation
  // ---------------------------------------------------------------------------

  public createInstance(outer: any, iid: XPCOM.nsIJSID) {
    if (outer) {
      throw this.xpcComponentResults.NS_ERROR_NO_AGGREGATION;
    }
    return this.QueryInterface(iid);
  }
}
