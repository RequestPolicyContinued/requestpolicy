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

import {Log as log} from "content/models/log";
import {DomainUtil} from "content/lib/utils/domain-utils";
import {C} from "content/data/constants";

// =============================================================================
// utilities
// =============================================================================

function dprint(msg) {
  log.info("[POLICY] " + msg);
}

function dwarn(msg) {
  log.warn("[POLICY] " + msg);
}

/* eslint-disable max-len */
/*
// We expect the following data structure:
exampleRawDataObj = {
  "metadata" : {
    "version" : 1,
    "name" : "policyname", // unique name for this policy, used in filename
    "source" : "user" // "user" or "subscription"
  },
  "entries" : {
    "allow" : [
      // 'o' => origin
      // 'd' => destination
      // 's' => scheme
      // 'port' => port ('*' for any, integer for specific port, -1 for default port [default])
      // 'pathPre' => path prefix (must start with "/")
      // 'pathRegex' => path regex (no enclosing characters: '^/abc' not '/^\/abc/')
      // 'pri' => priority (integer) --- do we want this?
      {'o':{'h':'www.foo.com'},'d':{'h':'www.bar.com'}},
      {'o':{'h':'www.example.com','s':'https','pathPre':'/test/'},'d':{'h':'www.bar.com', 's':'https'}},
    ],
    "deny" : [
      {'d':{'h':'google-analytics.com'}},
      {'o':{'s':'https'},'d':{'s':'http'}},
    ]
  }
};
*/
/* eslint-enable max-len */

/*
// currently unused.
function dump(arr, level=0) {
  var dumped_text = "";

  //The padding given at the beginning of the line.
  var level_padding = "";
  for (let j = 0; j < level + 1; j++) {
    level_padding += "    ";
  }

  if (typeof arr === "object") { //Array/Hashes/Objects
    for (let item in arr) {
      let value = arr[item];

      if (typeof value === "object") { //If it is an array,
        dumped_text += level_padding + "'" + item + "' ...\n";
        dumped_text += dump(value, level + 1);
      } else {
        dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
      }
    }
  } else { //Stings/Chars/Numbers etc.
    dumped_text = "===>" + arr + "<===(" + typeof arr + ")";
  }
  return dumped_text;
}
*/

// =============================================================================
// RawRuleset
// =============================================================================

export class RawRuleset {
  constructor(data) {
    this._metadata = {"version": 1};
    this._entries = {};
    if (data) {
      // TODO: sanity check imported data, decide whether to ignore unrecognized
      // keys.
      // TODO: wrap in try/catch block

      // dprint(typeof data);
      // dprint(dump(data));
      this._checkDataObj(data);
      this._metadata = data.metadata;
      this._entries = data.entries;
    }
    if (!this._entries.allow) {
      this._entries.allow = [];
    }
    if (!this._entries.deny) {
      this._entries.deny = [];
    }
  }

  toString() {
    return "[RawRuleset " + this._metadata + " " + this._entries + "]";
  }

  getAllowRuleCount() {
    return this._entries.allow.length;
  }

  getDenyRuleCount() {
    return this._entries.deny.length;
  }

  _addEntryHelper(entryPart, policy) {
    let rules;
    if (entryPart.h) {
      rules = policy.addHost(entryPart.h).rules;
    } else {
      rules = policy.rules;
    }
    let r = rules.add(
        "s" in entryPart ? entryPart.s : undefined,
        "port" in entryPart ? entryPart.port : undefined);
    if (entryPart.pathPre) {
      r.pathPre = entryPart.pathPre;
    } else if (entryPart.pathRegex) {
      r.pathRegex = new RegExp(entryPart.pathRegex);
    }
    return [rules, r];
  }

  _addEntryToRuleset(entry, ruleAction, policy) {
    // TODO: add an "entryPart" format verifier/normalizer.
    //    notes: 'pathPre' => path prefix (must start with "/")
    const o = entry.o;
    const d = entry.d;
    // eslint-disable-next-line no-unused-vars
    let rules;
    let r;

    // dprint("_addEntryToRuleset: " + o + " " + d + " " + ruleAction);

    if (o && d) {
      [rules, r] = this._addEntryHelper(o, policy);
      r.initDestinations();
      [rules, r] = this._addEntryHelper(d, r.destinations);
      // r.destinationRuleAction = ruleAction;
      if (ruleAction === C.RULE_ACTION_ALLOW) {
        r.allowDestination = true;
      } else {
        r.denyDestination = true;
      }
    } else if (o && !d) {
      [rules, r] = this._addEntryHelper(o, policy);
      // r.originRuleAction = ruleAction;
      if (ruleAction === C.RULE_ACTION_ALLOW) {
        r.allowOrigin = true;
      } else {
        r.denyOrigin = true;
      }
    } else if (!o && d) {
      [rules, r] = this._addEntryHelper(d, policy);
      // r.destinationRuleAction = ruleAction;
      if (ruleAction === C.RULE_ACTION_ALLOW) {
        r.allowDestination = true;
      } else {
        r.denyDestination = true;
      }
    } else {
      // TODO: Issue warning about bad entry and return or throw error.
      return;
    }
  }

  ruleExists(ruleAction, ruleData) {
    const actionStr = ruleAction === C.RULE_ACTION_ALLOW ? "allow" :
        ruleAction === C.RULE_ACTION_DENY ? "deny" : "";
    if (!actionStr) {
      // eslint-disable-next-line no-throw-literal
      throw "Invalid ruleAction: " + ruleAction;
    }

    const ruleStr = Ruleset.rawRuleToCanonicalString(ruleData);
    const entries = this._entries[actionStr];
    for (let i in entries) {
      const curRuleStr = Ruleset.rawRuleToCanonicalString(entries[i]);
      if (ruleStr === curRuleStr) {
        return true;
      }
    }
    return false;
  }

  /**
   * Adds the rule to the entries of this |RawRuleset| instance as well as the
   * |Ruleset| optionally provided as the policy argument.
   *
   * @param {RULE_ACTION_ALLOW|RULE_ACTION_DENY} ruleAction
   * @param {RuleSpec} ruleData
   * @param {Ruleset} policy
   */
  addRule(ruleAction, ruleData, policy) {
    // XXX: remove loggings
    // dprint("addRule: adding entry");
    const actionStr = ruleAction === C.RULE_ACTION_ALLOW ? "allow" :
        ruleAction === C.RULE_ACTION_DENY ? "deny" : "";
    if (!actionStr) {
      // eslint-disable-next-line no-throw-literal
      throw "Invalid ruleAction: " + ruleAction;
    }

    // Only add the raw policy entry if it doesn't already exist.
    if (!this.ruleExists(ruleAction, ruleData)) {
      this._entries[actionStr].push(ruleData);
    }

    if (policy) {
      this._addEntryToRuleset(ruleData, ruleAction, policy);
    }
  }

  // _removeEntryHelper(entryPart, policy) {
  //     if (entryPart.h) {
  //       var originEntry = policy.getHost(entryPart.h);
  //       if (!originEntry) {
  //         return null;
  //       }
  //       var rules = originEntry.rules;
  //     } else {
  //       rules = policy.rules;
  //     }
  //     return rules.get(entryPart.s, entryPart.port);
  // },

  _removeEntryFromRuleset(entry, ruleAction, policy) {
    // TODO: add an "entryPart" format verifier/normalizer.
    //    notes: 'pathPre' => path prefix (must start with "/")
    const o = entry.o;
    const d = entry.d;
    let rules;
    let r;

    // TODO: refactor like done with _addEntryToRuleset

    if (o && d) {
      if (o.h) {
        let originEntry = policy.getHost(o.h);
        if (!originEntry) {
          return;
        }
        rules = originEntry.rules;
      } else {
        rules = policy.rules;
      }
      r = rules.get(o.s, o.port);
      if (!r || !r.destinations) {
        return;
      }

      if (d.h) {
        let destEntry = r.destinations.getHost(d.h);
        if (!destEntry) {
          return;
        }
        rules = destEntry.rules;
      } else {
        rules = r.destinations.rules;
      }
      r = rules.get(d.s, d.port);
      if (!r) {
        return;
      }

      // if (r.destinationRuleAction === ruleAction) {
      //   r.destinationRuleAction = null;
      // }
      // dprint("_removeEntryFromRuleset: got rule to alter: " + r.toString());
      if (ruleAction === C.RULE_ACTION_ALLOW) {
        r.allowDestination = null;
      } else if (ruleAction === C.RULE_ACTION_DENY) {
        r.denyDestination = null;
      } else {
        // eslint-disable-next-line no-throw-literal
        throw "Invalid rule type: " + ruleAction;
      }
    } else if (o && !d) {
      if (o.h) {
        let originEntry = policy.getHost(o.h);
        if (!originEntry) {
          return;
        }
        rules = originEntry.rules;
      } else {
        rules = policy.rules;
      }
      r = rules.get(o.s, o.port);
      if (!r) {
        return;
      }

      // if (r.originRuleAction === ruleAction) {
      //   r.originRuleAction = null;
      // }
      if (ruleAction === C.RULE_ACTION_ALLOW) {
        r.allowOrigin = null;
      } else if (ruleAction === C.RULE_ACTION_DENY) {
        r.denyOrigin = null;
      } else {
        // eslint-disable-next-line no-throw-literal
        throw "Invalid rule type: " + ruleAction;
      }
    } else if (!o && d) {
      if (d.h) {
        let destEntry = policy.getHost(d.h);
        if (!destEntry) {
          return;
        }
        rules = destEntry.rules;
      } else {
        rules = policy.rules;
      }
      r = rules.get(d.s, d.port);
      if (!r) {
        return;
      }

      // if (r.destinationRuleAction === ruleAction) {
      //   r.destinationRuleAction = null;
      // }
      if (ruleAction === C.RULE_ACTION_ALLOW) {
        r.allowDestination = null;
      } else if (ruleAction === C.RULE_ACTION_DENY) {
        r.denyDestination = null;
      } else {
        // eslint-disable-next-line no-throw-literal
        throw "Invalid rule type: " + ruleAction;
      }
    } else {
      // TODO: Issue warning about bad entry and return or throw error.
      return;
    }
  }

  /**
   * Removes the rule from the entries of this |RawRuleset|
   * instance as well as the |Ruleset| optionally provided
   * as the policy argument.
   *
   * @param {RULE_ACTION_ALLOW|RULE_ACTION_DENY} ruleAction
   * @param {RuleSpec} ruleData
   * @param {Ruleset} policy
   */
  removeRule(ruleAction, ruleData, policy) {
    // XXX: remove loggings
    // dprint("removeRule: removing entry");
    const actionStr = ruleAction === C.RULE_ACTION_ALLOW ? "allow" :
        ruleAction === C.RULE_ACTION_DENY ? "deny" : "";
    if (!actionStr) {
      // eslint-disable-next-line no-throw-literal
      throw "Invalid ruleAction: " + ruleAction;
    }
    const ruleStr = Ruleset.rawRuleToCanonicalString(ruleData);
    const entries = this._entries[actionStr];
    let removeIndex = false;
    for (let i in entries) {
      const curRuleStr = Ruleset.rawRuleToCanonicalString(entries[i]);
      if (ruleStr === curRuleStr) {
        // |i| is a string which will cause bugs when we use it in arithmetic
        // expressions below. Why does this form of iterator give us string
        // indexes? I have no idea but it's something to watch out for.
        removeIndex = Number(i);
        break;
      }
    }
    if (removeIndex !== false) {
      const begin = entries.slice(0, removeIndex);
      const end = entries.slice(Number(removeIndex) + 1);
      if (begin.length + end.length + 1 !== entries.length) {
        // eslint-disable-next-line no-throw-literal
        throw "Bad slicing (Probably bad math or not reading the docs).";
      }
      this._entries[actionStr] = begin.concat(end);
    }

    if (policy) {
      this._removeEntryFromRuleset(ruleData, ruleAction, policy);
    }
  }

  /**
   * Returns a |Ruleset| object initialized to reflect the contents of this
   * |RawRuleset|.
   *
   * @param {string} name
   * @return {Ruleset}
   */
  toRuleset(name) {
    const policy = new Ruleset(name);

    for (let actionStr in this._entries) {
      // dprint("actionStr: " + actionStr);
      if (actionStr !== "allow" && actionStr !== "deny") {
        dwarn("Invalid entry type: " + actionStr);
        continue;
      }
      const ruleAction = actionStr === "allow" ? C.RULE_ACTION_ALLOW :
          C.RULE_ACTION_DENY;
      const entryArray = this._entries[actionStr];
      for (let i in entryArray) {
        // dprint("toRuleset: adding entry");
        this._addEntryToRuleset(entryArray[i], ruleAction, policy);
      }
    }

    return policy;
  }

  _checkDataObj(dataObj) {
    if (!("metadata" in dataObj)) {
      // eslint-disable-next-line no-throw-literal
      throw "Invalid policy data: no 'metadata' key";
    }
    if (!("version" in dataObj.metadata)) {
      // eslint-disable-next-line no-throw-literal
      throw "Invalid policy data: no 'version' key";
    }
    if (dataObj.metadata.version !== 1) {
      // eslint-disable-next-line no-throw-literal
      throw "Wrong metadata version. Expected 1, was " +
          dataObj.metadata.version;
    }
    if (!("entries" in dataObj)) {
      // eslint-disable-next-line no-throw-literal
      throw "Invalid policy data: no 'entries' key";
    }
  }

  /**
   * Returns a simple object representing this |RawRuleset|.
   *
   * @return {Object}
   */
  get raw() {
    // Note: unrecognized keys in the metadata and entries are preserved.
    return {"metadata": this._metadata, "entries": this._entries};
  }
}

// =============================================================================
// Rules
// =============================================================================

class Rules {
  constructor() {
    this._rules = [];
  }

  print(depth = 0) {
    for (let rule of this._rules) {
      rule.print(depth);
    }
  }

  getRules() {
    return this._rules;
  }

  isEmpty() {
    return this._rules.length === 0;
  }

  * [Symbol.iterator]() {
    yield* this._rules;
  }

  get(scheme, port) {
    let rule = new Rule(scheme, port);
    for (let existingRule of this._rules) {
      if (existingRule.isEqual(rule)) {
        return existingRule;
      }
    }
    return null;
  }

  add(scheme, port) {
    let newRule = new Rule(scheme, port);
    for (let existingRule of this._rules) {
      if (existingRule.isEqual(newRule)) {
        return existingRule;
      }
    }
    this._rules.push(newRule);
    return newRule;
  }
}

// =============================================================================
// Rule
// =============================================================================

/*
 * Semantics of rules:
 *   Scheme: if not specified (null), any scheme matches.
 *   Port: if not specified (null), only default ports (scheme-dependent)
 *     match. To match any port, specify "*".
 *   Path: if not specified (null), any path matches. If specified as a string,
 *     the rule matches if the the URI path begins with the rule path. If
 *     specified as a regular expression, the URI path matches if it matches
 *     the regular expression (that is, |.test()| returns true).
 */
class Rule {
  constructor(scheme, port) {
    this.scheme = scheme || null; // string
    this.port = port || null; // string

    this.path = null;

    // Either null, RULE_ACTION_ALLOW, or RULE_ACTION_DENY.
    // originRuleAction = null;
    // destinationRuleAction = null;

    this.allowOrigin = null;
    this.denyOrigin = null;
    this.allowDestination = null;
    this.denyDestination = null;

    // For origin-to-destination rules, these are the destinations.
    this.destinations = null;
  }

  toString() {
    return "[Rule " + this.scheme + " " + this.port + " " + this.path + " " +
           // TODO
           // + "originRuleAction:" + this.originRuleAction + " "
           // + "destinationRuleAction:" + this.destinationRuleAction + " "
           "allowOrigin:" + this.allowOrigin + " " +
           "denyOrigin:" + this.denyOrigin + " " +
           "allowDestination:" + this.allowDestination + " " +
           "denyDestination:" + this.denyDestination + " " +
           "]";
  }

  print(depth) {
    depth = depth || 0;
    let indent = "";
    for (let i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    if (this.destinations) {
      dprint(indent + "  " + "destinations:");
      this.destinations.print(depth + 1);
    }
  }

  isEqual(otherRule) {
    return this.scheme === otherRule.scheme &&
        this.port === otherRule.port &&
        this.path === otherRule.path;
  }

  initDestinations() {
    if (this.destinations) {
      return;
    }
    this.destinations = new Ruleset();
  }

  /**
   * @param  {nsIURI} uriObj
   * @param  {boolean} endpointSpecHasHost Whether the endpoint spec
   *     corresponding to this "Rule" instance has a host.
   * @return {boolean}
   */
  isMatch(uriObj, endpointSpecHasHost) {
    if (this.scheme && this.scheme !== "*" && this.scheme !== uriObj.scheme) {
      // dprint("isMatch: wrong scheme (uri: '" + uriObj.scheme + "', rule: '" +
      //        this.scheme + "')");
      return false;
    }

    // Check the port only in case the URI has a host at all.
    if (DomainUtil.uriObjHasPort(uriObj)) {
      if (this.port) {
        // If the rule's port is "*" it means any port. We use this convention
        // because we assume an empty port in a rule means default ports rather
        // than any port.
        if (this.port !== "*") {
          let rulePort = parseInt(this.port, 10);
          if (
              rulePort === uriObj.port ||
              uriObj.port === -1 &&
                  rulePort === DomainUtil.
                               getDefaultPortForScheme(uriObj.scheme)
          ) {
            // Port Match is OK, so continue
          } else {
            // dprint(
            //     "isMatch: wrong port (not the port specified by the rule)");
            return false;
          }
        }
      } else {
        if (!endpointSpecHasHost) {
          // Both host and port are undefined, so skip the default-port-check.
        } else {
          if (!DomainUtil.hasStandardPort(uriObj)) {
            // dprint("isMatch: wrong port (not the default port and the " +
            //     "rule assumes default)");
            return false;
          }
        }
      }
    } else if (this.port) {
      // The rule specifies a port, but the URI has no port.
      return false;
    }

    if (this.path) {
      if (typeof this.path === "string") {
        if (uriObj.path.indexOf(this.path) !== 0) {
          // dprint("isMatch: wrong path (string): " +
          //     this.path + " vs " + uriObj.path);
          return false;
        }
      } else if (!this.path.test(uriObj.path)) {
        // dprint("isMatch: wrong path (regex)");
        return false;
      }
    }
    // dprint("isMatch: MATCH");
    return true;
  }
}

// =============================================================================
// DomainEntry
// =============================================================================

class DomainEntry {
  constructor(name, fullName, higher) {
    if (typeof name !== "string" && name !== null) {
      // eslint-disable-next-line no-throw-literal
      throw "Invalid type: DomainEntry name must be a string or null.";
    }
    this._name = name;
    this.fullName = fullName;

    /**
     * A dictionary whose keys are strings of domain part names and values are
     * further DomainEntry objects.
     */
    this._lower = {};
    this._higher = higher;

    this.rules = new Rules();
  }

  toString() {
    return "[DomainEntry '" + this._name + " (" + this.fullName + ")']";
  }

  print(depth) {
    depth = depth || 0;
    let indent = "";
    for (let i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    if (this.rules) {
      this.rules.print(depth + 1);
    }
    for (let entryName in this._lower) {
      this._lower[entryName].print(depth + 1);
    }
  }

  addLowerLevel(name, entry) {
    if (this._lower.hasOwnProperty(name)) {
      // eslint-disable-next-line no-throw-literal
      throw "ENTRY_ALREADY_EXISTS";
    }
    this._lower[name] = entry;
  }

  getLowerLevel(name) {
    if (this._lower.hasOwnProperty(name)) {
      return this._lower[name];
    }
    return null;
  }
}

// =============================================================================
// IPAddressEntry
// =============================================================================

class IPAddressEntry {
  constructor(address) {
    this.address = address;
    this.rules = new Rules();
  }

  toString() {
    return "[IPAddressEntry '" + this.address + "']";
  }

  print(depth) {
    depth = depth || 0;
    let indent = "";
    for (let i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    if (this.rules) {
      this.rules.print(depth + 1);
    }
  }

  deleteAllRules() {
  }
}

// =============================================================================
// Ruleset
// =============================================================================

export class Ruleset {
  /**
   * @static
   * @param {?} rawRule
   * @param {("o"|"d")} originOrDest
   * @param {?} entry
   * @param {?} rule
   */
  static _matchToRawRuleHelper(rawRule, originOrDest, entry, rule) {
    rawRule[originOrDest] = {};
    if (entry instanceof DomainEntry && entry.fullName) {
      rawRule[originOrDest].h = entry.fullName;
    } else if (entry instanceof IPAddressEntry) {
      rawRule[originOrDest].h = entry.address;
    }
    if (rule.scheme) {
      rawRule[originOrDest].s = rule.scheme;
    }
    if (rule.port) {
      rawRule[originOrDest].port = rule.port;
    }
    // TODO: path
  }

  /**
   * @static
   * @param {?} match
   * @return {RawRule}
   */
  static matchToRawRule(match) {
    // The matches are in the format
    //     [actionStr, entry, rule]
    // or
    //     [actionStr, originEntry, originRule, destEntry, destRule]
    // as returned by calls to |Ruleset.check()|.
    const rawRule = {};
    let entry;
    let rule;
    let destEntry;
    let destRule;
    let actionStr = match[0];

    if (actionStr === "origin") {
      [actionStr, entry, rule] = match;
      Ruleset._matchToRawRuleHelper(rawRule, "o", entry, rule);
    } else if (actionStr === "dest") {
      [actionStr, entry, rule] = match;
      Ruleset._matchToRawRuleHelper(rawRule, "d", entry, rule);
    } else if (actionStr === "origin-to-dest") {
      [actionStr, entry, rule, destEntry, destRule] = match;
      Ruleset._matchToRawRuleHelper(rawRule, "o", entry, rule);
      Ruleset._matchToRawRuleHelper(rawRule, "d", destEntry, destRule);
    } else {
      // eslint-disable-next-line no-throw-literal
      throw "[matchToRawRule] Invalid match type: " + actionStr +
          " from match: " + match;
    }

    return rawRule;
  }

  /**
   * @static
   * @param {?} rawRule
   * @param {("o"|"d")} originOrDest
   * @param {Array} parts
   * @return {string}
   */
  static _rawRuleToCanonicalStringHelper(rawRule, originOrDest,
      parts) {
    if (rawRule[originOrDest]) {
      parts.push("\"" + originOrDest + "\":{");
      let needComma = false;
      if (rawRule[originOrDest].h) {
        parts.push("\"h\":\"" + rawRule[originOrDest].h + "\"");
        needComma = true;
      }
      if (rawRule[originOrDest].port) {
        if (needComma) {
          parts.push(",");
        }
        parts.push("\"port\":\"" + rawRule[originOrDest].port + "\"");
      }
      if (rawRule[originOrDest].s) {
        if (needComma) {
          parts.push(",");
        }
        parts.push("\"s\":\"" + rawRule[originOrDest].s + "\"");
      }
      parts.push("}");
    }
    // TODO: pathPre and pathRegex (will need to escape strings)
    parts.push("}");
    return parts.join("");
  }

  static rawRuleToCanonicalString(rawRule) {
    const parts = ["{"];
    if (rawRule.d) {
      Ruleset._rawRuleToCanonicalStringHelper(rawRule, "d", parts);
    }
    if (rawRule.d && rawRule.o) {
      parts.push(",");
    }
    if (rawRule.o) {
      Ruleset._rawRuleToCanonicalStringHelper(rawRule, "o", parts);
    }
    parts.push("}");
    return parts.join("");
  }

  /**
   * @static
   */
  // Ruleset.rawRulesAreEqual = function(first, second) {
  //   var firstStr = Ruleset.rawRuleToCanonicalString(first);
  //   var secondStr = Ruleset.rawRuleToCanonicalString(second);
  //   return firstStr === secondStr;
  // }

  constructor(name) {
    this._name = name || null; // string
    // Start off with an "empty" top-level domain entry. This will never have
    // its own rules. Non-host-specific rules go in |this.rules|.
    /**
     * Represents the root domain entry, that is, the domain ".".
     * Its "lower levels" are domain entries like "com", "info", "org".
     */
    this._domain = new DomainEntry(null, null, null);
    /**
     * @type {Object<string, IPAddressEntry>}
     */
    this._ipAddr = {};
    /**
     * Contains rules that don't specify a host.
     */
    this.rules = new Rules();
  }

  toString() {
    return "[Ruleset " + this._name + "]";
  }

  print(depth) {
    depth = depth || 0;
    let indent = "";
    for (let i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    this._domain.print(depth + 1);
    // this._ipAddr.print(depth + 1);
    this.rules.print(depth + 1);
  }

  _getIPAddress(address) {
    // TODO: Canonicalize IPv6 addresses.
    return this._ipAddr[address];
  }

  _addIPAddress(address) {
    // TODO: Canonicalize IPv6 addresses.
    if (!this._ipAddr[address]) {
      this._ipAddr[address] = new IPAddressEntry(address);
    }
    return this._ipAddr[address];
  }

  _getDomain(domain) {
    const parts = domain.split(".");
    let curLevel = this._domain;
    let nextLevel;
    let fullName = "";
    for (let i = parts.length - 1; i >= 0; i--) {
      // dprint(parts[i]);
      fullName = parts[i] + (fullName ? "." : "") + fullName;
      nextLevel = curLevel.getLowerLevel(parts[i]);
      if (!nextLevel) {
        return null;
      }
      curLevel = nextLevel;
    }
    return curLevel;
  }

  _addDomain(domain) {
    const parts = domain.split(".");
    let curLevel = this._domain;
    let nextLevel;
    let fullName = "";
    for (let i = parts.length - 1; i >= 0; i--) {
      // dprint(parts[i]);
      fullName = parts[i] + (fullName ? "." : "") + fullName;
      nextLevel = curLevel.getLowerLevel(parts[i]);
      if (!nextLevel) {
        nextLevel = new DomainEntry(parts[i], fullName, curLevel);
        // dprint(nextLevel);
        curLevel.addLowerLevel(parts[i], nextLevel);
      }
      curLevel = nextLevel;
    }
    return curLevel;
  }

  getHost(host) {
    if (!host) {
      // eslint-disable-next-line no-throw-literal
      throw "INVALID_HOST";
    }
    if (DomainUtil.isIPAddress(host)) {
      return this._getIPAddress(host);
    } else {
      return this._getDomain(host);
    }
  }

  addHost(host) {
    if (!host) {
      // eslint-disable-next-line no-throw-literal
      throw "INVALID_HOST";
    }
    if (DomainUtil.isIPAddress(host)) {
      return this._addIPAddress(host);
    } else {
      return this._addDomain(host);
    }
  }

  /**
   * Yields all matching hosts, that is, DomainEntry or IPAddressEntry
   * objects. For domains, this is in top-down order. For
   * example, first "com", then "foo", then "www".
   *
   * @param {string} host The host to get matching entries for.
   * @yield {Generator<DomainEntry|IPAddressEntry>}
   */
  * getHostMatches(host) {
    if (!this.rules.isEmpty()) {
      // If `this.rules` is not empty, it contains any rules which do
      // not specify a host (host = undefined).
      //
      // If it's the start of an origin-to-destination rule, the
      // origin is non-host-specific but the destination doesn't
      // have to be.

      yield [this, false];
    }

    if (!host) {
      return;
    }

    if (DomainUtil.isIPAddress(host)) {
      const addrEntry = this._ipAddr[host];
      if (addrEntry) {
        yield [addrEntry, true];
      }
    } else {
      const parts = host.split(".");
      let curLevel = this._domain;
      // Start by checking for a wildcard at the highest level.
      let nextLevel = curLevel.getLowerLevel("*");
      if (nextLevel) {
        yield [nextLevel, true];
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        nextLevel = curLevel.getLowerLevel(parts[i]);
        if (!nextLevel) {
          break;
        }
        curLevel = nextLevel;
        yield [nextLevel, true];

        // Check for *.domain rules at each level.
        nextLevel = curLevel.getLowerLevel("*");
        if (nextLevel) {
          yield [nextLevel, true];
        }
      }
    }
  }

  /**
   * @param {nsIURI} origin
   * @param {nsIURI} dest
   * @return {Array} Array of length 2, containing matched "allow"
   *     and "deny" rules, respectively.
   */
  check(origin, dest) {
    const matchedAllowRules = [];
    const matchedDenyRules = [];
    let originHost;
    let destHost;
    try {
      originHost = origin.host;
    } catch (e) {
      originHost = "";
    }
    try {
      destHost = dest.host;
    } catch (e) {
      destHost = "";
    }

    // dprint("Checking origin rules and origin-to-destination rules.");
    // First, check for rules for each part of the origin host.
    for (let [entry, originSpecHasHost] of this.getHostMatches(originHost)) {
      // dprint(entry);
      for (let rule of entry.rules) {
        // dprint("Checking rule: " + rule);
        let ruleMatchedOrigin = rule.isMatch(origin, originSpecHasHost);

        if (rule.allowOrigin && ruleMatchedOrigin) {
          // dprint("ALLOW origin by rule " + entry + " " + rule);
          matchedAllowRules.push(["origin", entry, rule]);
        }
        if (rule.denyOrigin && ruleMatchedOrigin) {
          // dprint("DENY origin by rule " + entry + " " + rule);
          matchedDenyRules.push(["origin", entry, rule]);
        }

        // Check if there are origin-to-destination rules from the origin host
        // entry we're currently looking at.
        if (ruleMatchedOrigin && rule.destinations) {
          // dprint("There are origin-to-destination " +
          //     "rules using this origin rule.");
          for (let [destEntry, destSpecHasHost]
               of rule.destinations.getHostMatches(destHost)) {
            // dprint(destEntry);
            for (let destRule of destEntry.rules) {
              // dprint("Checking rule: " + rule);
              if (destRule.allowDestination &&
                  destRule.isMatch(dest, destSpecHasHost)) {
                // dprint("ALLOW origin-to-dest by rule origin " +
                //     entry + " " + rule + " to dest " + destEntry +
                //     " " + destRule);
                matchedAllowRules.push([
                  "origin-to-dest",
                  entry,
                  rule,
                  destEntry,
                  destRule,
                ]);
              }
              if (destRule.denyDestination &&
                  destRule.isMatch(dest, destSpecHasHost)) {
                // dprint("DENY origin-to-dest by rule origin " +
                //     entry + " " + rule + " to dest " + destEntry +
                //     " " + destRule);
                matchedDenyRules.push([
                  "origin-to-dest",
                  entry,
                  rule,
                  destEntry,
                  destRule,
                ]);
              }
            }
          }
          // dprint("Done checking origin-to-destination " +
          //     "rules using this origin rule.");
        } // end: if (rule.destinations)
      }
    }

    // dprint("Checking dest rules.");
    // Last, check for rules for each part of the destination host.
    for (let [entry, destSpecHasHost] of this.getHostMatches(destHost)) {
      // dprint(entry);
      for (let rule of entry.rules) {
        // dprint("Checking rule: " + rule);
        if (rule.allowDestination && rule.isMatch(dest, destSpecHasHost)) {
          // dprint("ALLOW dest by rule " + entry + " " + rule);
          matchedAllowRules.push(["dest", entry, rule]);
        }
        if (rule.denyDestination && rule.isMatch(dest, destSpecHasHost)) {
          // dprint("DENY dest by rule " + entry + " " + rule);
          matchedDenyRules.push(["dest", entry, rule]);
        }
      }
    }

    return [matchedAllowRules, matchedDenyRules];
  }
}
