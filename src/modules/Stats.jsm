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

var EXPORTED_SYMBOLS = ['Stats'];

// The data in the StoredStats object is written to a file so that the
// information is available across sessions. This is the filename in the
// {PROFILE}/requestpolicy/ directory that is used.
const STORED_STATS_FILENAME = 'telemetry-study.json';

Components.utils.import("resource://requestpolicy/FileUtil.jsm");
Components.utils.import('resource://requestpolicy/Logger.jsm');


/**
 * Statistics gathering.
 */
var Stats = {
  deleteFile : function() {
    ruleData.deleteFile();
  }
};

var ruleData = {
  deleteFile : function() {
    try {
      var file = FileUtil.getRPUserDir();
      file.appendRelativePath(STORED_STATS_FILENAME);
      file.remove(false);
    } catch (e) {
      Logger.dump('Unable to delete stored stats: ' + e);
    }
  }

};

