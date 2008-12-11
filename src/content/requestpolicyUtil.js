var requestpolicyUtil = {

  _initialized : false,

  _requestLog : null,
  _requestLogSplitter : null,
  _requestLogFrame : null,

  init : function() {
    if (!this._initialized) {
      this._initialized = true;

      this._requestLog = document.getElementById("rp-requestLog");
      this._requestLogSplitter = document
          .getElementById("rp-requestLog-splitter");
      this._requestLogFrame = document.getElementById("rp-requestLog-frame");
    }
  },

  toggleRequestLog : function() {
    this._requestLogSplitter.hidden = !this._requestLog.hidden;
    this._requestLogFrame.setAttribute("src", this._requestLog.hidden
            ? "chrome://requestpolicy/content/requestLog.xul"
            : "about:blank");
    this._requestLog.hidden = !this._requestLog.hidden;
  }

}

// Initialize the requestpolicyUtil object when the window DOM is loaded.
addEventListener("DOMContentLoaded", function(event) {
      requestpolicyUtil.init();
    }, false);
