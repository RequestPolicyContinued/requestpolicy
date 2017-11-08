/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2011 Justin Samuel
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

import {RawRuleset} from "content/lib/ruleset";
import * as FileUtils from "content/lib/utils/file-utils";

// =============================================================================
// RulesetStorage
// =============================================================================

export const RulesetStorage = {
  /**
   * @param {String} policyName
   * @param {String?} subscriptionListName
   * @return {RawRuleset?}
   */
  loadRawRulesetFromFile(policyName, subscriptionListName) {
    const filename = policyName + ".json";
    // TODO: get a stream and use the mozilla json interface to
    //       decode from stream.
    const policyFile = FileUtils.getRPUserDir("policies");
    // TODO: maybe exercise additional paranoia and sanitize the filename
    // even though we're already useing "appendRelativePath".
    if (subscriptionListName) {
      policyFile.appendRelativePath("subscriptions");
      policyFile.appendRelativePath(subscriptionListName);
    }
    policyFile.appendRelativePath(filename);
    if (!policyFile.exists()) return null;
    let str = FileUtils.fileToString(policyFile);
    return new RawRuleset(str);
  },

  /**
   * @param {RawRuleset} policy
   * @param {String} policyName
   * @param {String?} subscriptionListName
   */
  saveRawRulesetToFile(policy, policyName, subscriptionListName) {
    const filename = policyName + ".json";
    // TODO: get a stream and use the mozilla json interface to
    //       encode to stream.
    let policyFile;
    if (subscriptionListName) {
      policyFile = FileUtils.getRPUserDir("policies",
            "subscriptions", subscriptionListName);
    } else {
      policyFile = FileUtils.getRPUserDir("policies");
    }
    policyFile.appendRelativePath(filename);
    FileUtils.stringToFile(JSON.stringify(policy), policyFile);
  },
};
