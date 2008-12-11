Components.utils.import("resource://requestpolicy/Logger.jsm");

var requestLogTreeView = {

  _treebox : null,

  _visibleData : [],

  _columnNameToIndexMap : {
    "requestpolicy-requestLog-origin" : 0,
    "requestpolicy-requestLog-destination" : 1,
    "requestpolicy-requestLog-blocked" : 2
  },

  addAllowedRequest : function(originUri, destUri) {
    this._visibleData.push([originUri, destUri, ""]);
    this.rowCount++;
    if (!this._treebox) {
      return;
    }
    this._treebox.rowCountChanged(0, 1);
  },

  addBlockedRequest : function(originUri, destUri) {
    this._visibleData.push([originUri, destUri, "X"]);
    this.rowCount++;
    if (!this._treebox) {
      return;
    }
    this._treebox.rowCountChanged(0, 1);
  },

  // Start of interface.

  // rowCount --- we define _getRowCount() as an (old-style) getter for this.
  _getRowCount : function() {
    return this._visibleData.length
  },

  setTree : function(_treebox) {
    this._treebox = _treebox;
  },

  getCellText : function(idx, column) {
    // Logger.dump("CALL TO getCellText " + idx + " / " + column.id + "\n");
    // Row 0 is actually the last element in the array so that we don't have to
    // unshift() the array and can just push().
    // TODO: Do an actual speed test with push vs. unshift to see if it matters
    // with this javascript array implementation, though I'm assuming it does.
    return this._visibleData[this._visibleData.length - idx - 1][this._columnNameToIndexMap[column.id]];
  },

  isContainer : function(idx) {
    return false;
  },

  isContainerOpen : function(idx) {
    return false;
  },

  isContainerEmpty : function(idx) {
    return false;
  },

  isSeparator : function(idx) {
    return false;
  },

  isSorted : function() {
    return false;
  },

  isEditable : function(idx, column) {
    return false;
  },

  getParentIndex : function(idx) {
    return -1;
  },

  getLevel : function(idx) {
    return 0;
  },

  hasNextSibling : function(idx, after) {
    return false;
  },

  toggleOpenState : function(idx) {
  },

  getImageSrc : function(idx, column) {
  },

  getProgressMode : function(idx, column) {
  },

  getCellValue : function(idx, column) {
  },

  cycleHeader : function(col, elem) {
  },

  selectionChanged : function() {
  },

  cycleCell : function(idx, column) {
  },

  performAction : function(action) {
  },

  performActionOnCell : function(action, index, column) {
  },

  getRowProperties : function(idx, column, prop) {
  },

  getCellProperties : function(idx, column, prop) {
  },

  getColumnProperties : function(column, element, prop) {
  }

};

requestLogTreeView.__defineGetter__("rowCount", function() {
      return this._getRowCount();
    });
