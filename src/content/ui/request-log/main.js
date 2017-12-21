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

import {loadRLInterfaceIntoWindow} from "./interface";
import {loadRLTreeViewIntoWindow} from "./tree-view";
import {loadRLFilteringIntoWindow} from "./filtering";

let {
  Environment,
  MainEnvironment,
} = browser.extension.getBackgroundPage();

window.rpcontinued = window.rpcontinued || {};
window.rpcontinued.requestLog = window.rpcontinued.requestLog || {};

(function() {
  let {requestLog} = window.rpcontinued;

  // ===========================================================================

  // create a new Environment for this window
  const WinEnv = new Environment(MainEnvironment, "WinEnv");
  // The Environment has to be shut down when the content window gets unloaded.
  WinEnv.shutdownOnUnload(window);
  // start up right now, as there won't be any startup functions
  WinEnv.startup();

  let $id = window.document.getElementById.bind(window.document);

  requestLog.isEmptyMessageDisplayed = true;
  requestLog.rows = [];
  requestLog.visibleRows = [];

  function init() {
    requestLog.tree = $id("rpcontinued-requestLog-tree");

    requestLog.tree.view = requestLog.treeView;

    showLogIsEmptyMessage();

    // Give the requestpolicy overlay direct access to the the request log.
    window.parent.rpcontinued.overlay.requestLog = requestLog;
  }
  function showLogIsEmptyMessage() {
    const message = browser.i18n.getMessage("requestLogIsEmpty");
    const directions = browser.i18n.getMessage("requestLogDirections");
    requestLog.visibleRows.push([message, directions, false, ""]);
    requestLog.treebox.rowCountChanged(0, 1);
  }

  // call init() on the window's "load" event
  WinEnv.elManager.addListener(window, "load", init, false);

  return requestLog;
})();

loadRLInterfaceIntoWindow(window);
loadRLTreeViewIntoWindow(window);
loadRLFilteringIntoWindow(window);
