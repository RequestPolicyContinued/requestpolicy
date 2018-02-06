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

import {defer} from "content/lib/utils/js-utils";
import {Log} from "content/models/log";

export interface IModule {
  startup?: () => Promise<void>;
  shutdown?: () => Promise<void>;
  whenReady: Promise<void>;
}

export abstract class Module implements IModule {
  protected log: Log;

  protected abstract moduleName: string;
  protected subModules: {[key: string]: IModule} | undefined = undefined;
  protected dSelfReady = defer();

  public get whenReady() {
    let promises: Array<Promise<void>> = [
      this.dSelfReady.promise,
    ];
    if (this.subModules) {
      promises = promises.concat(
          Object.keys(this.subModules).
          map((key) => this.subModules![key]).
          map((m) => m.whenReady),
      );
    }
    const p = Promise.all(promises);
    p.catch(this.log.onError("whenReady"));
    return p.then(() => undefined);
  }

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

  constructor({log}: {log: Log}) {
    this.log = log.extend({name: this.moduleName});
  }

  public async startup(): Promise<void> {
    try {
      await Promise.all(this.startupPreconditions);
      await this.runSubmoduleFns("startup");
      await this.runSelfFn("startup");
      if (this.dSelfReady.promiseState === "pending") {
        this.dSelfReady.resolve(undefined);
      }
    } catch (e) {
      this.log.error("startup()", e);
      throw e;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await Promise.all(this.shutdownPreconditions);
      await this.runSelfFn("shutdown");
      await this.runSubmoduleFns("shutdown");
    } catch (e) {
      this.log.error("shutdown()", e);
      throw e;
    }
  }

  protected startupSelf(): Promise<void> {
    return Promise.resolve();
  }

  protected shutdownSelf(): Promise<void> {
    return Promise.resolve();
  }

  private async runSubmoduleFns(fnName: "startup" | "shutdown") {
    const p = this.subModules ? Promise.all(
        Object.keys(this.subModules).
        map((key) => this.subModules![key]).
        filter((m) => fnName in m).
        map((m) => m[fnName]!()),
    ) : Promise.resolve();
    p.catch(this.log.onError(`submodule ${fnName}`));
    this.dChildBootstrap[fnName].resolve(p);
  }

  private async runSelfFn(fnName: "startup" | "shutdown") {
    const selfFnName =
        `${fnName}Self` as "startupSelf" | "shutdownSelf";
    const p = this[selfFnName] ? this[selfFnName]!() : Promise.resolve();
    p.catch(this.log.onError(`self-${fnName}`));
    this.dSelfBootstrap[fnName].resolve(p);
  }
}
