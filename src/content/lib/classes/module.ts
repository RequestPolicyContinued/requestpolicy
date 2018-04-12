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

import {defer} from "lib/utils/js-utils";
import {Log} from "models/log";

export interface IModule {
  startup?: () => Promise<void>;
  shutdown?: () => Promise<void>;
  whenReady: Promise<void>;
}

export abstract class Module implements IModule {
  protected log: Log;
  protected debugLog: Log;

  protected get subModules(): {[key: string]: IModule} | undefined {
    return undefined;
  }

  private dReady = defer();
  private ready = false;
  public get whenReady() { return this.dReady.promise; }

  private dSelfBootstrap = {
    shutdown: defer(),
    startup: defer(),
  };

  private dChildBootstrap = {
    shutdown: defer(),
    startup: defer(),
  };

  private pBootstrap = {
    shutdown: Promise.all([
      this.dChildBootstrap.shutdown.promise,
      this.dSelfBootstrap.shutdown.promise,
    ]).then(() => undefined),

    startup: Promise.all([
      this.dChildBootstrap.startup.promise,
      this.dSelfBootstrap.startup.promise,
    ]).then(() => undefined),
  };

  protected get startupPreconditions(): Array<Promise<void>> {
    return [];
  }

  protected get shutdownPreconditions(): Array<Promise<void>> {
    return [];
  }

  public get pStartup() { return this.pBootstrap.startup; }
  public get pShutdown() { return this.pBootstrap.shutdown; }

  constructor(
      public readonly moduleName: string,
      parentLog: Log,
  ) {
    this.log = parentLog.extend({name: moduleName});
    this.debugLog = this.log.extend({enabled: false});
  }

  public async startup(): Promise<void> {
    this.debugLog.log("starting up...");
    const p = this.startup_();
    p.catch(this.log.onError("startup()"));
    await p;
    this.ready = true;
    this.dReady.resolve(undefined);
    this.debugLog.log("startup done");
  }

  public async shutdown(): Promise<void> {
    this.debugLog.log("shutting down...");
    const p = this.shutdown_();
    p.catch(this.log.onError("shutdown()"));
    await p;
    this.debugLog.log("shut down");
  }

  protected startupSelf(): Promise<void> {
    return Promise.resolve();
  }

  protected shutdownSelf(): Promise<void> {
    return Promise.resolve();
  }

  protected assertReady() {
    if (!this.ready) {
      const msg = `Module "${this.moduleName}" is not ready yet!`;
      this.log.error(msg);
      console.trace();
      throw new Error(msg);
    }
  }

  private async startup_(): Promise<void> {
    await Promise.all(this.startupPreconditions);
    await this.runSubmoduleFns("startup");
    await this.runSelfFn("startup");
  }

  private async shutdown_(): Promise<void> {
    await Promise.all(this.shutdownPreconditions);
    await this.runSelfFn("shutdown");
    await this.runSubmoduleFns("shutdown");
  }

  private getSubmodules(): IModule[] {
    if (!this.subModules) return [];
    return Object.keys(this.subModules).
        map((key) => this.subModules![key]).
        filter((m, index) => {
          if (!m) {
            this.log.error(`submodule #${index + 1} is ${JSON.stringify(m)}`);
            console.trace();
          }
          return !!m;
        });
  }

  private runSubmoduleFns(fnName: "startup" | "shutdown"): Promise<void> {
    const p = Promise.all(
        this.getSubmodules().
        filter((m) => fnName in m).
        map((m) => m[fnName]!()),
    ).then(() => undefined);
    p.catch(this.log.onError(`submodule ${fnName}`));
    this.dChildBootstrap[fnName].resolve(p);
    return p as Promise<any>;
  }

  private runSelfFn(fnName: "startup" | "shutdown"): Promise<void> {
    const selfFnName =
        `${fnName}Self` as "startupSelf" | "shutdownSelf";
    const p = this[selfFnName] ? this[selfFnName]!() : Promise.resolve();
    p.catch(this.log.onError(`self-${fnName}`));
    this.dSelfBootstrap[fnName].resolve(p);
    return p;
  }
}
