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
import { MaybePromise } from "lib/classes/maybe-promise";
import { defer, IDeferred } from "lib/utils/js-utils";

const MAX_WAIT_FOR_STARTUP_SECONDS = 15;
const MAX_STARTUP_SECONDS = 15;

export interface IModule {
  startup?: () => MaybePromise<void>;
  shutdown?: () => MaybePromise<void>;
  whenReady: Promise<void>;
}

export type StartupState =
    "not yet started" |
    "starting up" |
    "startup done";
export type ShutdownState =
    "not yet shut down" |
    "shutting down" |
    "shutdown done";

export abstract class Module implements IModule {
  protected log: Common.ILog;
  protected get debugEnabled() { return false; }
  protected debugLog: Common.ILog;

  protected get subModules(): {[key: string]: IModule} | undefined {
    return undefined;
  }

  // tslint:disable-next-line:variable-name
  private _startupState: StartupState = "not yet started";
  protected get startupState() { return this._startupState; }
  private get startupCalled() {
    return this.startupState !== "not yet started";
  }
  private get ready() { return this.startupState === "startup done"; }

  private dReady = defer();
  public get whenReady() { return this.dReady.promise; }

  // tslint:disable-next-line:variable-name
  private _shutdownState: ShutdownState = "not yet shut down";
  protected get shutdownState() { return this._shutdownState; }
  protected get stillRunning() {
    return this.shutdownState === "not yet shut down";
  }

  private dSelfBootstrap: {[key: string]: IDeferred<void, any>} = {
    shutdown: defer(),
    startup: defer(),
  };

  private dChildBootstrap = {
    shutdown: defer(),
    startup: defer(),
  };

  private pBootstrap: {[name: string]: MaybePromise<void>} = {
    shutdown: MaybePromise.all([
      this.dChildBootstrap.shutdown.promise,
      this.dSelfBootstrap.shutdown.promise,
    ]),

    startup: MaybePromise.all([
      this.dChildBootstrap.startup.promise,
      this.dSelfBootstrap.startup.promise,
    ]),
  } as {[name: string]: MaybePromise<any>};

  private preconditionStates: Array<
      "not awaiting" | "awaiting" | "done" | "failed"
  > = [];

  protected get dependencies(): Module[] {
    return [];
  }

  protected get startupPreconditions(): Array<Promise<void>> {
    return [];
  }

  protected get shutdownPreconditions(): Array<Promise<void>> {
    return [];
  }

  public get pStartup() { return this.pBootstrap.startup; }

  private timedOutWaitingForStartup = false;
  private creationTime: number;

  constructor(
      public readonly moduleName: string,
      protected parentLog: Common.ILog,
  ) {
    this.log = parentLog.extend({name: moduleName});
    this.debugLog = this.log.extend({enabled: this.debugEnabled, level: "all"});

    this.creationTime = new Date().getTime();
    this.setTimeout(() => {
      if (this.startupCalled) return;
      this.log.error(`[severe] startup() hasn't been invoked ` +
          `even after ${MAX_WAIT_FOR_STARTUP_SECONDS} seconds!`);
    }, 1000 * MAX_WAIT_FOR_STARTUP_SECONDS);
  }

  public startup(): MaybePromise<void> {
    if (this.startupState !== "not yet started") {
      this.log.error("startup() has already been called!");
      return MaybePromise.resolve(undefined);
    }
    this._startupState = "starting up";
    this.getStartupPreconditions().forEach((_, index) => {
      this.preconditionStates[index] = "not awaiting";
    });

    let timedOutStartingUp = false;
    this.setTimeout(() => {
      if (this.ready) return;
      timedOutStartingUp = true;
      this.log.error(
          `startup didn't finish ` +
          `even after ${MAX_STARTUP_SECONDS} seconds!`,
          {
            preconditionStates: this.preconditionStates,
          },
      );
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
    return MaybePromise.resolve(p.then(() => {
      this._startupState = "startup done";
      this.dReady.resolve(undefined);

      if (timedOutStartingUp) {
        const startupEndTime = new Date().getTime();
        this.log.error(
            `startup done / startup took ` +
            `${(startupEndTime - startupStartTime) / 1000} seconds!`);
      } else {
        this.debugLog.log("startup done");
      }
    }));
  }

  public shutdown(): MaybePromise<void> {
    if (this.shutdownState !== "not yet shut down") {
      this.log.error("shutdown() has already been called!");
      return MaybePromise.resolve(undefined);
    }
    this._shutdownState = "shutting down";

    this.debugLog.log("shutting down...");
    const p = this.shutdown_();
    p.catch(this.log.onError("error on shutdown"));
    return p.then(() => {
      this._shutdownState = "shutdown done";
      this.debugLog.log("done shutting down");
    });
  }

  public isReady() { return this.ready; }

  protected startupSelf(): MaybePromise<void> {
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf(): MaybePromise<void> {
    return MaybePromise.resolve(undefined);
  }

  protected assertReady(): void | never {
    if (!this.ready) {
      const msg = `Module "${this.moduleName}" is not ready yet!`;
      this.log.error(msg);
      console.trace();
      throw new Error(msg);
    }
  }

  // utility
  protected setTimeout(  // badword-linter:allow: setTimeout:
      aFn: () => void,
      aDelay: number,
  ) {
    return setTimeout(() => {  // badword-linter:allow: setTimeout:
      if (this.shutdownState !== "not yet shut down") {
        this.log.warn(
            "Not calling delayed function because of module shutdown.",
        );
        return;
      }
      aFn.call(null);
    }, aDelay);
  }

  private startup_(): MaybePromise<void> {
    const preconditions = this.getStartupPreconditions();
    const nPrecond = preconditions.length;
    let pPrecond: MaybePromise<void>;
    if (nPrecond !== 0) {
      this.debugLog.log(
          `awaiting ${nPrecond} precondition${ nPrecond > 1 ? "s" : "" }...`,
      );
      const preconditionsMapped = preconditions.map((p, index) => {
        this.preconditionStates[index] = "awaiting";
        return p.then(() => {
          this.preconditionStates[index] = "done";
        }).catch((e) => {
          this.preconditionStates[index] = "failed";
          return Promise.reject(e);
        });
      });
      pPrecond = MaybePromise.all(preconditionsMapped).then(() => {
        this.debugLog.log("done awaiting preconditions");
      });
    } else {
      pPrecond = MaybePromise.resolve(undefined);
    }
    return pPrecond.then(() => {
      this.debugLog.log(`starting up submodules...`);
      return this.runSubmoduleFns("startup");
    }).then(() => {
      this.debugLog.log(`starting up self...`);
      return this.runSelfFn("startup");
    }).then(() => {
      this.debugLog.log("done starting up self and submodules");
    });
  }

  private shutdown_(): MaybePromise<void> {
    return MaybePromise.
        all(this.shutdownPreconditions).
        then(() => this.runSelfFn("shutdown")).
        then(() => this.runSubmoduleFns("shutdown"));
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

  private runSubmoduleFns(fnName: "startup" | "shutdown"): MaybePromise<void> {
    const p = MaybePromise.all(
        this.getSubmodules().
        filter((m) => fnName in m).
        map((m) => m[fnName]!()),
    ) as MaybePromise<any>;
    p.catch(this.log.onError(`submodule ${fnName}`));
    this.dChildBootstrap[fnName].resolve(p.toPromise());
    return p;
  }

  private runSelfFn(fnName: "startup" | "shutdown"): MaybePromise<void> {
    const selfFnName =
        `${fnName}Self` as "startupSelf" | "shutdownSelf";
    const p = this[selfFnName] ?
        this[selfFnName]() :
        MaybePromise.resolve(undefined);
    p.catch(this.log.onError(`self-${fnName}`));
    this.dSelfBootstrap[fnName].resolve(p.toPromise());
    return p;
  }

  private getStartupPreconditions() {
    return this.dependencies.map((m) => m.whenReady).
        concat(this.startupPreconditions);
  }
}
