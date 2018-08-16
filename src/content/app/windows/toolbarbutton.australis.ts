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
import { API, JSMs, XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { Module } from "lib/classes/module";
import { TOOLBARBUTTON_ATTRIBUTES } from "ui/xul-trees";

// -----------------------------------------------------------------------------
// Australis (Firefox >= 29)
// -----------------------------------------------------------------------------

export class AustralisToolbarButton extends Module {
  private isAustralis = this.miscInfos.isAustralis;

  protected get dependencies(): Module[] {
    return [
      this.windowModuleMap,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      private readonly mozCustomizableUI: JSMs.CustomizableUI | null,
      private readonly miscInfos: API.IMiscInfos,
      private readonly windowModuleMap: App.windows.IWindowModuleMap,
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
    const {id} = TOOLBARBUTTON_ATTRIBUTES;
    this.mozCustomizableUI!.destroyWidget(id);
  }

  private addToolbarButtonToAustralis() {
    const {id, label, tooltiptext} = TOOLBARBUTTON_ATTRIBUTES;

    this.mozCustomizableUI!.createWidget({
      defaultArea: this.mozCustomizableUI!.AREA_NAVBAR,
      id,
      label,
      onCommand: (aEvent: Event) => {
        // Bad smell
        const doc =
            (aEvent.target as Element).ownerDocument as XUL.chromeDocument;
        const win = doc.defaultView as XUL.chromeWindow;
        const windowModule = this.windowModuleMap.get(win);
        windowModule!.overlay.toggleMenu();
      },
      tooltiptext,
    });
  }
}
