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

  let mod = {};
  Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm", mod);
  mod.ScriptLoader.importModules([
    "string-utils"
  ], mod);
  let StringUtils = mod.StringUtils;


  let initialized = false;
  self.isEmptyMessageDisplayed = true;

  self.tree = null;

  self.visibleData = [];


  function showLogIsEmptyMessage() {
    var message = StringUtils.strbundle.GetStringFromName("requestLogIsEmpty");
    var directions = StringUtils.strbundle
        .GetStringFromName("requestLogDirections");
    self.visibleData.push([message, directions, false, ""]);
  };


  function init() {
    if (initialized) {
      return;
    }
    initialized = true;

    self.tree = document.getElementById("requestpolicy-requestLog-tree");
    self.tree.view = self.treeView;

    // Give the requestpolicy overlay direct access to the the request log.
    window.parent.requestpolicy.overlay.requestLog = self;

    showLogIsEmptyMessage();
  };

  window.addEventListener("load", function(event) {
    init(event);
  }, false);



  return self;
}(window.requestpolicy.requestLog || {}));
