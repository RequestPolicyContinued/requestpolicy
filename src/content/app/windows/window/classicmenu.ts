/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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
import { XUL } from "bootstrap/api/interfaces";
import { Common } from "common/interfaces";
import { Module } from "lib/classes/module";
import * as DOMUtils from "lib/utils/dom-utils";

export interface IClassicmenuRuleSpec {
  allow: boolean;
  origin?: string | null;
  dest?: string | null;
  temp?: boolean;
}

// tslint:disable:member-ordering

export class ClassicMenu extends Module {
  protected get dependencies(): Module[] {
    return [
      this.policy,
    ];
  }

  constructor(
      parentLog: Common.ILog,
      windowID: number,
      private readonly window: XUL.chromeWindow,
      private readonly policy: App.IPolicy,
  ) {
    super(
        `app.windows[${windowID}].classicmenu`,
        parentLog,
    );
  }

  /**
   * Remove all menu items and all event listeners.
   */
  public emptyMenu(menu: XUL.menupopup) {
    const menuitems = menu.getElementsByTagName("menuitem");
    for (const item of Array.from(menuitems)) {
      if (!item.hasOwnProperty("rpListener")) {
        console.error("There's a menuitem without listener!");
        continue;
      }

      item.removeEventListener("command", (item as any).rpListener, false);
      delete (item as any).rpListener;
    }
    DOMUtils.removeChildren(menu);
  }

  public addMenuSeparator(menu: XUL.menupopup) {
    const separator = this.window.document.createElement("menuseparator");
    menu.insertBefore(separator, menu.firstChild);
    return separator;
  }

  public addCustomMenuItem(
      menu: XUL.menupopup,
      label: string,
      aCallback: () => void,
  ) {
    const menuItem = this.window.document.createElement("menuitem");
    menuItem.setAttribute("label", label);
    menuItem.addEventListener("command", aCallback, false);
    (menuItem as any).rpListener = aCallback;
    // menuItem.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
    menu.insertBefore(menuItem, menu.firstChild);
    return menuItem;
  }

  private getInfoFromRuleSpec(aRuleSpec: IClassicmenuRuleSpec) {
    const isTemp = "temp" in aRuleSpec && aRuleSpec.temp;
    const isAllow = "allow" in aRuleSpec && aRuleSpec.allow;
    const hasOrigin = "origin" in aRuleSpec && aRuleSpec.origin;
    const hasDest = "dest" in aRuleSpec && aRuleSpec.dest;
    const type =
        (isTemp ? "t" : "") +
        (isAllow ? "a" : "d") +
        (hasOrigin ? "o" : "") +
        (hasDest ? "d" : "");
    return Object.freeze({isTemp, isAllow, hasOrigin, hasDest, type});
  }

  public addMenuItem(
      aMenu: XUL.menupopup,
      aRuleSpec: IClassicmenuRuleSpec,
      aOnRedirectAllowed: () => void,
  ) {
    const {isTemp, isAllow, hasOrigin, hasDest, type} =
        this.getInfoFromRuleSpec(aRuleSpec);

    if (!isAllow) {
      console.error("Invalid addMenuItem rule-spec:");
      console.dir(aRuleSpec);
      return;
    }

    let labelName;
    switch (type) {
      case "tao":
        labelName = "allowOriginTemporarily";
        break;
      case "ao":
        labelName = "allowOrigin";
        break;
      case "taod":
        labelName = "allowOriginToDestinationTemporarily";
        break;
      case "aod":
        labelName = "allowOriginToDestination";
        break;
      case "tad":
        labelName = "allowDestinationTemporarily";
        break;
      case "ad":
        labelName = "allowDestination";
        break;
      default:
        console.error("Invalid addMenuItem rule-spec:");
        console.dir(aRuleSpec);
        return;
    }

    const originAndOrDestArray: string[] = []; // contains origin and/or dest
    if (hasOrigin) {
      originAndOrDestArray.push(aRuleSpec.origin!);
    }
    if (hasDest) {
      originAndOrDestArray.push(aRuleSpec.dest!);
    }
    Object.freeze(originAndOrDestArray);

    const callbackFn = () => {
      this.policy.addRuleBySpec(aRuleSpec);
      aOnRedirectAllowed();
    };
    const label = browser.i18n.getMessage(labelName, originAndOrDestArray);

    const item = this.addCustomMenuItem(aMenu, label, callbackFn);
    if (isTemp) {
      item.setAttribute("class", "rpcontinuedTemporary");
    }
    return item;
  }
}
