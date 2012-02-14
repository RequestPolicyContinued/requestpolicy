/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2012 Justin Samuel
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

var EXPORTED_SYMBOLS = ["UserSubscriptions", "SubscriptionList", "Subscription"];

Components.utils.import("resource://requestpolicy/Logger.jsm");
Components.utils.import("resource://requestpolicy/Policy.jsm");
Components.utils.import("resource://requestpolicy/PolicyStorage.jsm");


function setTimeout(func, delay) {
  var timer = Components.classes["@mozilla.org/timer;1"]
        .createInstance(Components.interfaces.nsITimer);
  var event = {notify: function() { func() }};
  timer.initWithCallback(event, delay,
        Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  return timer;
}


function dprint(msg) {
  if (typeof print == "function") {
    print(msg);
  } else {
    Logger.info(Logger.TYPE_INTERNAL, msg);
  }
}

function dwarn(msg) {
  Logger.warning(Logger.TYPE_INTERNAL, msg);
}


function UserSubscriptions() {
  this._lists = {
    'official' : {
      'url' : 'http://localhost/requestpolicy/subscriptions/official.json',
      'subscriptions' : {
        'embedded' : {
          'serial' : 1
        },
        'extensions' : {
          'serial' : 1
        },
        'functionality' : {
          'serial' : 1
        },
        'mozilla' : {
          'serial' : 1
        },
        'sameorg' : {
          'serial' : 1
        },
        'trackers' : {
          'serial' : 1
        }
      }
    }
  };
}

UserSubscriptions.prototype = {
  toString : function () {
    return "[UserSubscriptions]";
  },

  updateAll : function (callback) {
    var updatingLists = {};
    var updateResults = {};

    function recordSubscriptionDone(listName, subName, success) {
      updateResults[listName][subName] = success;
      delete updatingLists[listName][subName];
      for (var i in updatingLists[listName]) {
        return;
      }
      delete updatingLists[listName];
      for (var i in updatingLists) {
        return;
      }
      setTimeout(function () { callback(updateResults); }, 0);
    }

    for (var listName in this._lists) {
      var userSubs = this._lists[listName]['subscriptions'];
      if (!userSubs) {
        continue;
      }
      var url = this._lists[listName]['url'];
      var list = new SubscriptionList(listName, url);
      updatingLists[list._name] = userSubs;
      updateResults[list._name] = {};

      function metadataSuccess(list) {
        function subSuccess(sub) {
          dprint('Successfully updated subscription ' + sub.toString());
          recordSubscriptionDone(list._name, sub._name, true);
        }

        function subError(sub, error) {
          dprint('Failed to update subscription ' + sub.toString() + ': ' +
                error);
          recordSubscriptionDone(list._name, sub._name, false);
        }

        dprint('Successfully updated list ' + list.toString());
        list.updateSubscriptions(userSubs, subSuccess, subError);
      }

      function metadataError(list, error) {
        dprint('Failed to update list: ' + list.toString() + ': ' + error);
        updateResults[listName] = false;
      }

      list.updateMetadata(metadataSuccess, metadataError);
    }
  }
};

function SubscriptionList(name, url) {
  // TODO: allow only ascii lower letters, digits, and hyphens in name.
  this._name = name;
  this._url = url;
}

SubscriptionList.prototype = {
  _name : null,
  _url : null,
  _data : null,

  toString : function () {
    return "[SubscriptionList " + this._name + " " + this._url + "]";
  },

  updateMetadata : function (successCallback, errorCallback) {
    dprint('Updating ' + this.toString());
    var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Components.interfaces.nsIXMLHttpRequest);
    var self = this;
    req.onload = function (event) {
      try {
        self._data = JSON.parse(req.responseText);
        // Maybe we don't need to write this to a file since we never read it
        // back again (we always grab new metadata when updating).
        setTimeout(function () { successCallback(self); }, 0);
      } catch (e) {
        setTimeout(function () { errorCallback(self, e.toString()); }, 0);
      }
    };
    req.onerror = function (event) {
      setTimeout(function () { errorCallback(self, req.statusText); }, 0);
    };
    req.open('GET', this._url);
    req.send(null);
  },

  updateSubscriptions : function (userSubs, successCallback, errorCallback) {
    var listSubNames = this.getSubscriptionNames();
    for (var i = 0; i < listSubNames.length; i++) {
      var subName = listSubNames[i];
      var serial = this.getSubscriptionSerial(subName);
      if (serial > userSubs[subName]['serial']) {
        var subUrl = this.getSubscriptionUrl(subName);
        var sub = new Subscription(this._name, subName, subUrl);
        sub.update(successCallback, errorCallback);
      }
    }
  },

  getSubscriptionNames : function () {
    var names = [];
    for (var subName in this._data['subscriptions']) {
      names.push(subName);
    }
    return names;
  },

  getSubscriptionSerial : function (subName) {
    return this._data['subscriptions'][subName]['serial'];
  },

  getSubscriptionUrl : function (subName) {
    return this._data['subscriptions'][subName]['url'];
  }
};


function Subscription(listName, subName, subUrl) {
  // TODO: allow only ascii lower letters, digits, and hyphens in listName.
  this._list = listName;
  // TODO: allow only ascii lower letters, digits, and hyphens in subName.
  this._name = subName;
  this._url = subUrl;
}

Subscription.prototype = {
  _list : null,
  _name : null,
  _url : null,
  _data : null,

  toString : function () {
    return "[Subscription " + this._list + " " + this._name + " " + this._url + "]";
  },

  update : function (successCallback, errorCallback) {
    dprint('Updating ' + this.toString());

    var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Components.interfaces.nsIXMLHttpRequest);
    var self = this;
    req.onload = function (event) {
      try {
        self._rawData = req.responseText;
        if (!self._rawData) {
          var error = 'Empty response when requesting subscription file';
          setTimeout(function () { errorCallback(self, error); }, 0);
          return;
        }
        self._data = JSON.parse(req.responseText);
        // Make sure there's a ['metadata']['serial'] key as a way of sanity
        // checking the parsed JSON as well as enforcing the use of serial
        // numbers in subscription policies.
        try {
          var serial = self._data['metadata']['serial'];
        } catch (e) {
          var error = 'Policy has no serial number';
          setTimeout(function () { errorCallback(self, error); }, 0);
          return;
        }
        if (typeof serial != 'number' || serial % 1 != 0) {
          var error = 'Policy has invalid serial number: ' + serial;
          setTimeout(function () { errorCallback(self, error); }, 0);
          return;
        }
        // The rest of the sanity checking is done by RawPolicy().
        try {
          var rawPolicy = new RawPolicy(self._rawData);
          PolicyStorage.saveRawPolicyToFile(rawPolicy, self._name + '.json',
                self._list);
        } catch (e) {
          setTimeout(function () { errorCallback(self, e.toString()); }, 0);
          return;
        }
        setTimeout(function () { successCallback(self); }, 0);
      } catch (e) {
        setTimeout(function () { errorCallback(self, e.toString()); }, 0);
      }
    };
    req.onerror = function (event) {
      setTimeout(function () { errorCallback(self, req.statusText); }, 0);
    };
    req.open('GET', this._url);
    req.send(null);
  }

};
