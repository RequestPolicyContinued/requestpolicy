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

import { App } from "app/interfaces";
import { API, XPCOM } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

export class ChromeStyleSheets extends Module
    implements App.windows.IChromeStyleSheets {
  private STYLE_SHEETS = [
    "chrome://rpcontinued/skin/requestpolicy.css",
    (this.legacyMiscInfos && this.legacyMiscInfos.isSeamonkey) ?
        "chrome://rpcontinued/skin/toolbarbutton-seamonkey.css" :
        "chrome://rpcontinued/skin/toolbarbutton.css",
  ];

  constructor(
      parentLog: Common.ILog,
      private readonly sss: XPCOM.nsIStyleSheetService,
      private readonly legacyMiscInfos: API.IMiscInfos | null,
      private readonly uriService: App.services.IUriService,
  ) {
    super("app.windows.stylesheets", parentLog);
  }

  protected startupSelf() {
    this.loadStyleSheets();
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf() {
    this.unloadStyleSheets();
    return MaybePromise.resolve(undefined);
  }

  private loadStyleSheets() {
    for (const styleSheet of this.STYLE_SHEETS) {
      const styleSheetURI = this.uriService.getUriObject(styleSheet);
      this.sss.loadAndRegisterSheet(styleSheetURI, this.sss.AUTHOR_SHEET);
    }
  }

  private unloadStyleSheets() {
    for (const styleSheet of this.STYLE_SHEETS) {
      const styleSheetURI = this.uriService.getUriObject(styleSheet);
      if (this.sss.sheetRegistered(styleSheetURI, this.sss.AUTHOR_SHEET)) {
        this.sss.unregisterSheet(styleSheetURI, this.sss.AUTHOR_SHEET);
      }
    }
  }
}
