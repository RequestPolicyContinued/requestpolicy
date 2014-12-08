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

window.requestpolicy = window.requestpolicy || {};

window.requestpolicy.requestLog = (function (self) {

  const Ci = Components.interfaces;
  const Cc = Components.classes;
  const Cu = Components.utils;

  let mod = {};
  Cu.import("chrome://requestpolicy/content/lib/script-loader.jsm", mod);
  mod.ScriptLoader.importModules(["string-utils"], mod);
  let StringUtils = mod.StringUtils;




  self.treebox = null;

  self.columnNameToIndexMap = {
    "requestpolicy-requestLog-origin" : 0,
    "requestpolicy-requestLog-destination" : 1,
    "requestpolicy-requestLog-blocked" : 2,
    "requestpolicy-requestLog-time" : 3
  };

  let aserv = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);


  function getVisibleItemAtIndex(index) {
    return self.visibleData[self.visibleData.length - index - 1];
  };

  // the interface.
  // see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Tutorial/Custom_Tree_Views

  self.treeView = {
    /**
     * "This property should be set to the total number of rows in the tree."
     * (getter function)
     */
    get: function() {
      return self.visibleData.length;
    },

    /**
     * "This method should return the text contents at the specified row and
     * column."
     */
    setTree: function(_treebox) {
      self.treebox = _treebox;
    },

    /**
     * This method is called once to set the tree element on the view.
     */
    getCellText: function(index, column) {
      // Row 0 is actually the last element in the array so that we don't have to
      // unshift() the array and can just push().
      // TODO: Do an actual speed test with push vs. unshift to see if it matters
      // with this javascript array implementation, though I'm assuming it does.
      var columnIndex = self.columnNameToIndexMap[column.id];
      if (columnIndex != 2) {
        return getVisibleItemAtIndex(index)[self.columnNameToIndexMap[column.id]];
      }
    },

    isContainer: function(index) {
      return false;
    },

    isContainerOpen: function(index) {
      return false;
    },

    isContainerEmpty: function(index) {
      return false;
    },

    isSeparator: function(index) {
      return false;
    },

    isSorted: function() {
      return false;
    },

    isEditable: function(index, column) {
      return false;
    },

    getParentIndex: function(index) {
      return -1;
    },

    getLevel: function(index) {
      return 0;
    },

    hasNextSibling: function(index, after) {
      return false;
    },

    toggleOpenState: function(index) {},

    getImageSrc: function(index, column) {
      if (self.columnNameToIndexMap[column.id] == 2) {
        if (getVisibleItemAtIndex(index)[2]) {
          return "chrome://requestpolicy/skin/dot.png";
        }
      }
    },

    getProgressMode: function(index, column) {},
    getCellValue: function(index, column) {},
    cycleHeader: function(col, elem) {},
    selectionChanged: function() {},
    cycleCell: function(index, column) {},
    performAction: function(action) {},
    performActionOnCell: function(action, index, column) {},

    getRowProperties: function(index, props) {
      var returnValue = (getVisibleItemAtIndex(index)[2]) ? "blocked" : "allowed";

      if (props) {
        // Gecko version < 22
        props.AppendElement(aserv.getAtom(returnValue));
      } else {
        // Gecko version >= 22
        return returnValue;
      }
    },

    getCellProperties: function(index, column, props) {
      if (self.columnNameToIndexMap[column.id] == 2) {
        if (getVisibleItemAtIndex(index)[2]) {
          if (props) {
            // Gecko version < 22
            props.AppendElement(aserv.getAtom("blocked"));
          } else {
            // Gecko version >= 22
            return "blocked";
          }
        }
      }
    },

    getColumnProperties: function(column, props) {
      if (!props) {
        return "";
      }
    }
  };

  return self;
}(window.requestpolicy.requestLog || {}));

