/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

var EXPORTED_SYMBOLS = ['Telemetry'];

Components.utils.import('resource://requestpolicy/Logger.jsm');

const TELEMETRY_SEND_INTERVAL = 1 * 60 * 1000;

const TELEMETRY_SEND_URL = 'https://telemetry.requestpolicy.com/api/rp.study.submit/';

// After this date, the study will certainly have been ended. No new events
// will be generated after this date. No new data will be stored locally after
// this date. Any locally stored data will be deleted the first time the browser
// starts after this date.
const END_DATE = new Date(2013, 1, 1, 0, 0, 0, 0);

var profileID = 0;

var consentID = 0;

var sessionID = 0;

var enabled = false;

var eventID = 0;

var globalEventID = 0;

var queue = [];

var rp = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
    .getService(Components.interfaces.nsIRequestPolicy).wrappedJSObject;


function getRandomID() {
  var min = 1;
  var max = 10e16;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTimestamp() {
  return Date.now();
}

function getEventID() {
  return ++eventID;
}

function getGlobalEventID() {
  globalEventID++;
  rp.prefs.setIntPref('study.globalEventID', globalEventID);
  rp.globalEventIDChanged = true;
  return globalEventID;
}

/*
 * When final is true, synchronous communication will be used because the
 * browser is shutting down.
 */
function sendEvents(events, final) {
  try {
    var formData = Components.classes["@mozilla.org/files/formdata;1"]
      .createInstance(Components.interfaces.nsIDOMFormData);
    formData.append('events', JSON.stringify(events));

    var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Components.interfaces.nsIXMLHttpRequest);

    if (!final) {
      req.addEventListener('load', function(event) {
        Logger.dump('Telemetry events sending success');
      }, false);
      req.addEventListener('error', function(event) {
        reenqueue(events);
        Logger.dump('Telemetry events sending failure: ' + event);
      }, false);
    } else {
      Logger.dump('Telemetry events sending sync');
    }

    req.open('POST', TELEMETRY_SEND_URL, !final);
    // When sending sync, send() can raise an exception.
    req.send(formData);

    if (final) {
      if (req.status == 200) {
        Logger.dump('Telemetry events final sending success');
      } else {
        Logger.dump('Telemetry events final sending failure: ' + req.status);
      }
    }
  } catch (e) {
    Logger.dump('Telemetry events sending failure: ' + e);
  }
}

function processQueue(synchronous) {
  if (queue.length == 0) {
    return;
  }
  var events = queue;
  queue = [];
  var final = synchronous ? true : false;
  sendEvents(events, final);
}

function enqueue(event) {
  queue.push(event);
  Logger.dump('Telemetry queue size: ' + queue.length);
}

function reenqueue(events) {
  queue = events.concat(queue);
  Logger.dump('Telemetry queue size: ' + queue.length);
}

/**
 * Telemetry: reporting data back to the developers.
 */
var Telemetry = {

  isPastEndDate: function() {
    return new Date() > END_DATE;
  },

  setEnabled : function(isEnabled) {
    enabled = isEnabled;
  },

  getEnabled : function() {
    return enabled;
  },

  track : function(name, properties) {
    try {
      if (!enabled || this.isPastEndDate()) {
        return;
      }
      if (!profileID || !consentID || !sessionID) {
        Logger.dump('Telemetry::track ignored: a required ID is not set: ' +
            profileID + ' / ' + consentID + ' / ' + sessionID);
        return;
      }

      var event = {};
      event.pid = profileID;
      event.cid = consentID;
      event.sid = sessionID;
      event.eid = getEventID();
      event.geid = getGlobalEventID();
      event.ts = getTimestamp();
      event.name = name;
      if (properties) {
        event.props = properties;
      }
      enqueue(event);
    } catch (e) {}
  },

  setProfileID : function(id) {
    profileID = parseInt(id);
    Logger.dump('Telemetry profileID: ' + id);
  },

  setConsentID : function(id) {
    consentID = id;
    Logger.dump('Telemetry consentID: ' + id);
  },

  setSessionID : function(id) {
    sessionID = id;
    Logger.dump('Telemetry sessionID: ' + id);
  },

  setGlobalEventID : function(id) {
    globalEventID = id;
    Logger.dump('Telemetry globalEventID: ' + id);
  },

  generateProfileID : function() {
    return getRandomID();
  },

  /**
   * For use when the browser is shutting down: manually process the queue.
   */
  processQueue : function(timer, synchronous) {
    processQueue(synchronous);
  }

};


var timer = Components.classes["@mozilla.org/timer;1"].createInstance(
  Components.interfaces.nsITimer);
timer.initWithCallback(Telemetry.processQueue, TELEMETRY_SEND_INTERVAL,
                       Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
