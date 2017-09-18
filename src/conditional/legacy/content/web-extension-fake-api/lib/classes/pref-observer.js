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

import {MapOfSets} from "lib/classes/map-of-sets";
import {Prefs} from "web-extension-fake-api/models/prefs";

// =============================================================================
// PrefObserver
// =============================================================================

export function PrefObserver() {
  this._maps = {
    // Storage for listeners.
    domainsToListeners: new MapOfSets(),

    // Storage for observers.
    domainsToObservers: new Map()
  };
}

/**
 * @param {string} aDomain The preference on which to listen for changes.
 * @param {Function} aListener The callback.
 */
PrefObserver.prototype.addListener = function(aDomain, aListener) {
  if (false === this._maps.domainsToObservers.has(aDomain)) {
    // start to observe this Pref Domain
    let observer = {
      observe: this._onObserve.bind(this, aDomain)
    };
    Prefs._addObserver(aDomain, observer);
    this._maps.domainsToObservers.set(aDomain, observer);
  }

  this._maps.domainsToListeners.addToSet(aDomain, aListener);
};

PrefObserver.prototype.addListeners = function(aDomains, aListener) {
  for (let domain of aDomains) {
    this.addListener(domain, aListener);
  }
};

/**
 * @param {string} aDomain The preference which is being observed for changes.
 * @param {Function} aListener The callback.
 */
PrefObserver.prototype.removeListener = function(aDomain, aListener) {
  this._maps.domainsToListeners.deleteFromSet(aDomain, aListener);

  // no more listeners?
  if (false === this._maps.domainsToListeners.has(aDomain)) {
    // stop to observe this Pref Domain
    let observer = this._maps.domainsToObservers.get(aDomain);
    Prefs._removeObserver(aDomain, observer);
    this._maps.domainsToObservers.delete(aDomain);
  }
};

PrefObserver.prototype.removeListeners = function(aDomains, aListener) {
  for (let domain of aDomains) {
    this.removeListener(domain, aListener);
  }
};

/**
 * Remove all listeners in this Pref Observer.
 */
PrefObserver.prototype.removeAllListeners = function() {
  for (let domain of this._maps.domainsToListeners.keys()) {
    let listeners = this._maps.domainsToListeners.get(domain);
    for (let listener of listeners.values()) {
      this.removeListener(domain, listener);
    }
  }
};

/**
 * Callback for nsIObserver.observe(). Call (notify) all listeners.
 *
 * @param {string} aDomain The Pref Domain of the corresponding observer.
 * @param {nsIPrefBranch} aSubject The pref branch.
 * @param {string} aTopic Always "nsPref:changed".
 * @param {string} aData The name of the preference which has changed,
 *     relative to the "root" of the aSubject branch.
 */
PrefObserver.prototype._onObserve = function(aDomain, aSubject, aTopic, aData) {
  let prefName = aData;
  let listeners = this._maps.domainsToListeners.get(aDomain);
  for (let listener of listeners.values()) {
    listener.call(null, prefName);
  }
};
