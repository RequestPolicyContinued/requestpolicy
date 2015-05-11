/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

/* global Components */
/* exported EXPORTED_SYMBOLS, ObserverManager */

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["ObserverManager"];

let globalScope = this;

/* global ScriptLoader */
Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/utils/observers", /* global SingleTopicObserver,
                            SinglePrefBranchObserver */
  "lib/environment" /* global Environment, ProcessEnvironment */
], globalScope);

ScriptLoader.defineLazyModuleGetters({
  "lib/prefs": [
    "rpPrefBranch", /* global rpPrefBranch */
    "rootPrefBranch" /* global rootPrefBranch */
  ]
}, globalScope);



// Load the Logger at startup-time, not at load-time!
// ( On load-time Logger might be null. )
let Logger;
ProcessEnvironment.addStartupFunction(Environment.LEVELS.BACKEND, function() {
  Logger = ScriptLoader.importModule("lib/logger").Logger;
});




/**
 * An ObserverManager provides an interface to `nsIObserverService` which takes
 * care of unregistering the observed topics. Every ObserverManager is bound to
 * an environment.
 */
function ObserverManager(aEnv) {
  let self = this;

  self.environment = aEnv;

  if (!!aEnv) {
    self.environment.addShutdownFunction(
        Environment.LEVELS.INTERFACE,
        function() {
          // unregister when the environment shuts down
          self.unregisterAllObservers();
        });
  } else {
    // aEnv is not defined! Try to report an error.
    if (!!Logger) {
      Logger.warning(Logger.TYPE_INTERNAL, "No Environment was specified for " +
                     "a new ObserverManager! This means that the observers " +
                     "won't be unregistered!");
    }
  }

  // an object holding all observers for unregistering when unloading the page
  self.observers = [];
}


/**
 * Define 'observe' functions. Those function can be called from anywhere;
 * the caller hands over an object with the keys being the "IDs" and the values
 * being the function that should be called when the "ID" is observed.
 *
 * The "ID" for each function might be something different.
 */
{
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
  ObserverManager.prototype.observeSingleTopic = function(aTopic, aCallback) {
    let self = this;
    self.observers.push(new SingleTopicObserver(aTopic, aCallback));
  };

  /**
   * Observe multiple topics.
   *
   * @param {Array} aTopics - A list of topics to be observed.
   * @param {function} aCallback - the function to be called when one of the
   *     the topics is observed.
   */
  ObserverManager.prototype.observe = function(aTopics, aCallback) {
    let self = this;
    aTopics.forEach(function(topic) {
      self.observeSingleTopic(topic, aCallback);
    });
  };

  /**
   * A shorthand for calling observe() with topic "requestpolicy-prefs-changed".
   */
  ObserverManager.prototype.observePrefChanges = function(aCallback) {
    let self = this;
    self.observeSingleTopic("requestpolicy-prefs-changed", aCallback);
  };

  //
  // functions using nsIPrefBranch
  //

  /**
   * Observe one single subdomain of a Pref Branch (using nsIPrefBranch).
   * Details: https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefBranch#addObserver%28%29
   *
   * @param {string} aTopic - The topic to be observed.
   * @param {Function} aCallback - The observer's callback function.
   */
  ObserverManager.prototype.observeSinglePrefBranch = function(aPrefBranch,
                                                               aDomain,
                                                               aCallback) {
    let self = this;
    let obs = new SinglePrefBranchObserver(aPrefBranch, aDomain, aCallback);
    self.observers.push(obs);
  };

  ObserverManager.prototype.observeRPPref = function(aDomains, aCallback) {
    let self = this;
    aDomains.forEach(function(domain) {
      self.observeSinglePrefBranch(rpPrefBranch, domain, aCallback);
    });
  };
  ObserverManager.prototype.observeRootPref = function(aDomains, aCallback) {
    let self = this;
    aDomains.forEach(function(domain) {
      self.observeSinglePrefBranch(rootPrefBranch, domain, aCallback);
    });
  };
}



/**
 * The function will unregister all registered observers.
 */
ObserverManager.prototype.unregisterAllObservers = function() {
  let self = this;
  while (self.observers.length > 0) {
    let observer = self.observers.pop();
    observer.unregister();
  }
};
