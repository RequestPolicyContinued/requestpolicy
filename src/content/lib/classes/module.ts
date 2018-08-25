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
import {
  defer,
  mapObjectValues,
  objectEntries,
  objectify,
  objectValues,
} from "lib/utils/js-utils";

const MAX_WAIT_FOR_STARTUP_SECONDS = 15;
const MAX_STARTUP_SECONDS = 15;

const TERMS = {
  dependencies: {singular: "dependency", plural: "dependencies"},
  preconditions: {singular: "precondition", plural: "preconditions"},
  submodules: {singular: "submodule", plural: "submodules"},
};

interface IObject<T> { [name: string]: T; }

export type StartupState =
    "not yet initialized" |
    "not yet started" |
    "starting up" |
    "startup done";
export type ShutdownState =
    "not yet shut down" |
    "shutting down" |
    "shutdown done";
type PromiseState = "not awaiting" | "awaiting" | "done" | "failed";

export class Module {
  protected log: Common.ILog;
  protected get debugEnabled() { return false; }
  protected debugLog: Common.ILog;

  // tslint:disable-next-line:variable-name
  private _startupState: StartupState = "not yet started";
  protected get startupState() { return this._startupState; }
  private get startupCalled() {
    return !(this.startupState in ["not yet initialized", "not yet started"]);
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

  private dependents: Set<Module> = new Set();

  private startupPromiseStates = {
    dependencies: {} as IObject<PromiseState>,
    preconditions: {} as IObject<PromiseState>,
    submodules: {} as IObject<PromiseState>,
  };

  protected get subModules(): {[key: string]: Module} {
    return {};
  }

  protected get dependencies(): {[name: string]: Module} {
    return {};
  }

  protected get startupPreconditions(): IObject<Promise<void>> {
    return {};
  }

  private timedOutWaitingForStartup = false;
  private timedOutStartingUp = false;
  private creationTime: number;
  private startupStartTime: number;
  private startupEndTime: number;

  constructor(
      public readonly moduleName: string,
      protected parentLog: Common.ILog,
  ) {
    this.log = parentLog.extend({name: moduleName});
    this.debugLog = this.log.extend({enabled: this.debugEnabled, level: "all"});
  }

  public startup(): Promise<void> {
    if (this.startupState !== "not yet started") {
      this.log.error("startup() has already been called!");
    } else {
      this.setStartupState("starting up");

      this.initPromiseStates("dependencies");
      this.initPromiseStates("preconditions");
      this.initPromiseStates("submodules");

      const p = this.startup_().then(() => {
        this.setStartupState("startup done");
      });
      p.catch(this.log.onError("error on startup"));
      this.dReady.resolve(p);
    }
    return this.whenReady;
  }

  public shutdown() {
    const allModules = new Set(this.recursivelyGetSubmodules());
    for (let n = 1000; n > 0; --n) { // n is just an arbitrary number
      if (allModules.size === 0) break;
      const shutDownModules: Module[] = [];
      for (const m of allModules.values()) {
        if (m.dependents.size === 0) {
          m.shutdown_();
          shutDownModules.push(m);
        }
      }
      if (shutDownModules.length === 0) {
        const msg = "all remaining modules have dependents!";
        const infos = Array.from(allModules.values()).map(
            (m) => [
              m.moduleName,
              Array.from(m.dependents.values()).map((d) => d.moduleName),
            ],
        ).reduce(objectify, {});
        this.log.error(msg, infos);
        throw new Error(msg);
      }
      for (const m of shutDownModules) {
        allModules.delete(m);
      }
    }
  }

  public isReady() { return this.ready; }

  public registerDependent(dependent: Module) {
    return this.dependents.add(dependent);
  }

  public unregisterDependent(dependent: Module) {
    return this.dependents.delete(dependent);
  }

  protected startupSelf(): MaybePromise<void> {
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf(): void {
    return;
  }

  protected recursivelyGetSubmodules(): Module[] {
    let modules = objectValues(this.subModules);
    objectValues(this.subModules).forEach((submodule) => {
      modules = modules.concat(submodule.recursivelyGetSubmodules());
    });
    return modules;
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

  private startup_(): Promise<void> {
    return this.awaitPreconditions().then(() => {
      this.debugLog.log("starting up submodules");
      this.startupSubmodules();
      return Promise.all([
        this.awaitSubmodules(),
        this.awaitDependencies(),
      ]);
    }).then(() => {
      this.debugLog.log(`starting up self...`);
      // NOTE: While on startup we await all submodules to finish,
      //   on shutdown we won't.
      for (const m of objectValues(this.dependencies)) {
        m.registerDependent(this);
      }
      return this.startupSelf();
    }).then(() => {
      this.debugLog.log("done starting up self");
    });
  }

  private shutdown_() {
    this.debugLog.log("shutting down self...");
    try {
      this.shutdownSelf();
      this.debugLog.log("done shutting down self.");
    } catch (e) {
      this.log.error("failed to shut down self", e);
    }
    for (const m of objectValues(this.dependencies)) {
      m.unregisterDependent(this);
    }
  }

  private startupSubmodules(): MaybePromise<void> {
    const p = MaybePromise.all(
        objectValues(this.subModules).
        map((m) => m.startup()),
    ) as MaybePromise<any>;
    p.catch(this.log.onError(`submodule startup`));
    return p;
  }

  private initPromiseStates(
      term: "dependencies" | "preconditions" | "submodules",
  ) {
    const states = this.startupPromiseStates[term];
    Object.keys(states).forEach((key) => {
      states[key] = "not awaiting";
    });
  }

  private assertStartupState(state: StartupState): void | never {
    if (this._startupState === state) return;
    const msg = `Module "${this.moduleName}" should be in state "${state}", ` +
        `but it's in state "${this._startupState}"!`;
    this.log.error(msg);
    console.trace();
    throw new Error(msg);
  }

  private setStartupState(newState: StartupState) {
    const now = new Date().getTime();
    switch (newState) {
      case "not yet started":
        this.assertStartupState("not yet initialized");
        this.creationTime = now;
        this.startStartupInvocationWatchdog();
        break;

      case "starting up":
        this.assertStartupState("not yet started");
        this.startupStartTime = now;
        this.startStartupDoneWatchdog();

        if (this.timedOutWaitingForStartup) {
          const duration = (this.startupStartTime - this.creationTime) / 1000;
          this.log.error(
              `starting up... / needed to wait ${duration} seconds!`,
          );
        } else {
          this.debugLog.log("starting up...");
        }
        break;

      case "startup done":
        this.assertStartupState("starting up");
        this.startupEndTime = now;

        if (this.timedOutStartingUp) {
          const duration = (this.startupEndTime - this.startupStartTime) / 1000;
          // use log.error() because the earlier message ("startup
          // didn't finish yet") is an error as well.
          this.log.error(`startup done. startup took ${duration} seconds!`);
        } else {
          this.debugLog.log("startup done");
        }
        break;

      default:
        this.log.error(`invalid new state "${newState}"`);
        return;
    }
    this._startupState = newState;
  }

  private startStartupInvocationWatchdog() {
    this.setTimeout(() => {
      if (this.startupCalled) return;
      this.log.error(
          `[severe] startup() hasn't been invoked ` +
          `even after ${MAX_WAIT_FOR_STARTUP_SECONDS} seconds!`,
      );
    }, 1000 * MAX_WAIT_FOR_STARTUP_SECONDS);
  }

  private startStartupDoneWatchdog() {
    this.setTimeout(() => {
      if (this.ready) return;
      this.timedOutStartingUp = true;
      this.log.error(
          `startup didn't finish ` +
          `even after ${MAX_STARTUP_SECONDS} seconds!`,
          {
            startupPromiseStates: this.startupPromiseStates,
          },
      );
    }, 1000 * MAX_STARTUP_SECONDS);
  }

  private awaitPreconditions() {
    return this.awaitPromises(
        TERMS.preconditions,
        this.startupPreconditions,
        this.startupPromiseStates.preconditions,
    );
  }

  private awaitDependencies() {
    return this.awaitPromises(
        TERMS.dependencies,
        mapObjectValues(this.dependencies, (m) => m.whenReady),
        this.startupPromiseStates.dependencies,
    );
  }

  private awaitSubmodules() {
    return this.awaitPromises(
        TERMS.submodules,
        mapObjectValues(this.subModules, (m) => m.whenReady),
        this.startupPromiseStates.submodules,
    );
  }

  private awaitPromises(
      aTerm: {singular: string, plural: string},
      aPromises: IObject<Promise<void>>,
      aPromiseStates: IObject<PromiseState>,
  ): Promise<void> {
    const nPromises = Object.keys(aPromises).length;
    const termType = nPromises === 1 ? "singular" : "plural";
    const promisesMapped = objectEntries(aPromises).map(([key, p]) => {
      aPromiseStates[key] = "awaiting";
      return p.then(() => {
        aPromiseStates[key] = "done";
      }).catch((e) => {
        aPromiseStates[key] = "failed";
        return Promise.reject(e);
      });
    });
    this.debugLog.log(`awaiting ${nPromises} ${ aTerm[termType] }...`);
    return Promise.all(promisesMapped).then(() => {
      this.debugLog.log(`done awaiting ${aTerm.plural}.`);
    });
  }
}

// tslint:disable-next-line:max-classes-per-file
export class SimpleModule extends Module {
  constructor(
      moduleName: string,
      parentLog: Common.ILog,
      private readonly modulesAndDependencies: {
        dependencies?: IObject<Module>,
        subModules?: IObject<Module>,
        startupPreconditions?: IObject<Promise<void>>,
      },
  ) {
    super(moduleName, parentLog);
  }

  protected get subModules() {
    return this.modulesAndDependencies.subModules || {};
  }
  protected get dependencies() {
    return this.modulesAndDependencies.dependencies || {};
  }
  protected get startupPreconditions() {
    return this.modulesAndDependencies.startupPreconditions || {};
  }
}
