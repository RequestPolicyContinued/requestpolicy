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

export function loadRLTreeViewIntoWindow(window) {
  let {requestLog} = window.rpcontinued;

  // ===========================================================================

  requestLog.treebox = null;

  requestLog.columnNameToIndexMap = {
    "rpcontinued-requestLog-origin": 0,
    "rpcontinued-requestLog-destination": 1,
    "rpcontinued-requestLog-blocked": 2,
    "rpcontinued-requestLog-time": 3,
  };

  function getVisibleRowAtIndex(index) {
    return requestLog.visibleRows[requestLog.visibleRows.length - index - 1];
  }

  //
  // the interface.
  // see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Tutorial/Custom_Tree_Views
  //

  requestLog.treeView = {
    /**
     * "This property should be set to the total number of rows in the tree."
     * (getter function)
     */
    get rowCount() {
      return requestLog.visibleRows.length;
    },

    /**
     * "This method should return the text contents at the specified row and
     * column."
     *
     * @param {nsITreeBoxObject} aTreebox
     */
    setTree: function(aTreebox) {
      requestLog.treebox = aTreebox;
    },

    /**
     * This method is called once to set the tree element on the view.
     *
     * @param {number} aIndex
     * @param {nsITreeColumn} aColumn
     * @return {number}
     */
    getCellText: function(aIndex, aColumn) {
      // Row 0 is actually the last element in the array so that we don't
      // have to unshift() the array and can just push().
      // TODO: Do an actual speed test with push vs. unshift to see if it
      // matters with this javascript array implementation, though I'm
      // assuming it does.
      const columnIndex = requestLog.columnNameToIndexMap[aColumn.id];
      if (columnIndex !== 2) {
        return getVisibleRowAtIndex(aIndex)[columnIndex];
      }
    },

    isContainer: function(aIndex) {
      return false;
    },

    isContainerOpen: function(aIndex) {
      return false;
    },

    isContainerEmpty: function(aIndex) {
      return false;
    },

    isSeparator: function(aIndex) {
      return false;
    },

    isSorted: function() {
      return false;
    },

    isEditable: function(aIndex, aColumn) {
      return false;
    },

    getParentIndex: function(aIndex) {
      return -1;
    },

    getLevel: function(aIndex) {
      return 0;
    },

    hasNextSibling: function(aIndex, aAfter) {
      return false;
    },

    toggleOpenState: function(aIndex) {},

    getImageSrc: function(aIndex, aColumn) {
      if (requestLog.columnNameToIndexMap[aColumn.id] === 2) {
        if (getVisibleRowAtIndex(aIndex)[2]) {
          return "chrome://rpcontinued/skin/dot.png";
        }
      }
    },

    getProgressMode: function(aIndex, aColumn) {},
    getCellValue: function(aIndex, aColumn) {},
    cycleHeader: function(col, elem) {},
    selectionChanged: function() {},
    cycleCell: function(aIndex, aColumn) {},
    performAction: function(action) {},
    performActionOnCell: function(action, aIndex, aColumn) {},

    getRowProperties: function(aIndex) {
      return getVisibleRowAtIndex(aIndex)[2] ? "blocked" : "allowed";
    },

    getCellProperties: function(aIndex, aColumn) {
      if (requestLog.columnNameToIndexMap[aColumn.id] === 2) {
        if (getVisibleRowAtIndex(aIndex)[2]) {
          return "blocked";
        }
      }
      return "";
    },

    getColumnProperties: function(aColumn) {
      return "";
    },
  };
}
