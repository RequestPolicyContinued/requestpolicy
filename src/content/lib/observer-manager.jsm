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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["ObserverManager"];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");

let {ProcessEnvironment} = ScriptLoader.importModule("process-environment");

// Load the Logger at startup-time, not at load-time!
// ( On load-time Looger might be null. )
let Logger;
ProcessEnvironment.enqueueStartupFunction(function() {
  Logger = ScriptLoader.importModule("logger").Logger;
});


/**
 * The ObserverManager provides an interface to `nsIObserverService` which takes
 * care of unregistering the observed topics.
 */
let ObserverManager = (function() {
  let self = {};

  /**
   * This Object registers itself to `nsIObserverService` on behalf of some other
   * object.
   */
  function SingleTopicObserver(aTopic, aFunctionToCall) {
    // save the parameters
    this.topic = aTopic;
    // As the `observe` function, take directly the parameter.
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
