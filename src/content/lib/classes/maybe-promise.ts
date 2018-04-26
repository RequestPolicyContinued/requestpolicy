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

import {isThenable} from "lib/utils/js-utils";

type IMaybePromiseSpec<T> = {
  status: "PROMISE";
  promise: Promise<T>;
} | {
  status: "fulfilled";
  resolutionValue: T;
} | {
  status: "rejected";
  rejectionValue: any;
};

export class MaybePromise<T> {
  public static resolve<U>(aVal: U | Promise<U> | MaybePromise<U>) {
    if (aVal instanceof MaybePromise) return aVal as MaybePromise<U>;
    if (isThenable(aVal)) {
      return new MaybePromise<U>({
        promise: aVal,
        status: "PROMISE",
      });
    } else {
      return new MaybePromise<U>({
        resolutionValue: aVal,
        status: "fulfilled",
      });
    }
  }

  public static reject<U>(aRejectValue: U) {
    return new MaybePromise({
      rejectionValue: aRejectValue,
      status: "rejected",
    });
  }

  private promise?: Promise<T>;
  private resolutionValue?: T;
  private rejectionValue?: any;
  private status: "PROMISE" | "fulfilled" | "rejected";

  private constructor(spec: IMaybePromiseSpec<T>) {
    this.status = spec.status;
    switch (spec.status) {
      case "PROMISE":
        this.promise = spec.promise;
        break;
      case "fulfilled":
        this.resolutionValue = spec.resolutionValue;
        break;
      case "rejected":
        this.rejectionValue = spec.rejectionValue;
        break;
    }
  }

  public then(
      aThen?: <U>(val: T) => U,
      aCatch?: (val: any) => any,
  ): any {
    if (this.status === "PROMISE") {
      return MaybePromise.resolve(this.promise!.then(aThen, aCatch));
    }
    if (this.status === "rejected") {
      if (aCatch) {
        try {
          return MaybePromise.resolve(aCatch(this.rejectionValue));
        } catch (e) {
          return MaybePromise.reject(e);
        }
      }
      return MaybePromise.reject(this.rejectionValue);
    }
    if (aThen) {
      try {
        return MaybePromise.resolve(aThen(this.resolutionValue!));
      } catch (e) {
        return MaybePromise.reject(e);
      }
    }
    return MaybePromise.resolve(this.resolutionValue);
  }

  public catch(aCatch: (val: any) => any) {
    return this.then(undefined, aCatch);
  }

  // ---------------------------------------------------------------------------

  public getStatus() { return this.status; }
  public isPromiseWrapper(): boolean { return this.status === "PROMISE"; }
  public isFulfilled(): boolean {
    this.assertIsNoPromiseWrapper();
    return this.status === "fulfilled";
  }
  public isRejected(): boolean {
    this.assertIsNoPromiseWrapper();
    return this.status === "rejected";
  }

  public toPromise(): Promise<T> {
    if (this.status === "PROMISE") return this.promise!;
    if (this.status === "fulfilled") {
      return Promise.resolve(this.resolutionValue!);
    }
    return Promise.reject(this.rejectionValue);
  }

  public getPromise(): Promise<T> {
    this.assertIsPromiseWrapper();
    return this.promise!;
  }

  public getValue(): T {
    this.assertIsNoPromiseWrapper();
    if (this.status === "rejected") {
      throw new Error("The MaybePromise has been rejected!");
    }
    return this.resolutionValue!;
  }

  public getRejectionValue(): any {
    this.assertIsNoPromiseWrapper();
    if (this.status === "fulfilled") {
      throw new Error("The MaybePromise has been fulfilled!");
    }
    return this.rejectionValue;
  }

  // ---------------------------------------------------------------------------

  private assertIsPromiseWrapper() {
    if (this.status !== "PROMISE") {
      throw new Error("The MaybePromise is NOT a Promise wrapper!");
    }
  }

  private assertIsNoPromiseWrapper() {
    if (this.status === "PROMISE") {
      throw new Error("The MaybePromise is a Promise wrapper!");
    }
  }
}
