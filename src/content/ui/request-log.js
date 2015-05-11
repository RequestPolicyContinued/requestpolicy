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
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

window.requestpolicy = window.requestpolicy || {};

window.requestpolicy.requestLog = (function (self) {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;

  let {ScriptLoader} = (function() {
    let mod = {};
    Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm", mod);
    return mod;
  }());
  let {StringUtils} = ScriptLoader.importModule("lib/utils/strings");
  let {WindowUtils} = ScriptLoader.importModule("lib/utils/windows");
  let {Environment,
       ProcessEnvironment} = ScriptLoader.importModule("lib/environment");

  // create a new Environment for this window
  var WinEnv = new Environment(ProcessEnvironment, "WinEnv");
  // The Environment has to be shut down when the content window gets unloaded.
  WinEnv.shutdownOnUnload(window);
  // start up right now, as there won't be any startup functions
  WinEnv.startup();

  let $id = window.document.getElementById.bind(window.document);


  self.isEmptyMessageDisplayed = true;
  self.rows = [];
  self.visibleRows = [];



  function init() {
    self.tree = $id("requestpolicy-requestLog-tree")

    self.tree.view = self.treeView;

    showLogIsEmptyMessage();

    // Give the requestpolicy overlay direct access to the the request log.
    window.parent.requestpolicy.overlay.requestLog = self;
  }
  function showLogIsEmptyMessage() {
    var message = StringUtils.$str("requestLogIsEmpty");
    var directions = StringUtils.$str("requestLogDirections");
    self.visibleRows.push([message, directions, false, ""]);
    self.treebox.rowCountChanged(0, 1);
  }

  // call init() on the window's "load" event
  WinEnv.elManager.addListener(window, "load", init, false);



  return self;
}(window.requestpolicy.requestLog || {}));
