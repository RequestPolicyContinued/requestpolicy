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

import {Info} from "lib/utils/info";

// =============================================================================
// StyleSheetsController
// =============================================================================

export const StyleSheetsController = (function() {
  let self = {};

  const STYLE_SHEETS = Object.freeze([
    "chrome://rpcontinued/skin/requestpolicy.css",
    Info.isSeamonkey ?
        "chrome://rpcontinued/skin/toolbarbutton-seamonkey.css" :
        "chrome://rpcontinued/skin/toolbarbutton.css",
  ]);

  function loadStyleSheets() {
    let styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);

    for (let styleSheet of STYLE_SHEETS) {
      let styleSheetURI = Services.io.newURI(styleSheet, null, null);
      styleSheetService.loadAndRegisterSheet(styleSheetURI,
          styleSheetService.AUTHOR_SHEET);
    }
  }

  function unloadStyleSheets() {
    let styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);

    for (let styleSheet of STYLE_SHEETS) {
      let styleSheetURI = Services.io.newURI(styleSheet, null, null);
      if (styleSheetService.sheetRegistered(styleSheetURI,
              styleSheetService.AUTHOR_SHEET)) {
        styleSheetService.unregisterSheet(styleSheetURI,
            styleSheetService.AUTHOR_SHEET);
      }
    }
  }

  self.startup = function() {
    loadStyleSheets();
  };

  self.shutdown = function() {
    unloadStyleSheets();
  };

  return self;
})();
