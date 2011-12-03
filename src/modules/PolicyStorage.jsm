/*
 * ***** BEGIN LICENSE BLOCK *****
 * 
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

var EXPORTED_SYMBOLS = ["PolicyStorage"];

const CI = Components.interfaces;
const CC = Components.classes;

if (!requestpolicy) {
  var requestpolicy = {
    mod : {}
  };
}

Components.utils.import("resource://requestpolicy/FileUtil.jsm",
    requestpolicy.mod);
Components.utils.import("resource://requestpolicy/Policy.jsm",
    requestpolicy.mod);

/**
 * Version number of the filter storage file format.
 * @type Integer
 */
const formatVersion = 3;

/**
 * File that the filter list has been loaded from and should be saved to
 * @type nsIFile
 */
var sourceFile = null;

//
var PolicyStorage = {

  /**
   * @return {RawPolicy}
   */
  loadRawPolicyFromFile : function(/**string*/ filename) {
    // TODO: get a stream and use the mozilla json interface to decode from stream.
    var policyFile = requestpolicy.mod.FileUtil.getRPUserDir("policies");
    // TODO: maybe exercise additional paranoia and sanitize the filename
    // even though we're already useing "appendRelativePath".
    policyFile.appendRelativePath(filename);
    var str = requestpolicy.mod.FileUtil.fileToString(policyFile);
    var rawPolicy = new requestpolicy.mod.RawPolicy(str);
    return rawPolicy;
  },

  saveRawPolicyToFile : function(/**RawPolicy*/ policy, /**string*/ filename) {
    // TODO: get a stream and use the mozilla json interface to encode to stream.
    var policyFile = requestpolicy.mod.FileUtil.getRPUserDir("policies");
    policyFile.appendRelativePath(filename);
    requestpolicy.mod.FileUtil.stringToFile(JSON.stringify(policy), policyFile);
  }

};
