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

import {log} from "app/log";
import { API, XPCOM, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";
import * as XULUtils from "lib/utils/xul-utils";

// -----------------------------------------------------------------------------
// non-Australis
//   - Firefox < 29
//   - SeaMonkey
//   - Pale Moon
// -----------------------------------------------------------------------------

export class NonAustralisToolbarButton extends Module {
  private toolbarButtonId = "/* @echo ALPHABETICAL_ID */ToolbarButton";

  private isAustralis = this.miscInfos.isAustralis;

  constructor(
      parentLog: Common.ILog,
      windowID: number,
      private window: XUL.chromeWindow,

      private readonly vc: XPCOM.nsIVersionComparator,
      private readonly miscInfos: API.IMiscInfos,
  ) {
    super(`app.windows[${windowID}].toolbarbutton`, parentLog);
  }

  protected startupSelf() {
    if (!this.isAustralis) {
      XULUtils.addTreeElementsToWindow(this.window, "toolbarbutton");
      this.addToolbarButtonToNavBar();
    }
    return Promise.resolve();
  }

  protected shutdownSelf() {
    if (!this.isAustralis) {
      XULUtils.removeTreeElementsFromWindow(this.window, "toolbarbutton");
    }
    return Promise.resolve();
  }

  private addToolbarButtonToNavBar() {
    // SeaMonkey users have to use a toolbar button now. At the moment I can't
    // justify a bunch of special cases to support the statusbar when such a
    // tiny number of users have seamonkey and I can't even be sure that many
    // of those users want a statusbar icon.
    // if (!LegacyApi.miscInfos.isFirefox) {
    //   log.info(
    //     "Not performing toolbar button check: not Firefox.");
    //   return;
    // }
    const doc = this.window.document;

    let isFirstRun = false;
    if (this.vc.compare(this.miscInfos.lastAppVersion, "0.0") <= 0) {
      log.info("This is the first run.");
      isFirstRun = true;
    }

    const id = this.toolbarButtonId;

    // find the toolbar in which the button has been placed by the user
    const toolbarSelector = `[currentset^='${id},'],[currentset*=',${id
    },'],[currentset$=',${id}']`;
    let toolbar = doc.querySelector(toolbarSelector);

    if (!toolbar) {
      // The button is in none of the toolbar "currentset"s. Either this is
      // the first run or the button has been removed by the user (through
      // customizing)
      if (isFirstRun) {
        toolbar = doc.getElementById("nav-bar")!;
        (toolbar as any).insertItem(id);
        toolbar.setAttribute("currentset", (toolbar as any).currentSet);
        (doc as any).persist(toolbar.id, "currentset");
      }
    } else {
      // find the position of the button and insert.
      const currentset = toolbar.getAttribute("currentset")!.split(",");
      const index = currentset.indexOf(id);

      let before = null;
      for (let i = index + 1, len = currentset.length; i < len; i++) {
        before = doc.getElementById(currentset[i]);
        if (before) {
          (toolbar as any).insertItem(id, before);
          break;
        }
      }
      if (!before) {
        (toolbar as any).insertItem(id);
      }
    }
  }
}
