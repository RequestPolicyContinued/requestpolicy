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

let {
  DomainUtil,
  StringUtils,
} = browser.extension.getBackgroundPage();

export function loadRLInterfaceIntoWindow(window) {
  let {requestLog} = window.rpcontinued;

  // ===========================================================================

  requestLog.clear = function() {
    const count = requestLog.treeView.rowCount;
    if (count === 0) {
      return;
    }
    requestLog.rows = [];
    requestLog.visibleRows = [];
    if (!requestLog.treebox) {
      return;
    }
    requestLog.treebox.rowCountChanged(0, -count);
  };

  /**
   * Copy the content of a cell to the clipboard. The row used will be the one
   * selected when the context menu was opened.
   */
  requestLog.copyToClipboard = function(columnName) {
    const content = requestLog.treeView.getCellText(
        requestLog.tree.currentIndex,
        requestLog.tree.columns.getNamedColumn(columnName));

    const clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Ci.nsIClipboardHelper);
    clipboardHelper.copyString(content);
  };

  /**
   * Open the content of a cell in a new tab. The row used will be the one
   * selected when the context menu was opened.
   */
  requestLog.openInNewTab = function(columnName) {
    const content = requestLog.treeView.getCellText(
        requestLog.tree.currentIndex,
        requestLog.tree.columns.getNamedColumn(columnName));

    let forbidden = true;
    try {
      const uri = DomainUtil.getUriObject(content);
      if (uri.scheme === "http" || uri.scheme === "https" ||
          uri.scheme === "ftp") {
        forbidden = false;
      }
    } catch (e) {
    }

    if (forbidden) {
      const alertTitle = StringUtils.$str("actionForbidden");
      const alertText = StringUtils.$str("urlCanOnlyBeCopiedToClipboard");
      Services.prompt.alert(null, alertTitle, alertText);
      return;
    }

    window.top.openUILinkIn(content, "tab", {relatedToCurrent: true});
  };

  function addRow(aRow) {
    requestLog.rows.push(aRow);

    if (!requestLog.isRowFilteredOut(aRow)) {
      if (requestLog.isEmptyMessageDisplayed) {
        // If this were to be called in a multithreaded manner, there's probably
        // a race condition here.
        requestLog.visibleRows.shift();
        requestLog.isEmptyMessageDisplayed = false;
        requestLog.treebox.rowCountChanged(0, -1);
      }

      requestLog.visibleRows.push(aRow);

      if (!requestLog.treebox) {
        return;
      }

      requestLog.treebox.rowCountChanged(0, 1);
    }
  }

  requestLog.addAllowedRequest = function(originURI, destURI) {
    addRow([originURI, destURI, false, (new Date()).toLocaleTimeString()]);
  };

  requestLog.addBlockedRequest = function(originURI, destURI) {
    addRow([originURI, destURI, true, (new Date()).toLocaleTimeString()]);
  };
}
