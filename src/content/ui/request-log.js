/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

window.requestpolicy = window.requestpolicy || {};

window.requestpolicy.requestLog = (function (self) {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;

  let ScriptLoader;
  {
    let mod = {};
    Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm", mod);
    ScriptLoader = mod.ScriptLoader;
  }
  let {StringUtils} = ScriptLoader.importModule("utils/strings");
  let {Utils} = ScriptLoader.importModule("utils");


  self.isEmptyMessageDisplayed = true;
  self.rows = [];
  self.visibleRows = [];



  let init = function() {
    // callback function – gets called when the tree is available.
    self.tree.view = self.treeView;

    showLogIsEmptyMessage();

    // Give the requestpolicy overlay direct access to the the request log.
    window.parent.requestpolicy.overlay.requestLog = self;
  }

  Utils.getElementsByIdOnLoad(window, {
        tree: "requestpolicy-requestLog-tree"
      }, self, init);




  function showLogIsEmptyMessage() {
    var message = StringUtils.$str("requestLogIsEmpty");
    var directions = StringUtils.$str("requestLogDirections");
    self.visibleRows.push([message, directions, false, ""]);
    self.treebox.rowCountChanged(0, 1);
  };



  return self;
}(window.requestpolicy.requestLog || {}));
