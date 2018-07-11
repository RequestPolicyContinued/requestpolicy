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
import {defer} from "lib/utils/js-utils";

const MAX_WAIT_FOR_STARTUP_SECONDS = 15;
const MAX_STARTUP_SECONDS = 15;

export interface IModule {
  startup?: () => Promise<void>;
  shutdown?: () => Promise<void>;
  whenReady: Promise<void>;
}

export abstract class Module implements IModule {
  protected log: Common.ILog;
  protected debugLog: Common.ILog;

  protected get subModules(): {[key: string]: IModule} | undefined {
    return undefined;
  }

  private startupCalled = false;
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

  private timedOutWaitingForStartup = false;
  private creationTime: number;

  constructor(
      public readonly moduleName: string,
      parentLog: Common.ILog,
  ) {
    this.log = parentLog.extend({name: moduleName});
    this.debugLog = this.log.extend({enabled: false, level: "all"});

    this.creationTime = new Date().getTime();
    setTimeout(() => {
      if (this.startupCalled) return;
      this.log.error(`[severe] startup() hasn't been invoked ` +
          `even after ${MAX_WAIT_FOR_STARTUP_SECONDS} seconds!`);
    }, 1000 * MAX_WAIT_FOR_STARTUP_SECONDS);
  }

  public async startup(): Promise<void> {
    this.startupCalled = true;

    let timedOutStartingUp = false;
    setTimeout(() => {
      if (this.ready) return;
      timedOutStartingUp = true;
      this.log.error(`startup didn't finish ` +
          `even after ${MAX_STARTUP_SECONDS} seconds!`);
    }, 1000 * MAX_STARTUP_SECONDS);
    const startupStartTime = new Date().getTime();
    if (this.timedOutWaitingForStartup) {
      this.log.error(
          `starting up... / needed to wait ` +
          `${(startupStartTime - this.creationTime) / 1000} seconds!`);
    } else {
      this.debugLog.log("starting up...");
    }

    const p = this.startup_();
    p.catch(this.log.onError("error on startup"));
    await p;
    this.ready = true;
    this.dReady.resolve(undefined);

    if (timedOutStartingUp) {
      const startupEndTime = new Date().getTime();
      this.log.error(
          `startup done / startup took ` +
          `${(startupEndTime - startupStartTime) / 1000} seconds!`);
    } else {
      this.debugLog.log("startup done");
    }
  }

  public async shutdown(): Promise<void> {
    this.debugLog.log("shutting down...");
    const p = this.shutdown_();
    p.catch(this.log.onError("error on shutdown"));
    await p;
    this.debugLog.log("done shutting down");
  }

  public isReady() { return this.ready; }

  protected startupSelf(): Promise<void> {
    return Promise.resolve();
  }

  protected shutdownSelf(): Promise<void> {
    return Promise.resolve();
  }

  protected assertReady(): void | never {
    if (!this.ready) {
      const msg = `Module "${this.moduleName}" is not ready yet!`;
      this.log.error(msg);
      console.trace();
      throw new Error(msg);
    }
  }

  private async startup_(): Promise<void> {
    if (this.startupPreconditions.length !== 0) {
      const n = this.startupPreconditions.length;
      this.debugLog.log(
          `awaiting ${n} precondition${ n > 1 ? "s" : "" }...`,
      );
      await Promise.all(this.startupPreconditions);
      this.debugLog.log("done awaiting preconditions");
    }
    this.debugLog.log(`starting up self and submodules...`);
    await Promise.all([
      this.runSubmoduleFns("startup"),
      this.runSelfFn("startup"),
    ]);
    this.debugLog.log("done starting up self and submodules");
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
