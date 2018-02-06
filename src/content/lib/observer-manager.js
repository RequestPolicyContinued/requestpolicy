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

import {XPCOMObserver} from "content/lib/classes/xpcom-observer";
import {Level as EnvLevel} from "content/lib/environment";
import {Log} from "content/models/log";

const log = Log.instance;

// =============================================================================
// ObserverManager
// =============================================================================

/**
 * An ObserverManager provides an interface to `nsIObserverService` which takes
 * care of unregistering the observed topics. Every ObserverManager is bound to
 * an environment.
 *
 * @param {Environment} aEnv
 */
export class ObserverManager {
  constructor(aEnv) {
    this.environment = aEnv;

    if (aEnv) {
      this.environment.addShutdownFunction(
          EnvLevel.INTERFACE,
          () => {
            // unregister when the environment shuts down
            this.unregisterAllObservers();
          }
      );
    } else {
      // aEnv is not defined! Try to report an error.
      if (log) {
        log.warn(
            "No Environment was specified for " +
            "a new ObserverManager! This means that the observers " +
            "won't be unregistered!"
        );
      }
    }

    // an object holding all observers for unregistering when unloading the page
    this.observers = [];
  }

  /**
   * Define 'observe' functions. Those function can be called from anywhere;
   * the caller hands over an object with the keys being the "IDs" and the
   * values being the function that should be called when the "ID" is observed.
   *
   * The "ID" for each function might be something different.
   */

  //
  // functions using nsIObserverService
  //

  /**
   * Observe one single topic by using nsIObserverService. Details:
   * https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIObserverService#addObserver%28%29
   *
   * @param {string} aTopic - The topic to be observed.
   * @param {Function} aCallback - The observer's callback function.
   */
  observeSingleTopic(aTopic, aCallback) {
    let self = this;
    self.observers.push(new XPCOMObserver(aTopic, aCallback));
  }

  /**
   * Observe multiple topics.
   *
   * @param {Array} aTopics - A list of topics to be observed.
   * @param {function} aCallback - the function to be called when one of the
   *     the topics is observed.
   */
  observe(aTopics, aCallback) {
    let self = this;
    aTopics.forEach(function(topic) {
      self.observeSingleTopic(topic, aCallback);
    });
  }

  /**
   * The function will unregister all registered observers.
   */
  unregisterAllObservers() {
    let self = this;
    while (self.observers.length > 0) {
      let observer = self.observers.pop();
      observer.unregister();
    }
  }
}
