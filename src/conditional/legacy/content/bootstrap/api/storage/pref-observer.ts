/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2015 Martin Kimmerle
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

import { API } from "bootstrap/api/interfaces";
import { MapOfSets } from "lib/classes/map-of-sets";

type Listener = (prefName: string) => void;

export class PrefObserver {
  private maps = {
    // Storage for listeners.
    domainsToListeners: new MapOfSets<string, Listener>(),

    // Storage for observers.
    domainsToObservers: new Map(),
  };

  constructor(
      private rpPrefBranch: API.storage.IPrefBranch,
  ) {}

  /**
   * @param {string} aDomain The preference on which to listen for changes.
   * @param {Function} aListener The callback.
   */
  public addListener(aDomain: string, aListener: Listener) {
    if (false === this.maps.domainsToObservers.has(aDomain)) {
      // start to observe this Pref Domain
      const observer = {
        observe: this._onObserve.bind(this, aDomain),
      };
      this.rpPrefBranch.addObserver(aDomain, observer);
      this.maps.domainsToObservers.set(aDomain, observer);
    }

    this.maps.domainsToListeners.addToSet(aDomain, aListener);
  }

  public addListeners(aDomains: string[], aListener: Listener) {
    for (const domain of aDomains) {
      this.addListener(domain, aListener);
    }
  }

  /**
   * @param {string} aDomain The preference which is being observed for changes.
   * @param {Function} aListener The callback.
   */
  public removeListener(aDomain: string, aListener: Listener) {
    this.maps.domainsToListeners.deleteFromSet(aDomain, aListener);

    // no more listeners?
    if (false === this.maps.domainsToListeners.has(aDomain)) {
      // stop to observe this Pref Domain
      const observer = this.maps.domainsToObservers.get(aDomain);
      this.rpPrefBranch.removeObserver(aDomain, observer);
      this.maps.domainsToObservers.delete(aDomain);
    }
  }

  public removeListeners(aDomains: string[], aListener: Listener) {
    for (const domain of aDomains) {
      this.removeListener(domain, aListener);
    }
  }

  /**
   * Remove all listeners in this Pref Observer.
   */
  public removeAllListeners() {
    for (const domain of this.maps.domainsToListeners.keys()) {
      const listeners = this.maps.domainsToListeners.get(domain);
      for (const listener of listeners!.values()) {
        this.removeListener(domain, listener);
      }
    }
  }

  /**
   * Callback for nsIObserver.observe(). Call (notify) all listeners.
   *
   * @param {string} aDomain The Pref Domain of the corresponding observer.
   * @param {nsIPrefBranch} aSubject The pref branch.
   * @param {string} aTopic Always "nsPref:changed".
   * @param {string} aData The name of the preference which has changed,
   *     relative to the "root" of the aSubject branch.
   */
  public _onObserve(
      aDomain: string,
      aSubject: any,
      aTopic: string,
      aData: string,
  ) {
    const prefName = aData;
    const listeners = this.maps.domainsToListeners.get(aDomain);
    for (const listener of listeners!.values()) {
      listener.call(null, prefName);
    }
  }
}
