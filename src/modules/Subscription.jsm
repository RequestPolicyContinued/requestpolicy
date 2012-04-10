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

var EXPORTED_SYMBOLS = ["UserSubscriptions", "SubscriptionList", "Subscription",
      "SUBSCRIPTION_UPDATED_TOPIC", "SUBSCRIPTION_ADDED_TOPIC",
      "SUBSCRIPTION_REMOVED_TOPIC"];

Components.utils.import("resource://requestpolicy/FileUtil.jsm");
Components.utils.import("resource://requestpolicy/Logger.jsm");
Components.utils.import("resource://requestpolicy/Policy.jsm");
Components.utils.import("resource://requestpolicy/PolicyStorage.jsm");


const SUBSCRIPTION_UPDATED_TOPIC = 'requestpolicy-subscription-policy-updated';
const SUBSCRIPTION_ADDED_TOPIC = 'requestpolicy-subscription-policy-added';
const SUBSCRIPTION_REMOVED_TOPIC = 'requestpolicy-subscription-policy-removed';

const DEFAULT_SUBSCRIPTION_LIST_URL_BASE = 'http://subscription.requestpolicy.com/subs/';

const SUBSCRIPTION_UPDATE_SUCCESS = 'SUCCESS';
const SUBSCRIPTION_UPDATE_NOT_NEEDED = 'NOT_NEEDED';
const SUBSCRIPTION_UPDATE_FAILURE = 'FAILURE';


var observerService = Components.classes["@mozilla.org/observer-service;1"].
      getService(Components.interfaces.nsIObserverService);


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

/**
 * Represents all of the subscriptions a user has enabled. This is where user
 * subscription information is stored and provides the mechanism for updating
 * subscriptions.
 */
function UserSubscriptions() {
  var userSubsFile = FileUtil.getRPUserDir();
  userSubsFile.appendRelativePath('subscriptions.json');
  try {
    var jsonData = FileUtil.fileToString(userSubsFile);
  } catch (e) {
    // TODO: make sure this is NS_ERROR_FILE_NOT_FOUND
    jsonData = '{}';
  }
  this._data = JSON.parse(jsonData);
  if (!this._data['lists']) {
    // By default, the user is subscribed to all subscriptions in the official
    // subscription list.
    // The value that corresponds to each subscription name is an empty object
    // for now but in the future we may indicate additional information there.
    // TODO: we should have a pref that disables automatically subscribing to
    // official lists when the subscriptions.json file is missing.
    this._data['lists'] = {
      'official' : {
        'subscriptions' : {
          'embedded' : {},
          'extensions' : {},
          'functionality' : {},
          'mozilla' : {},
          'sameorg' : {},
          'trackers' : {}
        }
      }
    }
  }
  this._lists = this._data['lists'];
}

UserSubscriptions.prototype = {
  toString : function () {
    return "[UserSubscriptions]";
  },

  save : function() {
    var userSubsFile = FileUtil.getRPUserDir();
    userSubsFile.appendRelativePath('subscriptions.json');
    FileUtil.stringToFile(JSON.stringify(this._data), userSubsFile);
  },

  getSubscriptionInfo : function() {
    var lists = this._data['lists'];
    var result = {};
    for (var listName in lists) {
      if (!lists[listName]['subscriptions']) {
        continue;
      }
      result[listName] = {};
      for (var subName in lists[listName]['subscriptions']) {
        result[listName][subName] = null;
      }
    }
    return result;
  },

  addSubscription : function(listName, subName) {
    var lists = this._data['lists'];
    if (!lists[listName]) {
      lists[listName] = {};
    }
    if (!lists[listName]['subscriptions']) {
      lists[listName]['subscriptions'] = {};
    }
    lists[listName]['subscriptions'][subName] = {};
    this.save();
  },

  removeSubscription : function(listName, subName) {
    var lists = this._data['lists'];
    if (lists[listName] && lists[listName]['subscriptions'] &&
      lists[listName]['subscriptions'][subName]) {
      delete lists[listName]['subscriptions'][subName];
    }
    this.save();
  },

  // This method kinda sucks. Maybe move this to a worker and write this
  // procedurally instead of event-driven. That is, the async requests really
  // make a big fat mess of the code, or more likely I'm just not good at
  // making it not a mess. On the other hand, this parallelizes the update
  // requests, though that may not be a great thing in this case.
  update : function (callback, serials) {
    var updatingLists = {};
    var updateResults = {};

    function recordDone(listName, subName, result) {
      dprint('Recording done: ' + listName + ' ' + subName);
      if (subName) {
        updateResults[listName][subName] = result;
        var list = updatingLists[listName];
        delete list[subName];
        for (var i in list) {
          return;
        }
      }
      delete updatingLists[listName];
      for (var i in updatingLists) {
        return;
      }
      setTimeout(function () { callback(updateResults); }, 0);
    }

    var listCount = 0;
    for (var listName in serials) {
      if (!this._lists[listName] || !this._lists[listName]['subscriptions']) {
        dprint('Skipping unsubscribed list: ' + listName);
        continue;
      }
      let updateSubs = {};
      var subCount = 0;
      for (var subName in serials[listName]) {
        if (!this._lists[listName]['subscriptions'][subName]) {
          dprint('Skipping unsubscribed policy: ' + listName + ' ' + subName);
          continue;
        }
        updateSubs[subName] = {'serial' : serials[listName][subName]};
        subCount++;
      }
      if (subCount == 0) {
        dprint('Skipping list with no subscriptions: ' + listName);
        continue;
      }
      var url = this._lists[listName]['url'];
      if (!url) {
        url = DEFAULT_SUBSCRIPTION_LIST_URL_BASE + listName + '.json';
      }
      if (!url) {
        dprint('Skipping list without url: ' + listName);
        continue;
      }
      var list = new SubscriptionList(listName, url);
      updatingLists[listName] = {};
      for (var subName in updateSubs) {
        dprint('Will update subscription: ' + listName + ' ' + subName);
        updatingLists[listName][subName] = true;
      }
      updateResults[listName] = {};

      function metadataSuccess(list) {
        function subSuccess(sub, status) {
          dprint('Successfully updated subscription ' + sub.toString());
          recordDone(list._name, sub._name, status);
        }

        function subError(sub, error) {
          dprint('Failed to update subscription ' + sub.toString() + ': ' +
                error);
          recordDone(list._name, sub._name, SUBSCRIPTION_UPDATE_FAILURE);
        }

        dprint('Successfully updated list ' + list.toString());
        list.updateSubscriptions(updateSubs, subSuccess, subError);
      }

      function metadataError(list, error) {
        dprint('Failed to update list: ' + list.toString() + ': ' + error);
        updateResults[listName] = false;
        recordDone(list._name);
      }

      listCount++;
      dprint('Will update list: ' + listName);
      list.updateMetadata(metadataSuccess, metadataError);
    }

    if (listCount == 0) {
      dprint('No lists to update.');
      setTimeout(function () { callback(updateResults); }, 0);
    }
  }
};


/**
 * Represents a list of available subscriptions. Any actual subscription belongs
 * to a list. Each list has a unique name and within each list every
 * subscription has a unique name. The available subscriptions in the list is
 * determined by downloading a metadata file which specifies the subscription
 * names, the url for each subscription, and the subscription's current serial
 * number. If the the user's current copy of a subscription policy has a serial
 * number that is not lower than the one listed, an update isn't necessary.
 *
 * @param name
 * @param url
 */
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
    for (var subName in userSubs) {
      try {
        var serial = this.getSubscriptionSerial(subName);
        dprint('Current serial for ' + this._name + ' ' + subName + ': ' +
               userSubs[subName]['serial']);
        dprint('Available serial for ' + this._name + ' ' + subName + ': ' +
               serial);
        var subUrl = this.getSubscriptionUrl(subName);
        var sub = new Subscription(this._name, subName, subUrl);
        if (serial > userSubs[subName]['serial']) {
          sub.update(successCallback, errorCallback);
        } else {
          dprint('No update needed for ' + this._name + ' ' + subName);
          let curSub = sub;
          setTimeout(function () {
            successCallback(curSub, SUBSCRIPTION_UPDATE_NOT_NEEDED);
          }, 0);
        }
      } catch (e) {
        let curSub = sub;
        setTimeout(function () { errorCallback(curSub, e.toString()); }, 0);
      }
    }
  },

//  getSubscriptionNames : function () {
//    var names = [];
//    for (var subName in this._data['subscriptions']) {
//      names.push(subName);
//    }
//    return names;
//  },

  getSubscriptionSerial : function (subName) {
    return this._data['subscriptions'][subName]['serial'];
  },

  getSubscriptionUrl : function (subName) {
    return this._data['subscriptions'][subName]['url'];
  }
};


/**
 * Represents a particular subscription policy available through a given
 * subscription list.
 *
 * @param listName
 * @param subName
 * @param subUrl
 */
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
        var subInfo = {};
        subInfo[self._list] = {};
        subInfo[self._list][self._name] = true;
        observerService.notifyObservers(null, SUBSCRIPTION_UPDATED_TOPIC,
              JSON.stringify(subInfo));
        setTimeout(function () {
              successCallback(self, SUBSCRIPTION_UPDATE_SUCCESS);
        }, 0);
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
