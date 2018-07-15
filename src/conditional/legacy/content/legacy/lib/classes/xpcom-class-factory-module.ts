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

import { JSMs, XPCOM } from "bootstrap/api/interfaces";
import { XPConnectService } from "bootstrap/api/services/xpconnect-service";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";

export abstract class XpcomClassFactoryModule extends Module {
  // nsISupports interface implementation
  public QueryInterface = this.XPCOMUtils.generateQI(
      this.getImplementedInterfaces(),
  );

  protected abstract readonly XPCOM_CATEGORIES: string[];

  protected abstract readonly classDescription: string;
  protected abstract readonly interfaceID: string;
  protected abstract readonly contractID: string;

  // tslint:disable-next-line:variable-name
  private _classID: XPCOM.nsIJSCID;

  private get classID() {
    if (!this._classID) this._classID = this.xpcComponentID(this.interfaceID);
    return this._classID;
  }

  constructor(
      moduleName: string,
      parentLog: Common.ILog,
      protected readonly xpconnectService: XPConnectService,
      protected readonly xpcComponentInterfaces:
          XPCOM.nsXPCComponents_Interfaces,
      protected readonly xpcComponentResults: XPCOM.nsXPCComponents_Results,
      protected readonly xpcComponentID: XPCOM.nsXPCComponents["ID"],
      protected readonly XPCOMUtils: JSMs.XPCOMUtils,
  ) {
    super(moduleName, parentLog);
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

  // ---------------------------------------------------------------------------

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

  // tslint:disable-next-line:no-empty
  protected beforeUnregistering(): void {}

  private register() {
    const catMan = this.xpconnectService.getCategoryManagerService();
    const registrar = this.xpconnectService.getComponentRegistrar();

    registrar.registerFactory(
        this.classID, this.classDescription, this.contractID,
        this,
    );

    for (const category of this.XPCOM_CATEGORIES) {
      catMan.addCategoryEntry(
          category, this.contractID, this.contractID, false,
          true,
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
}
