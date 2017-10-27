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

import * as XULUtils from "content/lib/utils/xul-utils";
import {Info} from "content/lib/info";
import {Log} from "content/models/log";

let CustomizableUI = null;
if (Info.isAustralis) {
  ({CustomizableUI} = Cu.import("resource:///modules/CustomizableUI.jsm",
                                {}));
}

// =============================================================================
// ToolbarButtonController
// =============================================================================

export const ToolbarButtonController = (function() {
  let self = {};

  const toolbarButtonId = "rpcontinuedToolbarButton";

  let isAustralis = Info.isAustralis;

  // ---------------------------------------------------------------------------
  // Case 1: Australis (Firefox >= 29)
  // ---------------------------------------------------------------------------

  (function() {
    if (!isAustralis) {
      return;
    }

    function removeToolbarButtonFromAustralis() {
      const {
        attributes: {id},
      } = XULUtils.xulTrees.toolbarbutton[0];
      CustomizableUI.destroyWidget(id);
    }

    function addToolbarButtonToAustralis() {
      const {
        attributes: {id, label, tooltiptext},
      } = XULUtils.xulTrees.toolbarbutton[0];

      CustomizableUI.createWidget({
        id: id,
        defaultArea: CustomizableUI.AREA_NAVBAR,
        label: label,
        tooltiptext: tooltiptext,
        onCommand: function(aEvent) {
          // Bad smell
          let win = aEvent.target.ownerDocument.defaultView;
          win.rpcontinued.overlay.toggleMenu();
        },
      });
    }

    self.startup = function() {
      addToolbarButtonToAustralis();
    };

    self.shutdown = function() {
      removeToolbarButtonFromAustralis();
    };
  })();

  // ---------------------------------------------------------------------------
  // Case 2: non-Australis
  //   - Firefox < 29
  //   - SeaMonkey
  //   - Pale Moon
  // ---------------------------------------------------------------------------

  (function() {
    if (isAustralis) {
      return;
    }

    function addToolbarButtonToNavBar(win) {
      // SeaMonkey users have to use a toolbar button now. At the moment I can't
      // justify a bunch of special cases to support the statusbar when such a
      // tiny number of users have seamonkey and I can't even be sure that many
      // of those users want a statusbar icon.
      // if (!Info.isFirefox) {
      //   Log.info(
      //     "Not performing toolbar button check: not Firefox.");
      //   return;
      // }
      let doc = win.document;

      let isFirstRun = false;
      if (Services.vc.compare(Info.lastAppVersion, "0.0") <= 0) {
        Log.info("This is the first run.");
        isFirstRun = true;
      }

      let id = toolbarButtonId;

      // find the toolbar in which the button has been placed by the user
      let toolbarSelector = "[currentset^='" + id + ",'],[currentset*='," + id +
          ",'],[currentset$='," + id + "']";
      let toolbar = doc.querySelector(toolbarSelector);

      if (!toolbar) {
        // The button is in none of the toolbar "currentset"s. Either this is
        // the first run or the button has been removed by the user (through
        // customizing)
        if (isFirstRun) {
          toolbar = doc.getElementById("nav-bar");
          toolbar.insertItem(id);
          toolbar.setAttribute("currentset", toolbar.currentSet);
          doc.persist(toolbar.id, "currentset");
        }
      } else {
        // find the position of the button and insert.
        let currentset = toolbar.getAttribute("currentset").split(",");
        let index = currentset.indexOf(id);

        let before = null;
        for (let i = index + 1, len = currentset.length; i < len; i++) {
          before = doc.getElementById(currentset[i]);
          if (before) {
            toolbar.insertItem(id, before);
            break;
          }
        }
        if (!before) {
          toolbar.insertItem(id);
        }
      }
    }

    self.loadIntoWindow = function(win) {
      if (!isAustralis) {
        XULUtils.addTreeElementsToWindow(win, "toolbarbutton");
        addToolbarButtonToNavBar(win);
      }
    };

    self.unloadFromWindow = function(win) {
      XULUtils.removeTreeElementsFromWindow(win, "toolbarbutton");
    };
  })();

  return self;
})();
