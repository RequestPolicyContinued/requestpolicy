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

import {PolicyManager} from "lib/policy-manager";
import {StringUtils} from "lib/utils/strings";
import {DOMUtils} from "lib/utils/dom";

export function loadClassicmenuIntoWindow(window) {
  let self = {};

  let {document} = window;

  //============================================================================

  /**
   * Removes all menu items and removes all event listeners.
   */
  self.emptyMenu = function(menu) {
    var menuitems = menu.getElementsByTagName("menuitem");
    for (let item of menuitems) {
      if (!item.hasOwnProperty("rpListener")) {
        console.error("There's a menuitem without listener!");
        continue;
      }

      item.removeEventListener("command", item.rpListener, false);
      delete item.rpListener;
    }
    DOMUtils.removeChildren(menu);
  };

  self.addMenuSeparator = function(menu) {
    var separator = document.createElement("menuseparator");
    menu.insertBefore(separator, menu.firstChild);
    return separator;
  };

  self._addMenuItem = function(menu, label, aCallback) {
    var menuItem = document.createElement("menuitem");
    menuItem.setAttribute("label", label);
    menuItem.addEventListener("command", aCallback, false);
    menuItem.rpListener = aCallback;
    // menuItem.setAttribute("tooltiptext", node.getAttribute("tooltiptext"));
    menu.insertBefore(menuItem, menu.firstChild);
    return menuItem;
  };

  function getInfoFromRuleSpec(aRuleSpec) {
    const isTemp = "temp" in aRuleSpec && aRuleSpec.temp;
    const isAllow = "allow" in aRuleSpec && aRuleSpec.allow;
    const hasOrigin = "origin" in aRuleSpec && aRuleSpec.origin;
    const hasDest = "dest" in aRuleSpec && aRuleSpec.dest;
    const type = "" +
        (isTemp ? "t" : "") +
        (isAllow ? "a" : "d") +
        (hasOrigin ? "o" : "") +
        (hasDest ? "d" : "");
    return Object.freeze({isTemp, isAllow, hasOrigin, hasDest, type});
  }

  self.addMenuItem = function(aMenu, aRuleSpec, aAllowRedirectFn) {
    const {isTemp, isAllow, hasOrigin, hasDest, type} =
        getInfoFromRuleSpec(aRuleSpec);

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

    let originAndOrDestArray = []; // contains origin and/or dest
    if (hasOrigin) {
      originAndOrDestArray.push(aRuleSpec.origin);
    }
    if (hasDest) {
      originAndOrDestArray.push(aRuleSpec.dest);
    }
    originAndOrDestArray = Object.freeze(originAndOrDestArray);

    const callbackFn = function() {
      PolicyManager.addRuleBySpec(aRuleSpec);
      aAllowRedirectFn();
    };
    const label = StringUtils.$str(labelName, originAndOrDestArray);

    const item = self._addMenuItem(aMenu, label, callbackFn);
    if (isTemp) {
      item.setAttribute("class", "rpcontinuedTemporary");
    }
    return item;
  };

  window.rpcontinued.classicmenu = self;
}
