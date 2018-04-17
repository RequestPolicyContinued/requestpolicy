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

import { rp } from "app/app.background";
import {C} from "data/constants";
import {IUri} from "lib/classes/uri";
import {Log} from "models/log";

const log = Log.instance;

// =============================================================================
// utilities
// =============================================================================

function dprint(msg: string) {
  log.info("[POLICY] " + msg);
}

function dwarn(msg: string) {
  log.warn("[POLICY] " + msg);
}

// =============================================================================
// types
// =============================================================================

interface IObject<T> {
  [k: string]: T;
}

enum RuleAction {
  ALLOW = C.RULE_ACTION_ALLOW,
  DENY = C.RULE_ACTION_DENY,
}

type Port = (
  "*" | // any port
  string | number | // specific port
  -1 // default port (= default)
);

interface IEndpointSpec {
  s?: string; // scheme
  h?: string; // host
  port?: Port;
  pathPre?: string; // path prefix (must start with "/")
  pathRegex?: string; // path regex
      // (no enclosing characters: '^/abc' not '/^\/abc/')
  pri?: number; // priority
}

type EndpointSpecType = "o" | "d"; // origin, destination

export interface IRuleSpec {
  o?: IEndpointSpec;
  d?: IEndpointSpec;
}

interface IMetadata {
  version: 1;
  name?: string; // unique name for this policy, used in filename
  source?: "user" | "subscription";
}

export interface IRuleSpecs {
  allow: IRuleSpec[];
  deny: IRuleSpec[];
}

interface IMaybeRuleSpecs {
  allow?: IRuleSpecs["allow"];
  deny?: IRuleSpecs["deny"];
}

export interface IRawRuleset {
  metadata: IMetadata;
  entries: IRuleSpecs;
}

export interface IMaybeIncompleteRawRuleset {
  metadata: IMetadata;
  entries: IMaybeRuleSpecs;
}

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

export class RawRuleset implements IRawRuleset {
  public static create(aData?: any) {
    let metadata: IMetadata = {version: 1};
    let entries: IMaybeRuleSpecs = {};
    if (aData) {
      // TODO: sanity check imported data, decide whether to ignore unrecognized
      // keys.
      const checkResult = RawRuleset.checkDataObj(aData);
      if (!checkResult.valid) {
        throw new Error(`Invalid policy data: ${checkResult.error}`);
      }
      const data = aData as IMaybeIncompleteRawRuleset;
      metadata = data.metadata;
      entries = data.entries;
    }
    if (!entries.allow) {
      entries.allow = [];
    }
    if (!entries.deny) {
      entries.deny = [];
    }
    return new RawRuleset(metadata, entries as IRuleSpecs);
  }

  private static checkDataObj(
      dataObj: any,
  ): {valid: true} | {valid: false, error: string} {
    if (typeof dataObj !== "object") {
      return {valid: false, error: "not an object"};
    }
    if (!("metadata" in dataObj)) {
      return {valid: false, error: "no 'metadata' key"};
    }
    if (!("version" in dataObj.metadata)) {
      return {valid: false, error: "no 'version' key"};
    }
    if (dataObj.metadata.version !== 1) {
      return {
        error: `Wrong metadata version. ` +
            `Expected 1, was ${dataObj.metadata.version}`,
        valid: false,
      };
    }
    if (!("entries" in dataObj)) {
      return {valid: false, error: "no 'entries' key"};
    }
    return {valid: true};
  }

  public readonly metadata: IMetadata;
  public readonly entries: IRuleSpecs;

  constructor(aMetadata: IMetadata, aEntries: IRuleSpecs) {
    this.metadata = aMetadata;
    this.entries = aEntries;
  }

  public toString() {
    return "[RawRuleset " + this.metadata + " " + this.entries + "]";
  }

  public getAllowRuleCount() {
    return this.entries.allow.length;
  }

  public getDenyRuleCount() {
    return this.entries.deny.length;
  }

  public ruleExists(ruleAction: RuleAction, ruleData: IRuleSpec) {
    const actionStr = ruleAction === RuleAction.ALLOW ? "allow" :
        ruleAction === RuleAction.DENY ? "deny" : "";
    if (!actionStr) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("Invalid ruleAction: " + ruleAction);
    }

    const ruleStr = Ruleset.rawRuleToCanonicalString(ruleData);
    const entries = this.entries[actionStr];
    // tslint:disable-next-line prefer-const forin
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
  public addRule(ruleAction: RuleAction, ruleData: IRuleSpec, policy: Ruleset) {
    // XXX: remove loggings
    // dprint("addRule: adding entry");
    const actionStr = ruleAction === RuleAction.ALLOW ? "allow" :
        ruleAction === RuleAction.DENY ? "deny" : "";
    if (!actionStr) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("Invalid ruleAction: " + ruleAction);
    }

    // Only add the raw policy entry if it doesn't already exist.
    if (!this.ruleExists(ruleAction, ruleData)) {
      this.entries[actionStr].push(ruleData);
    }

    if (policy) {
      this._addEntryToRuleset(ruleData, ruleAction, policy);
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
  public removeRule(
      ruleAction: RuleAction,
      ruleData: IRuleSpec,
      policy: Ruleset,
  ) {
    // XXX: remove loggings
    // dprint("removeRule: removing entry");
    const actionStr = ruleAction === RuleAction.ALLOW ? "allow" :
        ruleAction === RuleAction.DENY ? "deny" : "";
    if (!actionStr) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("Invalid ruleAction: " + ruleAction);
    }
    const ruleStr = Ruleset.rawRuleToCanonicalString(ruleData);
    const entries = this.entries[actionStr];
    let removeIndex: number | null = null;
    // tslint:disable-next-line prefer-const forin
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
    if (removeIndex !== null) {
      const begin = entries.slice(0, removeIndex);
      const end = entries.slice(Number(removeIndex) + 1);
      if (begin.length + end.length + 1 !== entries.length) {
        // eslint-disable-next-line no-throw-literal
        throw new Error(
            "Bad slicing (Probably bad math or not reading the docs).");
      }
      this.entries[actionStr] = begin.concat(end);
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
  public toRuleset(name: string) {
    const policy = new Ruleset(name);

    // tslint:disable-next-line prefer-const forin
    for (let actionStr in this.entries) {
      // dprint("actionStr: " + actionStr);
      if (actionStr !== "allow" && actionStr !== "deny") {
        dwarn("Invalid entry type: " + actionStr);
        continue;
      }
      const ruleAction = actionStr === "allow" ? RuleAction.ALLOW :
          RuleAction.DENY;
      const entryArray = this.entries[actionStr];
      // tslint:disable-next-line prefer-const forin
      for (let i in entryArray) {
        // dprint("toRuleset: adding entry");
        this._addEntryToRuleset(entryArray[i], ruleAction, policy);
      }
    }

    return policy;
  }

  private _addEntryHelper(entryPart: IEndpointSpec, policy: Ruleset) {
    let rules: Rules;
    if (entryPart.h) {
      rules = policy.addHost(entryPart.h).rules;
    } else {
      rules = policy.rules;
    }
    const r = rules.add(
        "s" in entryPart ? entryPart.s : undefined,
        "port" in entryPart ? entryPart.port : undefined);
    if (entryPart.pathPre) {
      r.pathPre = entryPart.pathPre;
    } else if (entryPart.pathRegex) {
      r.pathRegex = new RegExp(entryPart.pathRegex);
    }
    return {rules, r};
  }

  private _addEntryToRuleset(
      entry: IRuleSpec,
      ruleAction: RuleAction,
      policy: Ruleset,
  ) {
    // TODO: add an "entryPart" format verifier/normalizer.
    //    notes: 'pathPre' => path prefix (must start with "/")
    const o = entry.o;
    const d = entry.d;
    // eslint-disable-next-line no-unused-vars
    let rules: Rules;
    let r: Rule;

    // dprint("_addEntryToRuleset: " + o + " " + d + " " + ruleAction);

    if (o && d) {
      ({rules, r} = this._addEntryHelper(o, policy));
      r.initDestinations();
      ({rules, r} = this._addEntryHelper(d, r.destinations));
      // r.destinationRuleAction = ruleAction;
      if (ruleAction === RuleAction.ALLOW) {
        r.allowDestination = true;
      } else {
        r.denyDestination = true;
      }
    } else if (o && !d) {
      ({rules, r} = this._addEntryHelper(o, policy));
      // r.originRuleAction = ruleAction;
      if (ruleAction === RuleAction.ALLOW) {
        r.allowOrigin = true;
      } else {
        r.denyOrigin = true;
      }
    } else if (!o && d) {
      ({rules, r} = this._addEntryHelper(d, policy));
      // r.destinationRuleAction = ruleAction;
      if (ruleAction === RuleAction.ALLOW) {
        r.allowDestination = true;
      } else {
        r.denyDestination = true;
      }
    } else {
      // TODO: Issue warning about bad entry and return or throw error.
      return;
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
  // }

  private _removeEntryFromRuleset(
      entry: IRuleSpec,
      ruleAction: RuleAction,
      policy: Ruleset,
  ) {
    // TODO: add an "entryPart" format verifier/normalizer.
    //    notes: 'pathPre' => path prefix (must start with "/")
    const o = entry.o;
    const d = entry.d;
    let rules;
    let r;

    // TODO: refactor like done with _addEntryToRuleset

    if (o && d) {
      if (o.h) {
        const originEntry = policy.getHost(o.h);
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
        const destEntry = r.destinations.getHost(d.h);
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
      if (ruleAction === RuleAction.ALLOW) {
        r.allowDestination = null;
      } else if (ruleAction === RuleAction.DENY) {
        r.denyDestination = null;
      } else {
        // eslint-disable-next-line no-throw-literal
        throw new Error("Invalid rule type: " + ruleAction);
      }
    } else if (o && !d) {
      if (o.h) {
        const originEntry = policy.getHost(o.h);
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
      if (ruleAction === RuleAction.ALLOW) {
        r.allowOrigin = null;
      } else if (ruleAction === RuleAction.DENY) {
        r.denyOrigin = null;
      } else {
        // eslint-disable-next-line no-throw-literal
        throw new Error("Invalid rule type: " + ruleAction);
      }
    } else if (!o && d) {
      if (d.h) {
        const destEntry = policy.getHost(d.h);
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
      if (ruleAction === RuleAction.ALLOW) {
        r.allowDestination = null;
      } else if (ruleAction === RuleAction.DENY) {
        r.denyDestination = null;
      } else {
        // eslint-disable-next-line no-throw-literal
        throw new Error("Invalid rule type: " + ruleAction);
      }
    } else {
      // TODO: Issue warning about bad entry and return or throw error.
      return;
    }
  }

  /**
   * Returns a simple object representing this |RawRuleset|.
   *
   * @return {Object}
   */
  public get raw(): IRawRuleset {
    // Note: unrecognized keys in the metadata and entries are preserved.
    return {metadata: this.metadata, entries: this.entries};
  }
}

// =============================================================================
// Rules
// =============================================================================

// tslint:disable-next-line max-classes-per-file
class Rules {
  private rules: Rule[] = [];

  public print(depth = 0) {
    // tslint:disable-next-line prefer-const
    for (let rule of this.rules) {
      rule.print(depth);
    }
  }

  public getRules() {
    return this.rules;
  }

  public isEmpty() {
    return this.rules.length === 0;
  }

  public * [Symbol.iterator]() {
    yield* this.rules;
  }

  public get(scheme?: string, port?: Port): Rule | null {
    const rule = new Rule(scheme, port);
    // tslint:disable-next-line prefer-const
    for (let existingRule of this.rules) {
      if (existingRule.isEqual(rule)) {
        return existingRule;
      }
    }
    return null;
  }

  public add(scheme?: string, port?: Port): Rule {
    const newRule = new Rule(scheme, port);
    // tslint:disable-next-line prefer-const
    for (let existingRule of this.rules) {
      if (existingRule.isEqual(newRule)) {
        return existingRule;
      }
    }
    this.rules.push(newRule);
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
// tslint:disable-next-line max-classes-per-file
class Rule {
  public scheme: string | null = null;
  public port: Port | null = null;

  public path: string | RegExp | null = null;
  public pathPre: string | null = null;
  public pathRegex: RegExp | null = null;

  // public originRuleAction?: RuleAction;
  // public destinationRuleAction?: RuleAction;

  public allowOrigin: boolean | null = null;
  public denyOrigin: boolean | null = null;
  public allowDestination: boolean | null = null;
  public denyDestination: boolean | null = null;

  // For origin-to-destination rules, these are the destinations.
  public destinations: Ruleset;

  constructor(scheme?: string | null, port?: Port) {
    if (scheme) this.scheme = scheme;
    if (port) this.port = port;
  }

  public toString() {
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

  public print(depth: number) {
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

  public isEqual(otherRule: Rule) {
    return this.scheme === otherRule.scheme &&
        this.port === otherRule.port &&
        this.path === otherRule.path;
  }

  public initDestinations() {
    if (this.destinations) {
      return;
    }
    this.destinations = new Ruleset();
  }

  public isMatch(
      uriObj: IUri,
      endpointSpecHasHost: boolean,
  ): boolean {
    if (this.scheme && this.scheme !== "*" && this.scheme !== uriObj.scheme) {
      // dprint("isMatch: wrong scheme (uri: '" + uriObj.scheme + "', rule: '" +
      //        this.scheme + "')");
      return false;
    }

    const uriService = rp.services.uri;

    // Check the port only in case the URI has a host at all.
    if (uriService.uriObjHasPort(uriObj)) {
      if (this.port) {
        // If the rule's port is "*" it means any port. We use this convention
        // because we assume an empty port in a rule means default ports rather
        // than any port.
        if (this.port !== "*") {
          const rulePort = typeof this.port === "number" ? this.port :
              parseInt(this.port, 10);
          if (
              rulePort === uriObj.port ||
              uriObj.port === -1 &&
                  rulePort === uriService.
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
          if (!uriService.hasStandardPort(uriObj)) {
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

// tslint:disable-next-line max-classes-per-file
class DomainEntry {
  public fullName: string | null = null;
  public rules: Rules = new Rules();

  private name: string;
  /**
   * A dictionary whose keys are strings of domain part names and values are
   * further DomainEntry objects.
   */
  private lower: IObject<DomainEntry> = {};

  constructor(
      name: string | null,
      fullName?: string | null,
      higher?: DomainEntry | null,
  ) {
    if (typeof name !== "string" && name !== null) {
      // eslint-disable-next-line no-throw-literal
      throw new Error(
          "Invalid type: DomainEntry name must be a string or null.");
    }
    if (name) this.name = name;
    if (fullName) this.fullName = fullName;
  }

  public toString() {
    return "[DomainEntry '" + this.name + " (" + this.fullName + ")']";
  }

  public print(depth: number) {
    depth = depth || 0;
    let indent = "";
    for (let i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    if (this.rules) {
      this.rules.print(depth + 1);
    }
    // tslint:disable-next-line prefer-const forin
    for (let entryName in this.lower) {
      this.lower[entryName].print(depth + 1);
    }
  }

  public addLowerLevel(name: string, entry: DomainEntry) {
    if (this.lower.hasOwnProperty(name)) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("ENTRY_ALREADY_EXISTS");
    }
    this.lower[name] = entry;
  }

  public getLowerLevel(name: string) {
    if (this.lower.hasOwnProperty(name)) {
      return this.lower[name];
    }
    return null;
  }
}

// =============================================================================
// IPAddressEntry
// =============================================================================

// tslint:disable-next-line max-classes-per-file
class IPAddressEntry {
  public address: string;
  public rules: Rules = new Rules();

  constructor(address: string) {
    this.address = address;
  }

  public toString() {
    return "[IPAddressEntry '" + this.address + "']";
  }

  public print(depth: number) {
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
}

// =============================================================================
// Ruleset
// =============================================================================

type Entry = DomainEntry | IPAddressEntry;

type EndpointData = [Entry | Ruleset, Rule];
type EndpointMatch = [
  "origin" | "dest",
  EndpointData[0],
  EndpointData[1]
];
type ODMatch = [
  "origin-to-dest",
  EndpointData[0], EndpointData[1],
  EndpointData[0], EndpointData[1]
];
type Match = EndpointMatch | ODMatch;

// tslint:disable-next-line max-classes-per-file
export class Ruleset {
  /**
   * @static
   * @param {?} match
   * @return {RawRule}
   */
  public static matchToRawRule(match: Match): IRuleSpec {
    // The matches are in the format
    //     [actionStr, entry, rule]
    // or
    //     [actionStr, originEntry, originRule, destEntry, destRule]
    // as returned by calls to |Ruleset.check()|.
    const rawRule = {};
    const actionStr = match[0];

    if (actionStr === "origin") {
      const [, entry, rule] = match as EndpointMatch;
      Ruleset._matchToRawRuleHelper(rawRule, "o", entry, rule);
    } else if (actionStr === "dest") {
      const [, entry, rule] = match as EndpointMatch;
      Ruleset._matchToRawRuleHelper(rawRule, "d", entry, rule);
    } else if (actionStr === "origin-to-dest") {
      const [, oEntry, oRule, dEntry, dRule] = match as ODMatch;
      Ruleset._matchToRawRuleHelper(rawRule, "o", oEntry, oRule);
      Ruleset._matchToRawRuleHelper(rawRule, "d", dEntry, dRule);
    } else {
      // eslint-disable-next-line no-throw-literal
      throw new Error(
          "[matchToRawRule] Invalid match type: " + actionStr +
          " from match: " + match);
    }

    return rawRule;
  }

  public static rawRuleToCanonicalString(rawRule: IRuleSpec) {
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

  private static _matchToRawRuleHelper(
      rawRule: IRuleSpec,
      originOrDest: EndpointSpecType,
      entry: Entry | Ruleset,
      rule: Rule,
  ) {
    const endpointSpec: IEndpointSpec = {};
    rawRule[originOrDest] = endpointSpec;
    if (entry instanceof DomainEntry && entry.fullName) {
      endpointSpec.h = entry.fullName;
    } else if (entry instanceof IPAddressEntry) {
      endpointSpec.h = entry.address;
    }
    if (rule.scheme) {
      endpointSpec.s = rule.scheme;
    }
    if (rule.port) {
      endpointSpec.port = rule.port;
    }
    // TODO: path
  }

  private static _rawRuleToCanonicalStringHelper(
      rawRule: IRuleSpec,
      originOrDest: EndpointSpecType,
      parts: string[],
  ): string {
    if (rawRule[originOrDest]) {
      const endpointSpec = rawRule[originOrDest] as IEndpointSpec;
      parts.push("\"" + originOrDest + "\":{");
      let needComma = false;
      if (endpointSpec.h) {
        parts.push("\"h\":\"" + endpointSpec.h + "\"");
        needComma = true;
      }
      if (endpointSpec.port) {
        if (needComma) {
          parts.push(",");
        }
        parts.push("\"port\":\"" + endpointSpec.port + "\"");
      }
      if (endpointSpec.s) {
        if (needComma) {
          parts.push(",");
        }
        parts.push("\"s\":\"" + endpointSpec.s + "\"");
      }
      parts.push("}");
    }
    // TODO: pathPre and pathRegex (will need to escape strings)
    parts.push("}");
    return parts.join("");
  }

  // public static rawRulesAreEqual(first, second) {
  //   var firstStr = Ruleset.rawRuleToCanonicalString(first);
  //   var secondStr = Ruleset.rawRuleToCanonicalString(second);
  //   return firstStr === secondStr;
  // }

  /**
   * Contains rules that don't specify a host.
   */
  public rules: Rules;

  private name: string | null = null;

  /**
   * Represents the root domain entry, that is, the domain ".".
   * Its "lower levels" are domain entries like "com", "info", "org".
   */
  private domain: DomainEntry;

  private ipAddr: {[k: string]: IPAddressEntry};

  constructor(name?: string) {
    if (name) this.name = name;
    // Start off with an "empty" top-level domain entry. This will never have
    // its own rules. Non-host-specific rules go in |this.rules|.
    this.domain = new DomainEntry(null, null, null);
    this.ipAddr = {};
    this.rules = new Rules();
  }

  public toString() {
    return "[Ruleset " + this.name + "]";
  }

  public print(depth: number = 0) {
    let indent = "";
    for (let i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    this.domain.print(depth + 1);
    // this._ipAddr.print(depth + 1);
    this.rules.print(depth + 1);
  }

  public getHost(host: string) {
    if (!host) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("INVALID_HOST");
    }
    if (rp.services.uri.isIPAddress(host)) {
      return this._getIPAddress(host);
    } else {
      return this._getDomain(host);
    }
  }

  public addHost(host: string): IPAddressEntry | DomainEntry {
    if (!host) {
      // eslint-disable-next-line no-throw-literal
      throw new Error("INVALID_HOST");
    }
    if (rp.services.uri.isIPAddress(host)) {
      return this._addIPAddress(host);
    } else {
      return this._addDomain(host);
    }
  }

  /**
   * Yields all matching hosts, that is, DomainEntry or IPAddressEntry
   * objects. For domains, this is in top-down order. For
   * example, first "com", then "foo", then "www".
   */
  public * getHostMatches(
      host: string,
  ): IterableIterator<[Entry | Ruleset, boolean]> {
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

    if (rp.services.uri.isIPAddress(host)) {
      const addrEntry = this.ipAddr[host];
      if (addrEntry) {
        yield [addrEntry, true];
      }
    } else {
      const parts = host.split(".");
      let curLevel = this.domain;
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

  public check(origin: IUri, dest: IUri): [Match[], Match[]] {
    const matchedAllowRules: Match[] = [];
    const matchedDenyRules: Match[] = [];
    const uriService = rp.services.uri;
    const originHost = uriService.getHostByUriObj(origin) || "";
    const destHost = uriService.getHostByUriObj(dest) || "";

    // dprint("Checking origin rules and origin-to-destination rules.");
    // First, check for rules for each part of the origin host.
    // tslint:disable-next-line prefer-const
    for (let [entry, originSpecHasHost] of this.getHostMatches(originHost)) {
      // dprint(entry);
      // tslint:disable-next-line prefer-const
      for (let rule of entry.rules) {
        // dprint("Checking rule: " + rule);
      // tslint:disable-next-line prefer-const
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
          // tslint:disable-next-line prefer-const
          for (let [destEntry, destSpecHasHost]
               of rule.destinations.getHostMatches(destHost)) {
            // dprint(destEntry);
            // tslint:disable-next-line prefer-const
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
    // tslint:disable-next-line prefer-const
    for (let [entry, destSpecHasHost] of this.getHostMatches(destHost)) {
      // dprint(entry);
      // tslint:disable-next-line prefer-const
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

  private _getIPAddress(address: string): IPAddressEntry {
    // TODO: Canonicalize IPv6 addresses.
    return this.ipAddr[address];
  }

  private _addIPAddress(address: string): IPAddressEntry {
    // TODO: Canonicalize IPv6 addresses.
    if (!this.ipAddr[address]) {
      this.ipAddr[address] = new IPAddressEntry(address);
    }
    return this.ipAddr[address];
  }

  private _getDomain(domain: string) {
    const parts = domain.split(".");
    let curLevel = this.domain;
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

  private _addDomain(domain: string): DomainEntry {
    const parts = domain.split(".");
    let curLevel = this.domain;
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
}
