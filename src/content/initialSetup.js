/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

var rpModules;
if (rpModules === undefined) {
  rpModules = {};
}
Components.utils.import("resource://requestpolicy/Logger.jsm", rpModules);

requestpolicyInitialSetup = {

  _itemsByRegion : {
    "international" : [["*", "recaptcha.net"], ["yahoo.com", "yimg.com"],
        ["google.com", "googlehosted.com"], ["google.com", "gvt0.com"],
        ["google.com", "youtube.com"], ["google.com", "ggpht.com"],
        ["google.com", "gstatic.com"], ["gmail.com", "google.com"],
        ["googlemail.com", "google.com"], ["youtube.com", "ytimg.com"],
        ["youtube.com", "google.com"], ["youtube.com", "googlevideo.com"],
        ["live.com", "msn.com"], ["msn.com", "live.com"],
        ["live.com", "virtualearth.net"], ["live.com", "wlxrs.com"],
        ["hotmail.com", "passport.com"], ["passport.com", "live.com"],
        ["live.com", "hotmail.com"], ["microsoft.com", "msn.com"],
        ["microsoft.com", "live.com"], ["live.com", "microsoft.com"],
        ["facebook.com", "fbcdn.net"], ["myspace.com", "myspacecdn.com"],
        ["wikipedia.com", "wikipedia.org"], ["wikipedia.org", "wikimedia.org"],
        ["blogger.com", "google.com"], ["google.com", "blogger.com"],
        ["blogspot.com", "blogger.com"], ["flickr.com", "yimg.com"],
        ["flickr.com", "yahoo.com"], ["imdb.com", "media-imdb.com"],
        ["fotolog.com", "fotologs.net"], ["metacafe.com", "mcstatic.com"],
        ["metacafe.com", "mccont.com"], ["download.com", "com.com"],
        ["cnet.com", "com.com"], ["gamespot.com", "com.com"],
        ["sf.net", "sourceforge.net"], ["sourceforge.net", "fsdn.com"],
        ["mapquest.com", "mqcdn.com"], ["mapquest.com", "aolcdn.com"],
        ["mapquest.com", "aol.com"]],
    "americas" : [["orkut.com", "google.com"], ["orkut.com.br", "google.com"],
        ["uol.com.br", "imguol.com"], ["google.com", "orkut.com"]],
    "asia" : [["orkut.com", "google.com"], ["orkut.co.in", "google.com"],
        ["google.com", "orkut.com"], ["yahoo.co.jp", "yimg.jp"],
        ["sina.com.cn", "sinaimg.cn"], ["amazon.co.jp", "images-amazon.com"],
        ["amazon.cn", "images-amazon.com"], ["amazon.cn", "joyo.com"],
        ["joyo.com", "amazon.cn"], ["taobao.com", "taobaocdn.com"],
        ["163.com", "netease.com"], ["daum.net", "daum-img.net"],
        ["tudou.com", "tudouui.com"]],
    "us-canada" : [["ebay.ca", "ebaystatic.com"], ["ebay.ca", "ebay.com"],
        ["ebay.com", "ebay.ca"], ["ebay.com", "ebaystatic.com"],
        ["amazon.com", "images-amazon.com"],
        ["amazon.ca", "images-amazon.com"], ["aol.com", "aolcdn.com"],
        ["cnn.com", "turner.com"], ["cnn.com", "cnn.net"],
        ["tagged.com", "tagstat.com"], ["comcast.net", "cimcontent.net"],
        ["weather.com", "imwx.com"], ["netflix.com", "nflximg.com"]],
    "europe-russia" : [["ebay.de", "ebaystatic.com"], ["ebay.de", "ebay.com"],
        ["ebay.com", "ebay.de"], ["ebay.co.uk", "ebaystatic.com"],
        ["ebay.co.uk", "ebay.com"], ["ebay.com", "ebay.co.uk"],
        ["ebay.fr", "ebaystatic.com"], ["ebay.fr", "ebay.com"],
        ["ebay.com", "ebay.fr"], ["mail.ru", "imgsmail.ru"],
        ["amazon.de", "images-amazon.com"],
        ["amazon.co.uk", "images-amazon.com"],
        ["amazon.fr", "images-amazon.com"], ["yandex.ru", "yandex.net"],
        ["skyrock.com", "skyrock.net"], ["netlog.com", "netlogstatic.com"],
        ["rambler.ru", "rl0.ru"], ["orange.fr", "woopic.com"]],
    "oceania" : [["ebay.com.au", "ebaystatic.com"],
        ["ebay.com.au", "ebay.com"], ["ebay.com", "ebay.com.au"]]
  },

  _requestpolicy : null,
  _requestpolicyJSObject : null,
  _listbox : null,
  _checkboxes : null,
  _items : [],

  init : function() {
    this._requestpolicy = Components.classes["@requestpolicy.com/requestpolicy-service;1"]
        .getService(Components.interfaces.nsIRequestPolicy);
    this._listbox = document.getElementById("originsToDestinationsList");
    this._checkboxes = ["international", "americas", "asia", "us-canada",
        "europe-russia", "oceania"];
    this.buildList();
  },

  save : function() {
    for (var i = 0; i < this._items.length; i++) {
      rpModules.Logger.dump("Adding item to whitelist: " + this._items[i]);
      var origin = this._items[i][0];
      var dest = this._items[i][1];
      if (origin == "*") {
        this._requestpolicy.allowDestinationDelayStore(dest);
      } else if (dest == "*") {
        this._requestpolicy.allowOriginDelayStore(origin);
      } else {
        this._requestpolicy.allowOriginToDestinationDelayStore(origin, dest);
      }
    }
    // We delayed storage of the preference lists, so store the data now.
    this._requestpolicy.storeAllPreferenceLists();
    return true;
  },

  _clearList : function() {
    for (var i = this._listbox.itemCount - 1; i >= 0; i--) {
      this._listbox.removeItemAt(i);
    }
  },

  buildList : function() {
    this._items = [];
    for (var i = 0; i < this._checkboxes.length; i++) {
      var checkbox = document.getElementById(this._checkboxes[i]);
      if (checkbox.checked) {
        this._items = this._items.concat(this._itemsByRegion[checkbox.id]);
      }
    }
    this._items.sort(function(a, b) {
          var firstComp = a[0].localeCompare(b[0]);
          return firstComp ? firstComp : a[1].localeCompare(b[1]);
        });
    // Get rid of duplicates.
    if (this._items.length > 0) {
      var newItems = [this._items[0]];
      for (var i = 1; i < this._items.length; i++) {
        if (this._items[i][0] != this._items[i - 1][0]
            || this._items[i][1] != this._items[i - 1][1]) {
          newItems.push(this._items[i]);
        }
      }
      this._items = newItems;
    }
    this._clearList();
    this._addItemsToList(this._items);
  },

  _addItemsToList : function(items) {
    for (var i = 0; i < items.length; i++) {
      var item = document.createElement("listitem");
      item.setAttribute("value", items[i][0] + "|" + items[i][1]);
      // Create a cell for the origin.
      var cell = document.createElement("listcell");
      cell.setAttribute("label", items[i][0]);
      item.appendChild(cell);
      // Create a cell for the destination.
      cell = document.createElement("listcell");
      cell.setAttribute("label", items[i][1]);
      item.appendChild(cell);
      // Add the item to the listbox.
      this._listbox.appendChild(item);
    }
  }

};
