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

var EXPORTED_SYMBOLS = ["FileUtils"]

var FileUtils = {

  /**
   * Returns the lines of the file in an array.
   * 
   * @param {nsIFile}
   *            file
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
   * Writes each element of an array to a line of a file (truncates the file if
   * it exists, creates it if it doesn't).
   * 
   * @param {Array}
   *            lines
   * @param {nsIFile}
   *            file
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
  }

};
