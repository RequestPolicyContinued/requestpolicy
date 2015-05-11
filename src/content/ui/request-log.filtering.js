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


window.requestpolicy.requestLog = (function (self) {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;

  let {ScriptLoader, Services} = (function() {
    let mod = {};
    Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm", mod);
    Cu.import("resource://gre/modules/Services.jsm", mod);
    return mod;
  }());
  let {WindowUtils} = ScriptLoader.importModule("lib/utils/windows");

  let filterText = null;

  // TODO: use the Window Environment instead
  let elements = WindowUtils.getElementsByIdOnLoad(window, {
        filterTextbox: "requestpolicy-requestLog-requestFilter",
        clearFilterButton: "requestpolicy-requestLog-clearFilter"
      });

  self.filterChanged = function() {
    let filterValue = elements.filterTextbox.value;

    // create a new regular expression
    filterText = filterValue.length === 0 ? null : new RegExp(filterValue, 'i');
    // enable/disable the "Clear Filter" button
    elements.clearFilterButton.disabled = filterValue.length === 0;

    loadTable();
  };

  self.clearFilter = function() {
    elements.filterTextbox.value = "";
    elements.filterTextbox.focus();
    self.filterChanged();
  }




  /**
   * Check if the row should be displayed or filtered out.
   *
   * This function searches the first two columns for the filterText.
   *
   * @param {Array} aRow
   */
  self.isRowFilteredOut = function(aRow) {
    if (filterText === null) {
      return false;
    }
    // The row is filtered out in case *all* searches in the columns *failed*.
    return aRow[0].search(filterText) === -1 &&
        aRow[1].search(filterText) === -1;
  };

  function addRowOrFilterOut(aRow) {
    if (self.isRowFilteredOut(aRow)) {
      return;
    }
    self.visibleRows.push(aRow);
  }

  // This function is called every time the tree is sorted, filtered or reloaded
  function loadTable() {
    let oldRowCount = self.treeView.rowCount;

    if (!filterText) {
      // there's no filter ==> show all rows
      self.visibleRows = self.rows;
    } else {
      // filter out the rows we want to display
      self.visibleRows = [];
      self.rows.forEach(addRowOrFilterOut);
    }

    // notify that the table rows has changed
    let newRowCount = self.treeView.rowCount;
    self.treebox.rowCountChanged(0, newRowCount-oldRowCount);
  }


  return self;
}(window.requestpolicy.requestLog || {}));
