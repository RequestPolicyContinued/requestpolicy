// Some mocks for /gre/modules/Services.jsm
// Warning : those mock must be only used for unit testing purpose
// Warning : Those mocks are partial, add functions if needed

// =============================================================================
// Partial mock of nsIPrefBranch XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefBranch
// =============================================================================

class nsIPrefBranch {
  QueryInterface() {
    return null;
  }
}

// =============================================================================
// Partial mock of nsIPrefService XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPrefService
// =============================================================================

class nsIPrefService {
  getBranch(aPrefRoot) {
    return new nsIPrefBranch();
  }

  savePrefFile(aFile) {}
}

// =============================================================================
// Partial mock of Services.jsm
// See : https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Services.jsm
// =============================================================================

export class Services {
  prefs = new nsIPrefService();
  locale = {};
}
