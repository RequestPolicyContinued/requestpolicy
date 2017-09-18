/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
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

"use strict";

//==============================================================================
// utilities and constants
//==============================================================================

/**
 * creates an integer from the arguments
 *
 * The reason for this function is that octal integer literals (integer with
 * leading zero like 0700) are deprecated. Using them would cause a JavaScript
 * strict warning. See http://www.ecma-international.org/ecma-262/5.1/#sec-B.1
 */
function getOctalInt() {
  let result = 0;
  for (let i = 0, len = arguments.length; i < len; ++i) {
    result += arguments[len - i - 1] * Math.pow(8, i);
  }
  return result;
}

const OCTAL_444 = getOctalInt(4, 4, 4); // octal: 0444
const OCTAL_700 = getOctalInt(7, 0, 0); // octal: 0700

const REQUESTPOLICY_DIR = "requestpolicy";

//==============================================================================
// FileUtil
//==============================================================================

export var FileUtil = {

  /**
   * Returns the lines of the file in an array.
   *
   * @param {nsIFile} file
   */
  fileToArray: function(file) {
    var stream = Cc["@mozilla.org/network/file-input-stream;1"]
        .createInstance(Ci.nsIFileInputStream);
    stream.init(file, 0x01, OCTAL_444, 0);
    stream.QueryInterface(Ci.nsILineInputStream);
    var line = {};
    var lines = [];
    var hasmore;
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
   * @param {nsIFile} file
   */
  fileToString: function(file) {
    // FIXME: This function MUST NOT check for the file to exist,
    //        otherwise the subscriptions are not fetched at all,
    //        for whatever reason.
    //
    //        Another issue, maybe it's the same as above, is that
    //        `loadSubscriptionRules()` catches exceptions and by
    //        that knows if the file exists or not. See also
    //        `loadRawRulesetFromFile()`.
    //
    //        The subscription system urgently needs to rewritten,
    //        see issue #597.
    //if (file.exists() === false) {
    //  // prevent NS_ERROR_FILE_NOT_FOUND
    //  return "";
    //}
    var stream = Cc["@mozilla.org/network/file-input-stream;1"]
        .createInstance(Ci.nsIFileInputStream);
    stream.init(file, 0x01, OCTAL_444, 0);
    stream.QueryInterface(Ci.nsILineInputStream);

    var cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].
                  createInstance(Ci.nsIConverterInputStream);
    cstream.init(stream, "UTF-8", 0, 0);

    var str = "";
    var data = {};
    let read;
    do {
      // Read as much as we can and put it in |data.value|.
      read = cstream.readString(0xffffffff, data);
      str += data.value;
    } while (read !== 0);
    cstream.close(); // This closes |fstream|.

    return str;
  },

  /**
   * Writes each element of an array to a line of a file (truncates the file if
   * it exists, creates it if it doesn't).
   *
   * @param {Array} lines
   * @param {nsIFile} file
   */
  arrayToFile: function(lines, file) {
    var stream = Cc["@mozilla.org/network/file-output-stream;1"]
        .createInstance(Ci.nsIFileOutputStream);
    // write, create, append on write, truncate
    stream.init(file, 0x02 | 0x08 | 0x10 | 0x20, -1, 0);

    var cos = Cc["@mozilla.org/intl/converter-output-stream;1"]
        .createInstance(Ci.nsIConverterOutputStream);
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
   * @param {string} str
   * @param {nsIFile} file
   */
  stringToFile: function(str, file) {
    var stream = Cc["@mozilla.org/network/file-output-stream;1"]
        .createInstance(Ci.nsIFileOutputStream);
    // write, create, append on write, truncate
    stream.init(file, 0x02 | 0x08 | 0x10 | 0x20, -1, 0);

    var cos = Cc["@mozilla.org/intl/converter-output-stream;1"]
        .createInstance(Ci.nsIConverterOutputStream);
    cos.init(stream, "UTF-8", 4096, 0x0000);
    cos.writeString(str);
    cos.close();
    stream.close();
  },

  /**
   * Returns a file object for a path relative to the user's "requestpolicy"
   * under their profile directory. The "requestpolicy" directory is created if
   * it doesn't already exist. Each subdir, if specified, is created if it does
   * not exist.
   *
   * @return {nsIFile}
   */
  getRPUserDir: function(subdir1, subdir2, subdir3) {
    var profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
    var file = profileDir.clone();
    file.appendRelativePath(REQUESTPOLICY_DIR);
    if (!file.exists()) {
      file.create(Ci.nsIFile.DIRECTORY_TYPE, OCTAL_700);
    }

    if (subdir1) {
      file.appendRelativePath(subdir1);
      if (!file.exists()) {
        file.create(Ci.nsIFile.DIRECTORY_TYPE, OCTAL_700);
      }

      if (subdir2) {
        file.appendRelativePath(subdir2);
        if (!file.exists()) {
          file.create(Ci.nsIFile.DIRECTORY_TYPE, OCTAL_700);
        }

        if (subdir3) {
          file.appendRelativePath(subdir3);
          if (!file.exists()) {
            file.create(Ci.nsIFile.DIRECTORY_TYPE, OCTAL_700);
          }
        }
      }
    }

    return file;
  }
};
