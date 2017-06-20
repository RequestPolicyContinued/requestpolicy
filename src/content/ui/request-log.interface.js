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

/* global window */

window.rpcontinued = window.rpcontinued || {};

window.rpcontinued.requestLog = (function(self) {
  /* global Components */
  const {classes: Cc, utils: Cu} = Components;

  let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

  let {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  let {DomainUtil} = importModule("lib/utils/domains");
  let {StringUtils} = importModule("lib/utils/strings");

  //============================================================================

  self.clear = function() {
    var count = self.treeView.rowCount;
    if (count === 0) {
      return;
    }
    self.rows = [];
    self.visibleRows = [];
    if (!self.treebox) {
      return;
    }
    self.treebox.rowCountChanged(0, -count);
  };

  /**
   * Copy the content of a cell to the clipboard. The row used will be the one
   * selected when the context menu was opened.
   */
  self.copyToClipboard = function(columnName) {
    var content = self.treeView.getCellText(self.tree.currentIndex,
        self.tree.columns.getNamedColumn(columnName));

    const clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper);
    clipboardHelper.copyString(content);
  };

  /**
   * Open the content of a cell in a new tab. The row used will be the one
   * selected when the context menu was opened.
   */
  self.openInNewTab = function(columnName) {
    var content = self.treeView.getCellText(self.tree.currentIndex,
        self.tree.columns.getNamedColumn(columnName));

    var forbidden = true;
    try {
      var uri = DomainUtil.getUriObject(content);
      if (uri.scheme === "http" || uri.scheme === "https" ||
          uri.scheme === "ftp") {
        forbidden = false;
      }
    } catch (e) {
    }

    if (forbidden) {
      var alertTitle = StringUtils.$str("actionForbidden");
      var alertText = StringUtils.$str("urlCanOnlyBeCopiedToClipboard");
      Services.prompt.alert(null, alertTitle, alertText);
      return;
    }

    window.top.openUILinkIn(content, "tab", {relatedToCurrent: true});
  };

  function addRow(aRow) {
    self.rows.push(aRow);

    if (!self.isRowFilteredOut(aRow)) {
      if (self.isEmptyMessageDisplayed) {
        // If this were to be called in a multithreaded manner, there's probably
        // a race condition here.
        self.visibleRows.shift();
        self.isEmptyMessageDisplayed = false;
        self.treebox.rowCountChanged(0, -1);
      }

      self.visibleRows.push(aRow);

      if (!self.treebox) {
        return;
      }

      self.treebox.rowCountChanged(0, 1);
    }
  }

  self.addAllowedRequest = function(originURI, destURI) {
    addRow([originURI, destURI, false, (new Date()).toLocaleTimeString()]);
  };

  self.addBlockedRequest = function(originURI, destURI) {
    addRow([originURI, destURI, true, (new Date()).toLocaleTimeString()]);
  };

  return self;
}(window.rpcontinued.requestLog || {}));
