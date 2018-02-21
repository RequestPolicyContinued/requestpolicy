// Some mocks for /gre/modules/NetUtil.jsm
// Warning : those mock must be only used for unit testing purpose
// Warning : Those mocks are partial, add functions if needed

// =============================================================================
// Partial mock of nsIInputStream XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIChannel
// =============================================================================

class nsIInputStream {
  available() {
    return 0;
  }

  close() {}
}

// =============================================================================
// Partial mock of nsIChannel XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIChannel
// =============================================================================
class nsIChannel {
  open() {
    return new nsIInputStream();
  }
}

// =============================================================================
// Partial mock of NetUtil.jsm
// See : https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/NetUtil.jsm
// =============================================================================

export class NetUtil {
  newURI(uri, charset) {
    return "";
  }

  newChannel(uriObj) {
    return new nsIChannel();
  }

  readInputStreamToString(inputStream, count, charset) {
    return "";
  }

  asyncFetch(source, callback) {
    return "";
  }
}
