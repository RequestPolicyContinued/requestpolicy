/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
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
  WindowUtils,
} = browser.extension.getBackgroundPage();

export function loadRLFilteringIntoWindow(window) {
  let {requestLog} = window.rpcontinued;

  // ===========================================================================

  let filterText = null;

  // TODO: use the Window Environment instead
  let elements = WindowUtils.getElementsByIdOnLoad(window, {
        filterTextbox: "rpcontinued-requestLog-requestFilter",
        clearFilterButton: "rpcontinued-requestLog-clearFilter"
      });

  requestLog.filterChanged = function() {
    let filterValue = elements.filterTextbox.value;

    // create a new regular expression
    filterText = filterValue.length === 0 ? null : new RegExp(filterValue, "i");
    // enable/disable the "Clear Filter" button
    elements.clearFilterButton.disabled = filterValue.length === 0;

    loadTable();
  };

  requestLog.clearFilter = function() {
    elements.filterTextbox.value = "";
    elements.filterTextbox.focus();
    requestLog.filterChanged();
  };

  /**
   * Check if the row should be displayed or filtered out.
   *
   * This function searches the first two columns for the filterText.
   *
   * @param {Array} aRow
   * @return {boolean}
   */
  requestLog.isRowFilteredOut = function(aRow) {
    if (filterText === null) {
      return false;
    }
    // The row is filtered out in case *all* searches in the columns *failed*.
    return aRow[0].search(filterText) === -1 &&
        aRow[1].search(filterText) === -1;
  };

  function addRowOrFilterOut(aRow) {
    if (requestLog.isRowFilteredOut(aRow)) {
      return;
    }
    requestLog.visibleRows.push(aRow);
  }

  // This function is called every time the tree is sorted, filtered or reloaded
  function loadTable() {
    let oldRowCount = requestLog.treeView.rowCount;

    if (!filterText) {
      // there's no filter ==> show all rows
      requestLog.visibleRows = requestLog.rows;
    } else {
      // filter out the rows we want to display
      requestLog.visibleRows = [];
      requestLog.rows.forEach(addRowOrFilterOut);
    }

    // notify that the table rows has changed
    let newRowCount = requestLog.treeView.rowCount;
    requestLog.treebox.rowCountChanged(0, newRowCount - oldRowCount);
  }
}
