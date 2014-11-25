/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

var ObserverManager = (function() {
  var self = {};

  // an object holding all observers for unregistering when unloading the page
  var observers = [];

  function Observer(aTopic, aFunctionToCall) {
    this.topic = aTopic;
    this.observe = aFunctionToCall;
    this.register();
    observers.push(this);
  }
  Observer.prototype.register = function() {
    Services.obs.addObserver(this, this.topic, false);
  };
  Observer.prototype.unregister = function() {
    Services.obs.removeObserver(this, this.topic);
  };


  // unregister all observers before the window is unloaded
  window.addEventListener("beforeunload", function(event) {
    while (observers.length > 0) {
      var observer = observers.pop();
      Logger.dump("Unregistering observer for topic " + observer.topic);
      observer.unregister();
    }
  });


  self.observe = function(aTopic, aFunctionToCall) {
    return new Observer(aTopic, aFunctionToCall);
  };

  self.observePrefChanges = self.observe.bind(this,
      "requestpolicy-prefs-changed");

  return self;
}());
