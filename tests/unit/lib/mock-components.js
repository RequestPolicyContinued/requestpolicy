// Some mocks for /gre/modules/Components.jsm
// Warning : those mock must be only used for unit testing purpose
// Warning : Those mocks are partial, add functions if needed

// =============================================================================
// Partial mock of Components.utils XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.utils
// =============================================================================
function Utils() {};
Utils.prototype.import = function(mod) {};

// =============================================================================
// Partial mock of Components.interfaces XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.interfaces
// =============================================================================
function Interfaces() {
  this.nsIPrefBranch2 = null;
};

// =============================================================================
// Partial mock of Components XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components_object
// =============================================================================
function Components() {
  this.utils = new Utils();
  this.interfaces = new Interfaces();
}

module.exports = Components;
