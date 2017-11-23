// Some mocks for /gre/modules/Services.jsm
// Warning : those mock must be only used for unit testing purpose
// Those are partial mocks to successly load
// src/conditional/legacy/content/web-extension-fake-api/models/api.js

// =============================================================================
// Partial mock of nsIPrefBranch XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefBranch
// =============================================================================

function nsIPrefBranch() {};

nsIPrefBranch.prototype.QueryInterface = function() {
  return null;
};

// =============================================================================
// Partial mock of nsIPrefService XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefService
// =============================================================================
function nsIPrefService() {};

nsIPrefService.prototype.getBranch = function(aPrefRoot) {
  return new nsIPrefBranch();
};

nsIPrefService.prototype.savePrefFile = function(aFile) {};

// =============================================================================
// Partial mock of Services.jsm
// See : https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Services.jsm
// =============================================================================

function Services() {
  this.prefs = new nsIPrefService();
};

module.exports = Services;
