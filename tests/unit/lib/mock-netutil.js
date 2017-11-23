// Some mocks for /gre/modules/NetUtil.jsm
// Warning : those mock must be only used for unit testing purpose
// Warning : Those mocks are partial, add functions if needed

// =============================================================================
// Partial mock of nsIInputStream XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIChannel
// =============================================================================

function nsIInputStream() {};

nsIInputStream.prototype.available = function() {
  return 0;
};

nsIInputStream.prototype.close = function() {};

// =============================================================================
// Partial mock of nsIChannel XPCOM Class
// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIChannel
// =============================================================================
function nsIChannel() {};

nsIChannel.prototype.open = function() {
  return new nsIInputStream();
};

// =============================================================================
// Partial mock of NetUtil.jsm
// See : https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/NetUtil.jsm
// =============================================================================

function NetUtil() {};

NetUtil.prototype.newURI = function(uri, charset) {
  return "";
};

NetUtil.prototype.newChannel = function(uriObj) {
  return new nsIChannel();
};

NetUtil.prototype.readInputStreamToString = function(inputStream, count, charset) {
  return "";
};

module.exports = NetUtil;
