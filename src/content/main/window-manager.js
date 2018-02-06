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

import {Level as EnvLevel, MainEnvironment} from "content/lib/environment";
import {Windows} from "content/models/windows";
import {OverlayController} from "content/controllers/windows.overlay";
import {ToolbarButtonController}
  from "content/controllers/windows.toolbarbutton";
import {StyleSheetsController} from "content/controllers/windows.style-sheets";
import {FramescriptServices} from "content/main/framescript-services";
import {pWindowsAvailable} from "content/models/ui-startup";
import {defer} from "content/lib/utils/js-utils";

// =============================================================================
// WindowSubControllers
// =============================================================================

let WindowSubControllers = (function() {
  let self = {};

  const SUBCONTROLLERS = Object.freeze([
    OverlayController,
    ToolbarButtonController,
    StyleSheetsController,
  ]);

  const SUBCONTROLLERS_REVERSE = Object.freeze(
      SUBCONTROLLERS.slice().reverse()
  );

  function callForEachController(fnName, reverse, ...args) {
    let controllers = reverse ? SUBCONTROLLERS_REVERSE : SUBCONTROLLERS;
    controllers.forEach(function(controller) {
      if (typeof controller[fnName] === "function") {
        controller[fnName].apply(null, args);
      }
    });
  }

  self.startup = callForEachController.bind(null, "startup", false);
  self.shutdown = callForEachController.bind(null, "shutdown", true);
  self.loadIntoWindow = callForEachController.bind(
      null, "loadIntoWindow",
      false
  );
  self.unloadFromWindow = callForEachController.bind(
      null, "unloadFromWindow",
      true
  );

  return self;
})();

// =============================================================================
// rpWindowManager
// =============================================================================

export const rpWindowManager = (function() {
  let self = {};

  const dStartup = defer();
  self.pStartup = dStartup.promise;

  let frameScriptURI =
      `chrome://rpcontinued/content/bootstrap-environments/framescript.js?${
        Math.random()}`;

  function loadIntoWindow(window) {
    WindowSubControllers.loadIntoWindow(window);
  }

  function unloadFromWindow(window) {
    WindowSubControllers.unloadFromWindow(window);
  }

  MainEnvironment.addStartupFunction(
      EnvLevel.INTERFACE,
      function() {
        pWindowsAvailable.then(() => {
          WindowSubControllers.startup();
          Windows.forEachOpenWindow(loadIntoWindow);
          Windows.addListener("load", loadIntoWindow);
          Windows.addListener("unload", unloadFromWindow);
          Windows._startListening();

          // init the FramescriptServices _before_ loading the framescripts
          FramescriptServices.init();

          // Load the framescript into all existing tabs.
          // Also tell the globalMM to load it into each new
          // tab from now on.
          Services.mm.loadFrameScript(frameScriptURI, true);

          dStartup.resolve();
          return;
        }).catch((e) => {
          console.error("rpWindowManager startup error:");
          console.dir(e);
        });
      }
  );

  MainEnvironment.addShutdownFunction(
      EnvLevel.INTERFACE,
      function() {
        // Stop loading framescripts into new tabs.
        // --------------------------
        // Note that it's not necessary to tell the framescripts'
        // environments to shut down. Instead:
        // - In case the window is closed, the framescript will shut
        //   down on the ContentFrameMessageManager's "unload" event.
        // - In case the addon is being disabled or firefox gets quit,
        //   the ParentProcessEnvironment will send a message to all
        //   children.
        Services.mm.removeDelayedFrameScript(frameScriptURI);

        Windows._stopListening();
        Windows.forEachOpenWindow(unloadFromWindow);
        WindowSubControllers.shutdown();
      }
  );

  return self;
})();
