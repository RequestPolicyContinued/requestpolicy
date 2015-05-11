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

window.requestpolicy = window.requestpolicy || {};

window.requestpolicy.requestLog = (function (self) {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;


  let {ScriptLoader} = (function() {
    let mod = {};
    Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm", mod);
    return mod;
  }());
  let {StringUtils} = ScriptLoader.importModule("lib/utils/strings");




  self.treebox = null;

  self.columnNameToIndexMap = {
    "requestpolicy-requestLog-origin" : 0,
    "requestpolicy-requestLog-destination" : 1,
    "requestpolicy-requestLog-blocked" : 2,
    "requestpolicy-requestLog-time" : 3
  };

  let aserv = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);


  function getVisibleRowAtIndex(index) {
    return self.visibleRows[self.visibleRows.length - index - 1];
  };



  //
  // the interface.
  // see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Tutorial/Custom_Tree_Views
  //

  self.treeView = {
    /**
     * "This property should be set to the total number of rows in the tree."
     * (getter function)
     */
    get rowCount () {
      return self.visibleRows.length;
    },

    /**
     * "This method should return the text contents at the specified row and
     * column."
     */
    setTree: function(aTreebox) {
      self.treebox = aTreebox;
    },

    /**
     * This method is called once to set the tree element on the view.
     */
    getCellText: function(aIndex, aColumn) {
      // Row 0 is actually the last element in the array so that we don't have to
      // unshift() the array and can just push().
      // TODO: Do an actual speed test with push vs. unshift to see if it matters
      // with this javascript array implementation, though I'm assuming it does.
      var columnIndex = self.columnNameToIndexMap[aColumn.id];
      if (columnIndex != 2) {
        return getVisibleRowAtIndex(aIndex)[self.columnNameToIndexMap[aColumn.id]];
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
      if (self.columnNameToIndexMap[aColumn.id] == 2) {
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

    getRowProperties: function(aIndex, aProps) {
      var returnValue = (getVisibleRowAtIndex(aIndex)[2]) ? "blocked" : "allowed";

      if (aProps) {
        // Gecko version < 22
        aProps.AppendElement(aserv.getAtom(returnValue));
      } else {
        // Gecko version >= 22
        return returnValue;
      }
    },

    getCellProperties: function(aIndex, aColumn, aProps) {
      if (self.columnNameToIndexMap[aColumn.id] == 2) {
        if (getVisibleRowAtIndex(aIndex)[2]) {
          if (aProps) {
            // Gecko version < 22
            aProps.AppendElement(aserv.getAtom("blocked"));
          } else {
            // Gecko version >= 22
            return "blocked";
          }
        }
      }
    },

    getColumnProperties: function(aColumn, aProps) {
      if (!aProps) {
        return "";
      }
    }
  };

  return self;
}(window.requestpolicy.requestLog || {}));
