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


window.requestpolicy.requestLog = (function () {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;

  Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm");
  ScriptLoader.importModules([
    "domain-util",
    "utils"
  ], this);


  let initialized = false;
  let tree = null;


  let self = {

    init: function() {
      if (initialized) {
        return;
      }
      initialized = true;

      tree = document.getElementById("requestpolicy-requestLog-tree");
      tree.view = window.requestpolicy.requestLogTreeView;

      // Give the requestpolicyOverlay direct access to the tree view.
      window.parent.requestpolicy.overlay.requestLogTreeView = window.requestpolicy.requestLogTreeView;
    },

    /**
     * Copy the content of a cell to the clipboard. The row used will be the one
     * selected when the context menu was opened.
     */
    copyToClipboard: function(columnName) {
      var content = tree.view.getCellText(tree.currentIndex,
          tree.columns.getNamedColumn(columnName));

      const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
          .getService(Components.interfaces.nsIClipboardHelper);
      clipboardHelper.copyString(content);
    },

    /**
     * Open the content of a cell in a new tab. The row used will be the one
     * selected when the context menu was opened.
     */
    openInNewTab: function(columnName) {
      var content = tree.view.getCellText(tree.currentIndex,
          tree.columns.getNamedColumn(columnName));

      var forbidden = true;
      try {
        var uri = DomainUtil.getUriObject(content);
        if (uri.scheme == 'http' || uri.scheme == 'https' || uri.scheme == 'ftp') {
          forbidden = false;
        }
      } catch (e) {
      }

      if (forbidden) {
        var alertTitle = Utils.strbundle.GetStringFromName("actionForbidden");
        var alertText = Utils.strbundle
            .GetStringFromName("urlCanOnlyBeCopiedToClipboard");
        Services.prompt.alert(null, alertTitle, alertText);
        return;
      }

      Utils.getChromeWindow(window).gBrowser.addTab(content);
    }

  };

  return self;
}());

addEventListener("load", function(event) {
    window.requestpolicy.requestLog.init(event);
}, false);
