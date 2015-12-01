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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

/* global Components */
const {interfaces: Ci, utils: Cu} = Components;

/* exported WindowListener */

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

//==============================================================================
// WindowListener
//==============================================================================

var WindowListener = (function() {
  let self = {};

  let nextWinID = 0;
  let listeners = {};


  let addEvLis = function(eventName, winID) {
    if (typeof listeners[winID] !== "undefined" &&
        listeners[winID][eventName] !== null) {
      listeners[winID].window.addEventListener(eventName,
                                               listeners[winID][eventName],
                                               false);
    }
  };

  let removeEvLis = function(eventName, winID) {
    if (typeof listeners[winID] !== 'undefined' &&
        listeners[winID][eventName] !== null) {
      listeners[winID].window.removeEventListener(eventName,
                                                  listeners[winID][eventName]);
      if (eventName === "unload") {
        // when removing the 'unload' listener, also remove the 'load'
        // listener and then delete listener[winID].
        removeEvLis("load", winID);
        // cleaning up -- listeners[winID] is not needed anymore
        delete listeners[winID];
      }
    }
  };



  // external functions to be called on "load" or "unload" events
  let externalLoadFunction = null;
  let externalUnloadFunction = null;
  self.setLoadFunction = function(f) {
    externalLoadFunction = f;
  };
  self.setUnloadFunction = function(f) {
    externalUnloadFunction = f;
  };



  let addEventListenersToWindow = function(window) {
    let winID = nextWinID++;

    // ===========================
    // create new functions specific for each window.
    // ----------------------------------------------
    let onLoad = function(event) {
      removeEvLis("load", winID);

      if (window.document.documentElement.getAttribute("windowtype") ===
          "navigator:browser") {
        if (!!externalLoadFunction) {
          externalLoadFunction(window);
        }
      } else {
        removeEvLis("unload", winID);
      }
    };
    let onUnload = function(event) {
      removeEvLis("unload", onUnload);

      if (window.document.documentElement.getAttribute("windowtype") ===
          "navigator:browser") {
        if (!!externalUnloadFunction) {
          externalUnloadFunction(window);
        }
      }
    };
    // ===========================

    listeners[winID] = {window: window, load: onLoad, unload: onUnload};

    // Event handler for when the window is closed. We listen for "unload"
    // rather than "close" because "close" will fire when a print preview
    // opened from this window is closed.
    addEvLis("unload", winID);

    // Registers event handlers for documents loaded in the window.
    addEvLis("load", winID);

    return winID;
  };


  function removeAllEventListeners() {
    for (let winID in listeners) {
      removeEvLis("load", winID);
      removeEvLis("unload", winID);
    }
    listeners = {};
    nextWinID = 0;
  }


  let listening = false;
  self.startListening = function() {
    if (listening === false) {
      Services.wm.addListener(WindowListener);
      listening = true;
    }
  };
  self.stopListening = function() {
    if (listening === true) {
      Services.wm.removeListener(WindowListener);
      listening = false;
    }
    // remove all "load" and "unload" event listeners.
    removeAllEventListeners();
  };



  self.onOpenWindow = function(xulWindow) {
    let window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindow);
    addEventListenersToWindow(window);
  };
  self.onCloseWindow = function(xulWindow) {};
  self.onWindowTitleChange = function(xulWindow, newTitle) {};

  return self;
}());
