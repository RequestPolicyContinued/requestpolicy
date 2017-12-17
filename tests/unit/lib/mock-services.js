// Some mocks for /gre/modules/Services.jsm
// Warning : those mock must be only used for unit testing purpose
// Warning : Those mocks are partial, add functions if needed

// =============================================================================
// Partial mock of nsIPrefBranch XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefBranch
// =============================================================================

function nsIPrefBranch() {}

nsIPrefBranch.prototype.QueryInterface = function() {
  return null;
};

// =============================================================================
// Partial mock of nsIPrefService XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefService
// =============================================================================
function nsIPrefService() {}

nsIPrefService.prototype.getBranch = function(aPrefRoot) {
  return new nsIPrefBranch();
};

nsIPrefService.prototype.savePrefFile = function(aFile) {};

// =============================================================================
// Partial mock of nsILocaleService XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsILocaleService
// =============================================================================
function nsILocaleService() {}

nsILocaleService.prototype.getAppLocaleAsBCP47 = function() {};

// =============================================================================
// Partial mock of Services.jsm
// See : https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Services.jsm
// =============================================================================

function Services() {
  this.prefs = new nsIPrefService();
  this.locale = new nsILocaleService();
}

module.exports = Services;
