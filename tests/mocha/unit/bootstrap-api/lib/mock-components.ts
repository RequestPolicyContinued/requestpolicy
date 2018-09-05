// Some mocks for /gre/modules/Components.jsm
// Warning : those mock must be only used for unit testing purpose
// Warning : Those mocks are partial, add functions if needed

// =============================================================================
// Partial mock of Components.utils XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.utils
// =============================================================================
class Utils {
  import(mod) {}
}

// =============================================================================
// Partial mock of Components.interfaces XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.interfaces
// =============================================================================
class Interfaces {
  public nsIPrefBranch2 = null;
}

// =============================================================================
// Partial mock of Components XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components_object
// =============================================================================
export class Components {
  public utils = new Utils();
  public interfaces = new Interfaces();
}
