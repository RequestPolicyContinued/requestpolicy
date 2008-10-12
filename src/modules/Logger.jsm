var EXPORTED_SYMBOLS = ["Logger"]

/**
 * Provides logging methods
 */
Logger = new function() {

  this.TYPE_CONTENT = 1; // content whose origin isn't known more specifically
  this.TYPE_META_REFRESH = 2; // info related to meta refresh
  this.TYPE_HEADER_REDIRECT = 4; // info related to header redirects
  this.TYPE_INTERNAL = 8; // internal happenings of the extension
  this.TYPE_ERROR = 16; // errors
  this.TYPE_ALL = 0x0 - 1; // all

  this.LEVEL_OFF = Number.MAX_VALUE; // no logging
  this.LEVEL_SEVERE = 1000;
  this.LEVEL_WARNING = 900;
  this.LEVEL_INFO = 800;
  this.LEVEL_DEBUG = 700;
  this.LEVEL_ALL = Number.MIN_VALUE; // log everything

  this._TYPE_NAMES = {};
  this._TYPE_NAMES[this.TYPE_CONTENT.toString()] = "CONTENT";
  this._TYPE_NAMES[this.TYPE_META_REFRESH.toString()] = "META_REFRESH";
  this._TYPE_NAMES[this.TYPE_HEADER_REDIRECT.toString()] = "HEADER_REDIRECT";
  this._TYPE_NAMES[this.TYPE_INTERNAL.toString()] = "INTERNAL";
  this._TYPE_NAMES[this.TYPE_ERROR.toString()] = "ERROR";

  this._LEVEL_NAMES = {};
  this._LEVEL_NAMES[this.LEVEL_SEVERE.toString()] = "SEVERE";
  this._LEVEL_NAMES[this.LEVEL_WARNING.toString()] = "WARNING";
  this._LEVEL_NAMES[this.LEVEL_INFO.toString()] = "INFO";
  this._LEVEL_NAMES[this.LEVEL_DEBUG.toString()] = "DEBUG";

  // These can be set to change logging level, what types of messages are
  // logged, and to enable/disable logging.
  this.level = this.LEVEL_INFO;
  this.types = this.TYPE_ALL;
  this.enabled = true;

};

Logger._doLog = function(level, type, message) {
  if (this.enabled && level >= this.level && this.types & type) {
    var levelName = this._LEVEL_NAMES[level.toString()];
    var typeName = this._TYPE_NAMES[type.toString()];
    dump("[CSRPolicy] [" + levelName + "] [" + typeName + "] " + message + "\n");
  }
};

Logger.severe = function(type, message) {
  this._doLog(this.LEVEL_SEVERE, type, message);
};

Logger.warning = function(type, message) {
  this._doLog(this.LEVEL_WARNING, type, message);
};

Logger.info = function(type, message) {
  this._doLog(this.LEVEL_INFO, type, message);
};

Logger.debug = function(type, message) {
  this._doLog(this.LEVEL_DEBUG, type, message);
};

Logger.dump = function(message) {
  this.info(this.TYPE_INTERNAL, message);
}

Logger.vardump = function(obj, name) {
  if (name != undefined) {
    this.dump(name + " : " + obj);
  } else {
    this.dump(obj);
  }
  for (var i in obj) {
    this.dump("    => key: " + i + " / value: " + obj[i]);
  }
}
