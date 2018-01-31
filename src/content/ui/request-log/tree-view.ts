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

interface IWindow extends Window {
  rpcontinued: any;
}

export function loadRLTreeViewIntoWindow(window: IWindow) {
  const {requestLog} = window.rpcontinued;

  // ===========================================================================

  requestLog.treebox = null;

  /* tslint:disable object-literal-sort-keys */
  requestLog.columnNameToIndexMap = {
    "rpcontinued-requestLog-origin": 0,
    "rpcontinued-requestLog-destination": 1,
    "rpcontinued-requestLog-blocked": 2,
    "rpcontinued-requestLog-time": 3,
  };
  /* tslint:enable object-literal-sort-keys */

  function getVisibleRowAtIndex(index: number) {
    return requestLog.visibleRows[requestLog.visibleRows.length - index - 1];
  }

  //
  // the interface.
  // see https://developer.mozilla.org/en-US/docs/
  //     Mozilla/Tech/XUL/Tutorial/Custom_Tree_Views
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
    setTree(aTreebox: any) {
      requestLog.treebox = aTreebox;
    },

    /**
     * This method is called once to set the tree element on the view.
     *
     * @param {number} aIndex
     * @param {nsITreeColumn} aColumn
     * @return {number}
     */
    getCellText(aIndex: number, aColumn: any): number | undefined {
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

    isContainer(aIndex: number) {
      return false;
    },

    isContainerOpen(aIndex: number) {
      return false;
    },

    isContainerEmpty(aIndex: number) {
      return false;
    },

    isSeparator(aIndex: number) {
      return false;
    },

    isSorted() {
      return false;
    },

    isEditable(aIndex: number, aColumn: any) {
      return false;
    },

    getParentIndex(aIndex: number) {
      return -1;
    },

    getLevel(aIndex: number) {
      return 0;
    },

    hasNextSibling(aIndex: number, aAfter: any) {
      return false;
    },

    toggleOpenState(aIndex: number) {
      return;
    },

    getImageSrc(aIndex: number, aColumn: any) {
      if (requestLog.columnNameToIndexMap[aColumn.id] === 2) {
        if (getVisibleRowAtIndex(aIndex)[2]) {
          return "chrome://rpcontinued/skin/dot.png";
        }
      }
    },

    getProgressMode(aIndex: number, aColumn: any) { return; },
    getCellValue(aIndex: number, aColumn: any) { return; },
    cycleHeader(col: any, elem: any) { return; },
    selectionChanged() { return; },
    cycleCell(aIndex: number, aColumn: any) { return; },
    performAction(action: any) { return; },
    performActionOnCell(action: any, aIndex: number, aColumn: any) { return; },

    getRowProperties(aIndex: number) {
      return getVisibleRowAtIndex(aIndex)[2] ? "blocked" : "allowed";
    },

    getCellProperties(aIndex: number, aColumn: any) {
      if (requestLog.columnNameToIndexMap[aColumn.id] === 2) {
        if (getVisibleRowAtIndex(aIndex)[2]) {
          return "blocked";
        }
      }
      return "";
    },

    getColumnProperties(aColumn: any) {
      return "";
    },
  };
}
