Components.utils.import("resource://requestpolicy/Logger.jsm");

var requestLog = {

  _initialized : false,

  _tree : null,

  init : function() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._tree = document.getElementById("requestpolicy-requestLog-tree");
    this._tree.view = window.requestLogTreeView;

    // Give the requestpolicyOverlay direct access to the tree view.
    window.parent.requestpolicyOverlay.requestLogTreeView = window.requestLogTreeView;
  }

};

// Initialize the requestpolicyUtil object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestLog.init(event);
    }, false);
