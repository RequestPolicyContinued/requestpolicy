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
import { API, JSMs } from "bootstrap/api/interfaces";
import * as XULUtils from "bootstrap/api/services/xul-service";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";

// -----------------------------------------------------------------------------
// Australis (Firefox >= 29)
// -----------------------------------------------------------------------------

export class AustralisToolbarButton extends Module {
  private isAustralis = this.miscInfos.isAustralis;

  constructor(
      parentLog: Common.ILog,
      private readonly mozCustomizableUI: JSMs.CustomizableUI | null,
      private readonly miscInfos: API.IMiscInfos,
  ) {
    super(`app.windows.toolbarbutton`, parentLog);
  }

  protected startupSelf() {
    if (this.isAustralis) {
      this.addToolbarButtonToAustralis();
    }
    return MaybePromise.resolve(undefined);
  }

  protected shutdownSelf() {
    if (this.isAustralis) {
      this.removeToolbarButtonFromAustralis();
    }
    return MaybePromise.resolve(undefined);
  }

  private removeToolbarButtonFromAustralis() {
    const {
      attributes: {id},
    } = XULUtils.xulTrees.toolbarbutton[0];
    this.mozCustomizableUI!.destroyWidget(id);
  }

  private addToolbarButtonToAustralis() {
    const {
      attributes: {id, label, tooltiptext},
    } = XULUtils.xulTrees.toolbarbutton[0];

    this.mozCustomizableUI!.createWidget({
      defaultArea: this.mozCustomizableUI!.AREA_NAVBAR,
      id,
      label,
      onCommand: (aEvent: Event) => {
        // Bad smell
        const win: any = (aEvent.target as Element).ownerDocument.defaultView;
        const overlay = win.rpcontinued.overlay as App.windows.window.IOverlay;
        overlay.toggleMenu();
      },
      tooltiptext,
    });
  }
}
