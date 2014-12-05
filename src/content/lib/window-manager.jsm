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
 * this program. If not, see {tag: "http"://www.gnu.org/licenses}.
 *
 * ***** END LICENSE BLOCK *****
 */

let EXPORTED_SYMBOLS = ["rpWindowManager"];

let globalScope = this;

let rpWindowManager = (function(self) {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;

  Cu.import("resource://gre/modules/Services.jsm", globalScope);
  Cu.import("resource://gre/modules/XPCOMUtils.jsm", globalScope);

  Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm", globalScope);
  ScriptLoader.importModules([
    "utils",
    "xul-utils",
    "constants",
    "bootstrap-manager"
  ], globalScope);

  let styleSheets = [
    "chrome://requestpolicy/skin/requestpolicy.css",
    "chrome://requestpolicy/skin/toolbarbutton.css"
  ];



  let WindowListener = {
    onOpenWindow: function(xulWindow) {
      let window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow);
      addEventListenersToWindow(window);
    },
    onCloseWindow: function(xulWindow) {},
    onWindowTitleChange: function(xulWindow, newTitle) {}
  }

  function addEventListenersToWindow(window) {
    function onLoad(event) {
      window.removeEventListener("load", onLoad);
      if (window.document.documentElement.getAttribute("windowtype") ==
          "navigator:browser") {
        loadIntoWindow(window);
      } else {
        window.removeEventListener("unload", onUnload);
      }
    }

    function onUnload(event) {
      window.removeEventListener("unload", onUnload);
      if (window.document.documentElement.getAttribute("windowtype") ==
          "navigator:browser") {
        unloadFromWindow(window);
      }
    }

    // Event handler for when the window is closed. We listen for "unload"
    // rather than "close" because "close" will fire when a print preview
    // opened from this window is closed.
    window.addEventListener("unload", onUnload, false);

    // Registers event handlers for documents loaded in the window.
    window.addEventListener("load", onLoad, false);
  }

  function loadIntoWindow(window) {
    XULUtils.addTreeElementsToWindow(window, "mainTree");

    // create a scope variable for RP for this window
    window.requestpolicy = {};
    Services.scriptloader.loadSubScript(
        "chrome://requestpolicy/content/ui/overlay.js", window);
    Services.scriptloader.loadSubScript(
        "chrome://requestpolicy/content/ui/menu.js", window);
    Services.scriptloader.loadSubScript(
        "chrome://requestpolicy/content/ui/classicmenu.js", window);

    self.addToolbarButtonToWindow(window);

    // init and onWindowLoad must be called last, because they assume that
    // everything else is ready
    window.requestpolicy.overlay.init();
    window.requestpolicy.overlay.onWindowLoad();
    window.messageManager.loadFrameScript(
        "chrome://requestpolicy/content/ui/frame.js", true);
  }

  function unloadFromWindow(window) {
    if (window.requestpolicy) {
      window.requestpolicy.overlay.onWindowUnload();
    }

    XULUtils.removeTreeElementsFromWindow(window, "mainTree");
    self.removeToolbarButtonFromWindow(window);

    delete window.requestpolicy;
  }







  BootstrapManager.registerStartupFunction(function(data, reason) {
    forEachOpenWindow(loadIntoWindow);
    Services.wm.addListener(WindowListener);

    loadStyleSheets();
  });

  BootstrapManager.registerShutdownFunction(function() {
    forEachOpenWindow(unloadFromWindow);
    Services.wm.removeListener(WindowListener);

    unloadStyleSheets();
  });





  function loadStyleSheets() {
    let styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);

    for (let i = 0, len = styleSheets.length; i < len; i++) {
      let styleSheetURI = Services.io.newURI(styleSheets[i], null, null);
      styleSheetService.loadAndRegisterSheet(styleSheetURI,
          styleSheetService.USER_SHEET);
    }
  }
  function unloadStyleSheets() {
    // Unload stylesheets
    let styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);

    for (let i = 0, len = styleSheets.length; i < len; i++) {
      let styleSheetURI = Services.io.newURI(styleSheets[i], null, null);
      if (styleSheetService.sheetRegistered(styleSheetURI,
          styleSheetService.USER_SHEET)) {
        styleSheetService.unregisterSheet(styleSheetURI,
            styleSheetService.USER_SHEET);
      }
    }
  }

  function forEachOpenWindow(functionToCall) {
    // Apply a function to all open browser windows
    let windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      functionToCall(windows.getNext().QueryInterface(Ci.nsIDOMWindow));
    }
  }


  return self;
}(rpWindowManager || {}));


// extend rpWindowManager
Services.scriptloader.loadSubScript(
    "chrome://requestpolicy/content/lib/window-manager-toolbarbutton.js",
    globalScope);
