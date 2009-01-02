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

var requestpolicyRequestLogTreeView = {

  _treebox : null,

  _visibleData : [],

  _columnNameToIndexMap : {
    "requestpolicy-requestLog-origin" : 0,
    "requestpolicy-requestLog-destination" : 1,
    "requestpolicy-requestLog-blocked" : 2,
    "requestpolicy-requestLog-time" : 3
  },

  _aserv : Components.classes["@mozilla.org/atom-service;1"]
      .getService(Components.interfaces.nsIAtomService),

  addAllowedRequest : function(originUri, destUri) {
    this._visibleData.push([originUri, destUri, false,
        (new Date()).toLocaleTimeString()]);
    this.rowCount++;
    if (!this._treebox) {
      return;
    }
    this._treebox.rowCountChanged(0, 1);
  },

  addBlockedRequest : function(originUri, destUri) {
    this._visibleData.push([originUri, destUri, true,
        (new Date()).toLocaleTimeString()]);
    this.rowCount++;
    if (!this._treebox) {
      return;
    }
    this._treebox.rowCountChanged(0, 1);
  },

  _getVisibleItemAtIndex : function(index) {
    return this._visibleData[this._visibleData.length - index - 1];
  },

  // Start of interface.

  // rowCount --- we define _getRowCount() as an (old-style) getter for this.
  _getRowCount : function() {
    return this._visibleData.length
  },

  setTree : function(_treebox) {
    this._treebox = _treebox;
  },

  getCellText : function(index, column) {
    // Row 0 is actually the last element in the array so that we don't have to
    // unshift() the array and can just push().
    // TODO: Do an actual speed test with push vs. unshift to see if it matters
    // with this javascript array implementation, though I'm assuming it does.
    var columnIndex = this._columnNameToIndexMap[column.id];
    if (columnIndex != 2) {
      return this._getVisibleItemAtIndex(index)[this._columnNameToIndexMap[column.id]];
    }
  },

  isContainer : function(index) {
    return false;
  },

  isContainerOpen : function(index) {
    return false;
  },

  isContainerEmpty : function(index) {
    return false;
  },

  isSeparator : function(index) {
    return false;
  },

  isSorted : function() {
    return false;
  },

  isEditable : function(index, column) {
    return false;
  },

  getParentIndex : function(index) {
    return -1;
  },

  getLevel : function(index) {
    return 0;
  },

  hasNextSibling : function(index, after) {
    return false;
  },

  toggleOpenState : function(index) {
  },

  getImageSrc : function(index, column) {
    if (this._columnNameToIndexMap[column.id] == 2) {
      if (this._getVisibleItemAtIndex(index)[2]) {
        return "chrome://requestpolicy/skin/dot.png";
      }
    }
  },

  getProgressMode : function(index, column) {
  },

  getCellValue : function(index, column) {
  },

  cycleHeader : function(col, elem) {
  },

  selectionChanged : function() {
  },

  cycleCell : function(index, column) {
  },

  performAction : function(action) {
  },

  performActionOnCell : function(action, index, column) {
  },

  getRowProperties : function(index, props) {
    if (this._getVisibleItemAtIndex(index)[2]) {
      props.AppendElement(this._aserv.getAtom("blocked"));
    } else {
      props.AppendElement(this._aserv.getAtom("allowed"));
    }
  },

  getCellProperties : function(index, column, props) {
    if (this._columnNameToIndexMap[column.id] == 2) {
      if (this._getVisibleItemAtIndex(index)[2]) {
        props.AppendElement(this._aserv.getAtom("blocked"));
      }
    }
  },

  getColumnProperties : function(column, props) {
  }

};

requestpolicyRequestLogTreeView.__defineGetter__("rowCount", function() {
      return this._getRowCount();
    });
