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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

const toolbarButtonId = "requestpolicyToolbarButton";


Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules(["lib/utils/xul", "lib/utils", "lib/logger"], this);

if (Utils.info.isAustralis) {
  Components.utils.import("resource:///modules/CustomizableUI.jsm");
}



let rpWindowManager = (function(self) {

  let isAustralis = Utils.info.isAustralis;

  //
  // Case 1: Australis (Firefox >= 29)
  //

  if (isAustralis) {
    ProcessEnvironment.addStartupFunction(Environment.LEVELS.UI,
                                          addToolbarButtonToAustralis);
    ProcessEnvironment.addShutdownFunction(Environment.LEVELS.UI,
                                           removeToolbarButtonFromAustralis);
  }

  function removeToolbarButtonFromAustralis() {
    let tbb = XULUtils.xulTrees.toolbarbutton[0];
    CustomizableUI.destroyWidget(tbb.id);
  }

  function addToolbarButtonToAustralis() {
    let tbb = XULUtils.xulTrees.toolbarbutton[0];
    CustomizableUI.createWidget({
      id: tbb.id,
      defaultArea: CustomizableUI.AREA_NAVBAR,
      label: tbb.label,
      tooltiptext: tbb.tooltiptext,
      onCommand : function(aEvent) {
        // Bad smell
        let win = aEvent.target.ownerDocument.defaultView;
        win.requestpolicy.overlay.openToolbarPopup(aEvent.target);
      }
    });
  }


  //
  // Case 2: Gecko < 29
  //


  // this function can be deleted if Gecko < 29 isn't supported anymore
  self.addToolbarButtonToWindow = function(win) {
    if (!isAustralis) {
      XULUtils.addTreeElementsToWindow(win, "toolbarbutton");
      addToolbarButtonToNavBar(win);
    }
  };

  self.removeToolbarButtonFromWindow = function(win) {
    if (!isAustralis) {
      XULUtils.removeTreeElementsFromWindow(win, "toolbarbutton");
    }
  };


  function addToolbarButtonToNavBar(win) {
    // SeaMonkey users have to use a toolbar button now. At the moment I can't
    // justify a bunch of special cases to support the statusbar when such a
    // tiny number of users have seamonkey and I can't even be sure that many of
    // those users want a statusbar icon.
    //if (!Utils.info.isFirefox) {
    //  Logger.info(Logger.TYPE_INTERNAL,
    //    "Not performing toolbar button check: not Firefox.");
    //  return;
    //}
    let doc = win.document;

    let isFirstRun = false;
    if (Services.vc.compare(Utils.info.lastAppVersion, "0.0") <= 0) {
      Logger.info(Logger.TYPE_INTERNAL, "This is the first run.");
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


  return self;
}(rpWindowManager || {}));
