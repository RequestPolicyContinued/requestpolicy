/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
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

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

requestpolicy.requestLog = {

  _initialized : false,

  _tree : null,

  init : function() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._tree = document.getElementById("requestpolicy-requestLog-tree");
    this._tree.view = window.requestpolicy.requestLogTreeView;

    // Give the requestpolicyOverlay direct access to the tree view.
    window.parent.requestpolicy.overlay.requestLogTreeView = window.requestpolicy.requestLogTreeView;
  }

};

addEventListener("DOMContentLoaded", function(event) {
      requestpolicy.requestLog.init(event);
    }, false);
