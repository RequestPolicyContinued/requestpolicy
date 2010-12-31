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

Components.utils.import("resource://requestpolicy/DomainUtil.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Prompter.jsm",
    requestpolicy.mod);

requestpolicy.requestLog = {

  _initialized : false,

  _tree : null,

  _strbundle : null,

  init : function() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._strbundle = document.getElementById("requestpolicyStrings");

    this._tree = document.getElementById("requestpolicy-requestLog-tree");
    this._tree.view = window.requestpolicy.requestLogTreeView;

    // Give the requestpolicyOverlay direct access to the tree view.
    window.parent.requestpolicy.overlay.requestLogTreeView = window.requestpolicy.requestLogTreeView;
  },

  /**
   * Copy the content of a cell to the clipboard. The row used will be the one
   * selected when the context menu was opened.
   */
  copyToClipboard : function(columnName) {
    var content = this._tree.view.getCellText(this._tree.currentIndex,
        this._tree.columns.getNamedColumn(columnName));

    const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper);
    clipboardHelper.copyString(content);
  },

  /**
   * Open the content of a cell in a new tab. The row used will be the one
   * selected when the context menu was opened.
   */
  openInNewTab : function(columnName) {
    var content = this._tree.view.getCellText(this._tree.currentIndex,
        this._tree.columns.getNamedColumn(columnName));

    var forbidden = true;
    try {
      var uri = requestpolicy.mod.DomainUtil.getUriObject(content);
      if (uri.scheme == 'http' || uri.scheme == 'https' || uri.scheme == 'ftp') {
        forbidden = false;
      }
    } catch (e) {
    }

    if (forbidden) {
      var alertTitle = this._strbundle.getString("actionForbidden");
      var alertText = this._strbundle
          .getString("urlCanOnlyBeCopiedToClipboard");
      requestpolicy.mod.Prompter.alert(alertTitle, alertText);
      return;
    }

    var mainWindow = window
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShellTreeItem).rootTreeItem
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIDOMWindow);
    mainWindow.gBrowser.addTab(content);
  }

};

addEventListener("load", function(event) {
      requestpolicy.requestLog.init(event);
    }, false);
