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

/* global Components */
const {utils: Cu} = Components;

/* exported SingleTopicObserver */
this.EXPORTED_SYMBOLS = ["SingleTopicObserver"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

//==============================================================================
// Observer (metaclass)
//==============================================================================

/**
 * Generic Observer class.
 */
function Observer(aCallback) {
  // As the `observe` function, take directly the parameter.
  this.observe = aCallback;

  // currently this obserer is not rgistered yet
  this.isRegistered = false;

  // register this observer
  this.register();
}
Observer.prototype.register = function() {
  if (!this.isRegistered) {
    this._register();
    this.isRegistered = true;
  }
};
Observer.prototype.unregister = function() {
  if (this.isRegistered) {
    this._unregister();
    this.isRegistered = false;
  }
};

//==============================================================================
// SingleTopicObserver
//==============================================================================

/**
 * An instance of this class registers itself to `nsIObserverService` on behalf
 * of some other object.
 */
function SingleTopicObserver(aTopic, aCallback) {
  this.topic = aTopic;
  Observer.call(this, aCallback);
}
SingleTopicObserver.prototype = Object.create(Observer.prototype);
SingleTopicObserver.prototype.constructor = Observer;

SingleTopicObserver.prototype._register = function() {
  Services.obs.addObserver(this, this.topic, false);
};
SingleTopicObserver.prototype._unregister = function() {
  Services.obs.removeObserver(this, this.topic);
};
