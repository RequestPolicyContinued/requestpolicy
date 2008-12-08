var EXPORTED_SYMBOLS = ["Prompter"]

var Prompter = new function() {
  this._promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
};

Prompter.alert = function(title, text) {
  this._promptService.alert(null, title, text);
}
