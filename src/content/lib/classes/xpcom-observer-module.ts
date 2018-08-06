/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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

import { XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

// "known" observer topics
export type XPCOMObserverTopic =
    "http-on-modify-request" |
    "https-everywhere-uri-rewrite" |
    "sessionstore-windows-restored";

export type XPCOMObserverCallback<T = any> = (
    subject: XPCOM.nsISupports,
    topic: XPCOMObserverTopic,
    data: T,
) => void;

export class XPCOMObserverModule extends Module {
  constructor(
      aModuleName: string,
      aParentLog: Common.ILog,
      private readonly callbacks: {
        [key: string]: XPCOMObserverCallback;
      },
      private readonly observerService: XPCOM.nsIObserverService,
  ) {
    super(aModuleName, aParentLog);
  }

  public get topics(): string[] {
    return Object.keys(this.callbacks);
  }

  public observe(
      aSubject: XPCOM.nsISupports,
      aTopic: XPCOMObserverTopic,
      aData: string,
  ) {
    this.callbacks[aTopic](aSubject, aTopic, aData);
  }

  protected startupSelf() {
    this.topics.forEach((topic) => {
      this.observerService.addObserver(this, topic, false);
    });
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf() {
    this.topics.forEach((topic) => {
      this.observerService.removeObserver(this, topic);
    });
    return MaybePromise.resolve(undefined);
  }
}
