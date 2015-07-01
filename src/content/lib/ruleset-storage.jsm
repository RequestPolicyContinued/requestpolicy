/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

let EXPORTED_SYMBOLS = ["RulesetStorage"];

Cu.import("chrome://rpcontinued/content/lib/script-loader.jsm");
ScriptLoader.importModules([
  "lib/ruleset",
  "lib/utils/files"
], this);


let RulesetStorage = {

  /**
   * @return {RawRuleset}
   */
  loadRawRulesetFromFile : function(/**string*/ filename,
        /**string*/ subscriptionListName) {
    // TODO: change filename argument to policyname and we'll append the '.json'
    // TODO: get a stream and use the mozilla json interface to decode from stream.
    var policyFile = FileUtil.getRPUserDir("policies");
    // TODO: maybe exercise additional paranoia and sanitize the filename
    // even though we're already useing "appendRelativePath".
    if (subscriptionListName) {
      policyFile.appendRelativePath('subscriptions');
      policyFile.appendRelativePath(subscriptionListName);
    }
    policyFile.appendRelativePath(filename);
    // Important note: Do not catch the error thrown by the fileToString!
    // There is no check for the existence of the file, because
    // loadSubscriptionRules catches errors and then knows if a file
    // existed or not. This is a bad implementation.
    // TODO: solve this mess
    let str = FileUtil.fileToString(policyFile);
    //let str;
    //if (policyFile.exists()) {
    //  str = FileUtil.fileToString(policyFile);
    //}
    return new RawRuleset(str);
  },

  saveRawRulesetToFile : function(/**RawRuleset*/ policy, /**string*/ filename,
        /**string*/ subscriptionListName) {
    // TODO: change filename argument to policyname and we'll append the '.json'
    // TODO: get a stream and use the mozilla json interface to encode to stream.
    if (subscriptionListName) {
      var policyFile = FileUtil.getRPUserDir("policies",
            'subscriptions', subscriptionListName);
    } else {
      var policyFile = FileUtil.getRPUserDir("policies");
    }
    policyFile.appendRelativePath(filename);
    FileUtil.stringToFile(JSON.stringify(policy), policyFile);
  }

};
