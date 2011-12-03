/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * 
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 * 
 * ***** END LICENSE BLOCK *****
 */

var EXPORTED_SYMBOLS = ["FileUtil"]

const CI = Components.interfaces;
const CC = Components.classes;

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/Services.jsm",
    requestpolicy.mod);

const REQUESTPOLICY_DIR = "requestpolicy";

var FileUtil = {

  /**
   * Returns the lines of the file in an array.
   * 
   * @param {nsIFile}
   *          file
   */
  fileToArray : function(file) {
    var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
        .createInstance(Components.interfaces.nsIFileInputStream);
    stream.init(file, 0x01, 0444, 0);
    stream.QueryInterface(Components.interfaces.nsILineInputStream);
    var line = {}, lines = [], hasmore;
    do {
      hasmore = stream.readLine(line);
      lines.push(line.value);
    } while (hasmore);
    stream.close();
    return lines;
  },

  /**
   * Returns the contents of the file as a string.
   * 
   * @param {nsIFile}
   *          file
   */
  fileToString : function(file) {
    var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
        .createInstance(Components.interfaces.nsIFileInputStream);
    stream.init(file, 0x01, 0444, 0);
    stream.QueryInterface(Components.interfaces.nsILineInputStream);
    
    var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
                  createInstance(Components.interfaces.nsIConverterInputStream);
    cstream.init(stream, "UTF-8", 0, 0);
    
    var str = "";
    var data = {};
    do { 
      // Read as much as we can and put it in |data.value|.
      read = cstream.readString(0xffffffff, data);
      str += data.value;
    } while (read != 0);
    cstream.close(); // This closes |fstream|.
    
    return str;
  },

  /**
   * Writes each element of an array to a line of a file (truncates the file if
   * it exists, creates it if it doesn't).
   * 
   * @param {Array}
   *          lines
   * @param {nsIFile}
   *          file
   */
  arrayToFile : function(lines, file) {
    var stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
        .createInstance(Components.interfaces.nsIFileOutputStream);
    // write, create, append on write, truncate
    stream.init(file, 0x02 | 0x08 | 0x10 | 0x20, -1, 0);

    var cos = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
        .createInstance(Components.interfaces.nsIConverterOutputStream);
    cos.init(stream, "UTF-8", 4096, 0x0000);

    for (var i = 0; i < lines.length; i++) {
      cos.writeString(lines[i] + "\n");
    }
    cos.close();
    stream.close();
  },

  /**
   * Writes a string to a file (truncates the file if it exists, creates it if
   * it doesn't).
   * 
   * @param {String}
   *          str
   * @param {nsIFile}
   *          file
   */
  stringToFile : function(str, file) {
    var stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
        .createInstance(Components.interfaces.nsIFileOutputStream);
    // write, create, append on write, truncate
    stream.init(file, 0x02 | 0x08 | 0x10 | 0x20, -1, 0);

    var cos = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
        .createInstance(Components.interfaces.nsIConverterOutputStream);
    cos.init(stream, "UTF-8", 4096, 0x0000);
    cos.writeString(str);
    cos.close();
    stream.close();
  },

  /**
   * Returns a file object for a path relative to the user's "requestpolicy"
   * under their profile directory. The "requestpolicy" directory is created if
   * it doesn't already exist.
   * 
   * @return {nsILocalFile}
   */
  getRPUserDir : function(subdirectory) {
    var profileDir = requestpolicy.mod.Services.directoryService
          .get("ProfD", CI.nsIFile);
    var file = profileDir.clone().QueryInterface(CI.nsILocalFile);
    file.appendRelativePath(REQUESTPOLICY_DIR);
    if(!file.exists()) {
      file.create(CI.nsIFile.DIRECTORY_TYPE, 0700);
    }

    if (subdirectory) {
      file.appendRelativePath(subdirectory);
      if(!file.exists()) {
        file.create(CI.nsIFile.DIRECTORY_TYPE, 0700);
      }
    }

    return file;
  }
};
