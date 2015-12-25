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
const {interfaces: Ci, utils: Cu} = Components;

/* exported Windows */
this.EXPORTED_SYMBOLS = ["Windows"];

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

let {ScriptLoader: {importModule}} = Cu.import(
    "chrome://rpcontinued/content/lib/script-loader.jsm", {});
let {MapOfSets} = importModule("lib/classes/map-of-sets");

//==============================================================================
// LoadAndUnloadListener
//==============================================================================

function LoadAndUnloadListener(callback) {
  let windows = new Set();

  function _onEvent(event) {
    let document = event.target;
    let window = document.defaultView;

    let windowtype = document.documentElement.getAttribute("windowtype");
    if (windowtype !== "navigator:browser") {
      // stop listening on this window
      _removeEventListener("load", window);
      _removeEventListener("unload", window);
      windows.delete(window);
      return;
    }

    switch (event.type) {
      case "load": {
        _removeEventListener("load", window);
        _addEventListener("unload", window);
        callback.call(null, "load", window);
        break;
      }

      case "unload": {
        _removeEventListener("unload", window);
        windows.delete(window);
        callback.call(null, "unload", window);
        break;
      }

      default:
        break;
    }
  }

  function _addEventListener(eventName, window) {
    window.addEventListener(eventName, _onEvent, false);
  }

  function _removeEventListener(eventName, window) {
    window.removeEventListener(eventName, _onEvent);
  }

  this.listenTo = function(eventName, window) {
    if (eventName !== "load" && eventName !== "unload") {
      throw "incorrect event type!";
    }
    windows.add(window);
    _addEventListener(eventName, window);
  };

  this.stopListeningOnAllWindows = function() {
    for (let window of windows.values()) {
      _removeEventListener("load", window);
      _removeEventListener("unload", window);
      windows.delete(window);
    }
    windows.clear();
  };
}

//==============================================================================
// Windows
//==============================================================================

var Windows = (function() {
  let self = {};

  self.forEachOpenWindow = function(aCallback) {
    // Apply a function to all open browser windows
    let windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let window = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
      aCallback.call(null, window);
    }
  };

  return self;
}());

//==============================================================================
// Windows (listening functionality)
//==============================================================================

(function(self) {
  let topicsToListeners = new MapOfSets();

  function onEvent(eventType, window) {
    if (topicsToListeners.has(eventType)) {
      let listeners = [...topicsToListeners.get(eventType)];
      if (eventType === "unload") {
        // the most recent listeners should be called first
        listeners.reverse();
      }
      for (let listener of listeners) {
        listener.call(null, window);
      }
    }
  }

  let loadAndUnloadListener = new LoadAndUnloadListener(onEvent);

  let windowMediatorListener = {
    onOpenWindow: function(xulWindow) {
      let window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow);
      loadAndUnloadListener.listenTo("load", window);
    },
    onCloseWindow: function(xulWindow) {},
    onWindowTitleChange: function(xulWindow, newTitle) {}
  };

  //----------------------------------------------------------------------------
  // exported functions
  //----------------------------------------------------------------------------

  self.addListener = function(aEventType, aListener) {
    if (aEventType !== "load" && aEventType !== "unload") {
      throw "incorrect event type!";
    }
    topicsToListeners.addToSet(aEventType, aListener);
  };

  self.removeListener = function(aEventType, aListener) {
    topicsToListeners.deleteFromSet(aEventType, aListener);
  };

  //----------------------------------------------------------------------------
  // bootstrap functions, called by the controller
  //----------------------------------------------------------------------------

  let listening = false;

  self._startListening = function() {
    if (listening === false) {
      Services.wm.addListener(windowMediatorListener);
      listening = true;

      self.forEachOpenWindow(function(window) {
        loadAndUnloadListener.listenTo("unload", window);
      });
    }
  };

  self._stopListening = function() {
    if (listening === true) {
      Services.wm.removeListener(windowMediatorListener);
      listening = false;
      loadAndUnloadListener.stopListeningOnAllWindows();
    }
  };

  return self;
}(Windows));
