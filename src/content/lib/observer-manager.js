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

// TODO: convert this file into a module, as we now have `ProcessEnvironment`
//       which handles startup and shutdown and can be imported from anywhere.

/**
 * The ObserverManager provides an interface to `nsIObserverService` which takes
 * care of unregistering the observed topics.
 * There are two ways how to get an instance of this manager.
 *   (a) if the topics should be observed only as long as a DOM Window lives,
 *       then this *.js file should be loaded **directly** into that window.
 *   (b) if the topics should be observed as long as RP is activated, then the
 *       **module** `observer-manager.jsm` has to be used instead.
 *
 * Note that when this file is loaded directly (case (a)), the ObserverManager
 * is created only once, i.e. if it is not existant yet!
 */
var ObserverManager = ObserverManager || (function() {
  let self = {};


  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;

  let ScriptLoader;
  {
    let mod = {};
    Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm", mod);
    ScriptLoader = mod.ScriptLoader;
  }
  let Logger;
  let {ProcessEnvironment} = ScriptLoader.importModule("process-environment");


  /**
   * This Object registers itself to `nsIObserverService` on behalf of some other
   * object. The `observe` function called by `nsIObserverService` is handed over
   * by the *real* observer.
   */
  function SingleTopicObserver(aTopic, aFunctionToCall) {
    // save the parameters
    this.topic = aTopic;
    this.observe = aFunctionToCall;

    // currently this obserer is not rgistered yet
    this.isRegistered = false;

    // register this observer
    this.register();
  }
  SingleTopicObserver.prototype.register = function() {
    if (!this.isRegistered) {
      Services.obs.addObserver(this, this.topic, false);
      this.isRegistered = true;
    }
  };
  SingleTopicObserver.prototype.unregister = function() {
    if (this.isRegistered) {
      Services.obs.removeObserver(this, this.topic);
      this.isRegistered = false;
    }
  };





  // an object holding all observers for unregistering when unloading the page
  let observers = [];

  /**
   * This function can be called from anywhere; the caller hands over an object
   * with the keys being the *topic* and the values being the function that
   * should be called when the topic is observed.
   */
  self.observe = function(aList) {
    for (let topic in aList) {
      if (aList.hasOwnProperty(topic)) {
        observers.push(new SingleTopicObserver(topic, aList[topic]));
      }
    }
  };

  self.observePrefChanges = self.observe.bind(self,
      "requestpolicy-prefs-changed");





  ProcessEnvironment.enqueueStartupFunction(function() {
    // Load the Logger now, not earlier. Otherwise it could be null.
    Logger = ScriptLoader.importModule("logger").Logger;
  });

  /**
   * The function will unregister all registered observers.
   */
  ProcessEnvironment.pushShutdownFunction(function() {
    while (observers.length > 0) {
      let observer = observers.pop();
      Logger.dump("Unregistering observer for topic " + observer.topic);
      observer.unregister();
    }
  });

  return self;
}());
