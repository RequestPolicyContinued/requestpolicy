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

import { API, XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import {Module} from "lib/classes/module";
import {IKeysWithDefaults} from "lib/classes/object-interface";
import {createListenersMap} from "lib/utils/listener-factories";

type xpcomPrefBranch = XPCOM.nsIPrefBranch;
type prefObserver = XPCOM.nsIObserver_without_nsISupports<xpcomPrefBranch>;

export class Storage extends Module {
  // protected get debugEnabled() { return true; }

  private events = createListenersMap(["onChanged"]);

  private ignorePrefObserverChangesTemporarily = false;
  private prefObserver: prefObserver = {
    observe: this.observePrefChange.bind(this),
  };
  private slsaChangedListener = this.onSlsaChanged.bind(this);

  constructor(
      log: Common.ILog,
      private slsa: API.storage.ISyncLocalStorageArea,
      private rpPrefBranch: API.storage.IPrefBranch,
  ) {
    super("API.storage", log);
  }

  public get backgroundApi() {
    return {
      local: {
        get: this.getLocal.bind(this),
        remove: this.removeLocal.bind(this),
        set: this.setLocal.bind(this),
      },
      onChanged: this.events.interfaces.onChanged,
    };
  }

  public get contentApi() {
    return this.backgroundApi;
  }

  protected startupSelf() {
    this.rpPrefBranch.addObserver("", this.prefObserver);
    this.slsa.onChanged.addListener(this.slsaChangedListener);
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf() {
    this.slsa.onChanged.removeListener(this.slsaChangedListener);
    this.rpPrefBranch.removeObserver("", this.prefObserver);
    return MaybePromise.resolve(undefined);
  }

  private getLocal(
      aKeys: string | string[] | IKeysWithDefaults | null | undefined,
  ) {
    try {
      return Promise.resolve(this.slsa.get(aKeys));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  private setLocal(aKeys: {[k: string]: any}) {
    this.ignorePrefObserverChangesTemporarily = true;
    try {
      return Promise.resolve(this.slsa.set(aKeys));
    } catch (e) {
      return Promise.reject(e);
    } finally {
      this.ignorePrefObserverChangesTemporarily = false;
    }
  }

  private removeLocal(aKeys: string | string[]): Promise<void> {
      this.ignorePrefObserverChangesTemporarily = true;
      try {
      const result = this.slsa.remove(aKeys);
      if (result && "errors" in result) {
        return Promise.reject(result.errors);
      }
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    } finally {
      this.ignorePrefObserverChangesTemporarily = false;
    }
  }

  private observePrefChange(
      aSubject: xpcomPrefBranch,
      aTopic: "nsPref:changed",
      aData: string,
  ) {
    if (this.ignorePrefObserverChangesTemporarily) return;
    const prefName = aData;
    const newValue = this.rpPrefBranch.get(prefName);
    const changes: browser.storage.ChangeDict = {
      [prefName]: newValue === undefined ? {} : {newValue},
    };
    this.debugLog.log(`emitting pref changes:`, changes);
    this.events.listenersMap.onChanged.emit(changes);
  }

  private onSlsaChanged(aChanges: browser.storage.ChangeDict) {
    this.debugLog.log(`emitting pref changes:`, aChanges);
    this.events.listenersMap.onChanged.emit(aChanges);
  }
}
