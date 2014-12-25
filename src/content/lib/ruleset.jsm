/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
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

var EXPORTED_SYMBOLS = [
  "Ruleset",
  "RawRuleset",
  "RULE_ACTION_ALLOW",
  "RULE_ACTION_DENY"
];

if (!rp) {
  var rp = {mod : {}};
}

Components.utils.import("chrome://requestpolicy/content/lib/domain-util.jsm", rp.mod);
Components.utils.import("chrome://requestpolicy/content/lib/logger.jsm", rp.mod);

const RULE_ACTION_ALLOW = 1;
const RULE_ACTION_DENY = 2;


function dprint(msg) {
  if (typeof print == "function") {
    print(msg);
  } else {
    rp.mod.Logger.info(rp.mod.Logger.TYPE_POLICY, msg);
  }
}

function dwarn(msg) {
  rp.mod.Logger.warning(rp.mod.Logger.TYPE_POLICY, msg);
}

/*
// We expect JSON data to represent the following data structure.
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

function dump(arr,level) {
  var dumped_text = "";
  if(!level) level = 0;

  //The padding given at the beginning of the line.
  var level_padding = "";
  for(var j=0;j<level+1;j++) level_padding += "    ";

  if(typeof(arr) == 'object') { //Array/Hashes/Objects
    for(var item in arr) {
      var value = arr[item];

      if(typeof(value) == 'object') { //If it is an array,
        dumped_text += level_padding + "'" + item + "' ...\n";
        dumped_text += dump(value,level+1);
      } else {
        dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
      }
    }
  } else { //Stings/Chars/Numbers etc.
    dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
  }
  return dumped_text;
}

function RawRuleset(jsonData) {
  this._metadata = {"version" : 1};
  this._entries = {};
  if (jsonData) {
    this._fromJSON(jsonData);
  }
  if (!this._entries["allow"]) {
    this._entries["allow"] = [];
  }
  if (!this._entries["deny"]) {
    this._entries["deny"] = [];
  }
}

RawRuleset.prototype = {
  _metadata : null,
  _entries : null,

  toString : function() {
    return "[RawRuleset " + this._metadata + " " + this._entries + "]";
  },

  getAllowRuleCount : function() {
    return this._entries["allow"].length;
  },

  getDenyRuleCount : function() {
    return this._entries["deny"].length;
  },

  _addEntryHelper : function(entryPart, policy) {
    if (entryPart["h"]) {
      var rules = policy.addHost(entryPart["h"]).rules;
    } else {
      rules = policy.rules;
    }
    var r = rules.add(entryPart["s"], entryPart["port"]);
    if (entryPart["pathPre"]) {
      r.pathPre = entryPart["pathPre"];
    } else if (entryPart["pathRegex"]) {
      r.pathRegex = new RegExP(entryPart["pathRegex"]);
    }
    return [rules, r];
  },

  _addEntryToRuleset : function(entry, ruleAction, policy) {
    // TODO: add an "entryPart" format verifier/normalizer.
    //    notes: 'pathPre' => path prefix (must start with "/")
    var o = entry["o"];
    var d = entry["d"];
    var rules, r;

    //dprint("_addEntryToRuleset: " + o + " " + d + " " + ruleAction);

    if (o && d) {
      [rules, r] = this._addEntryHelper(o, policy);
      r.initDestinations();
      [rules, r] = this._addEntryHelper(d, r.destinations);
      //r.destinationRuleAction = ruleAction;
      if (ruleAction == RULE_ACTION_ALLOW) {
        r.allowDestination = true;
      } else {
        r.denyDestination = true;
      }

    } else if (o && !d) {
      [rules, r] = this._addEntryHelper(o, policy);
      //r.originRuleAction = ruleAction;
      if (ruleAction == RULE_ACTION_ALLOW) {
        r.allowOrigin = true;
      } else {
        r.denyOrigin = true;
      }

    } else if (!o && d) {
      [rules, r] = this._addEntryHelper(d, policy);
      //r.destinationRuleAction = ruleAction;
      if (ruleAction == RULE_ACTION_ALLOW) {
        r.allowDestination = true;
      } else {
        r.denyDestination = true;
      }

    } else {
      // TODO: Issue warning about bad entry and return or throw error.
      return;
    }
  },

  ruleExists : function(ruleAction, ruleData) {
    var actionStr = ruleAction == RULE_ACTION_ALLOW ? "allow" :
        ruleAction == RULE_ACTION_DENY ? "deny" : "";
    if (!actionStr) {
      throw "Invalid ruleAction: " + ruleAction;
    }

    var ruleStr = Ruleset.rawRuleToCanonicalString(ruleData);
    var entries = this._entries[actionStr];
    for (var i in entries) {
      var curRuleStr = Ruleset.rawRuleToCanonicalString(entries[i]);
      if (ruleStr == curRuleStr) {
        return true;
      }
    }
    return false;
  },

  /**
   * Adds the rule to the entries of this |RawRuleset| instance as well as the
   * |Ruleset| optionally provided as the policy argument.
   *
   * @param ruleAction RULE_ACTION_ALLOW|RULE_ACTION_DENY
   * @param ruleData
   */
  addRule : function(ruleAction, ruleData, policy) {
    // XXX: remove loggings
    //dprint("addRule: adding entry");
    var actionStr = ruleAction == RULE_ACTION_ALLOW ? "allow" :
        ruleAction == RULE_ACTION_DENY ? "deny" : "";
    if (!actionStr) {
      throw "Invalid ruleAction: " + ruleAction;
    }

    // Only add the raw policy entry if it doesn't already exist.
    if (!this.ruleExists(ruleAction, ruleData)) {
      this._entries[actionStr].push(ruleData);
    }

    if (policy) {
      this._addEntryToRuleset(ruleData, ruleAction, policy);
    }
  },

  // _removeEntryHelper : function(entryPart, policy) {
  //     if (entryPart["h"]) {
  //       var originEntry = policy.getHost(entryPart["h"]);
  //       if (!originEntry) {
  //         return null;
  //       }
  //       var rules = originEntry.rules;
  //     } else {
  //       rules = policy.rules;
  //     }
  //     return rules.get(entryPart["s"], entryPart["port"]);
  // },

  _removeEntryFromRuleset : function(entry, ruleAction, policy) {
    // TODO: add an "entryPart" format verifier/normalizer.
    //    notes: 'pathPre' => path prefix (must start with "/")
    var o = entry["o"];
    var d = entry["d"];
    var rules, r;

    // TODO: refactor like done with _addEntryToRuleset

    if (o && d) {
      if (o["h"]) {
        var originEntry = policy.getHost(o["h"]);
        if (!originEntry) {
          return;
        }
        var rules = originEntry.rules;
      } else {
        rules = policy.rules;
      }
      var r = rules.get(o["s"], o["port"]);
      if (!r || !r.destinations) {
        return;
      }

      if (d["h"]) {
        var destEntry = r.destinations.getHost(d["h"]);
        if (!destEntry) {
          return;
        }
        var rules = destEntry.rules;
      } else {
        rules = r.destinations.rules;
      }
      r = rules.get(d["s"], d["port"]);
      if (!r) {
        return;
      }

      // if (r.destinationRuleAction == ruleAction) {
      //   r.destinationRuleAction = null;
      // }
      //dprint("_removeEntryFromRuleset: got rule to alter: " + r.toString());
      if (ruleAction == RULE_ACTION_ALLOW) {
        r.allowDestination = null;
      } else if (ruleAction == RULE_ACTION_DENY) {
        r.denyDestination = null;
      } else {
        throw "Invalid rule type: " + ruleAction;
      }

    } else if (o && !d) {
      if (o["h"]) {
        var originEntry = policy.getHost(o["h"]);
        if (!originEntry) {
          return;
        }
        var rules = originEntry.rules;
      } else {
        rules = policy.rules;
      }
      var r = rules.get(o["s"], o["port"]);
      if (!r) {
        return;
      }

      // if (r.originRuleAction == ruleAction) {
      //   r.originRuleAction = null;
      // }
      if (ruleAction == RULE_ACTION_ALLOW) {
        r.allowOrigin = null;
      } else if (ruleAction == RULE_ACTION_DENY) {
        r.denyOrigin = null;
      } else {
        throw "Invalid rule type: " + ruleAction;
      }

    } else if (!o && d) {
      if (d["h"]) {
        var originEntry = policy.getHost(d["h"]);
        if (!originEntry) {
          return;
        }
        var rules = originEntry.rules;
      } else {
        rules = policy.rules;
      }
      var r = rules.get(d["s"], d["port"]);
      if (!r) {
        return;
      }

      // if (r.destinationRuleAction == ruleAction) {
      //   r.destinationRuleAction = null;
      // }
      if (ruleAction == RULE_ACTION_ALLOW) {
        r.allowDestination = null;
      } else if (ruleAction == RULE_ACTION_DENY) {
        r.denyDestination = null;
      } else {
        throw "Invalid rule type: " + ruleAction;
      }

    } else {
      // TODO: Issue warning about bad entry and return or throw error.
      return;
    }
  },

  /**
   * Removes the rule from the entries of this |RawRuleset| instance as well as the
   * |Ruleset| optionally provided as the policy argument.
   *
   * @param ruleAction RULE_ACTION_ALLOW|RULE_ACTION_DENY
   * @param ruleData
   */
  removeRule : function(ruleAction, ruleData, policy) {
    // XXX: remove loggings
    //dprint("removeRule: removing entry");
    var actionStr = ruleAction == RULE_ACTION_ALLOW ? "allow" :
        ruleAction == RULE_ACTION_DENY ? "deny" : "";
    if (!actionStr) {
      throw "Invalid ruleAction: " + ruleAction;
    }
    var ruleStr = Ruleset.rawRuleToCanonicalString(ruleData);
    var entries = this._entries[actionStr];
    var removeIndex = false;
    for (var i in entries) {
      var curRuleStr = Ruleset.rawRuleToCanonicalString(entries[i]);
      if (ruleStr == curRuleStr) {
        // |i| is a string which will cause bugs when we use it in arithmetic
        // expressions below. Why does this form of iterator give us string
        // indexes? I have no idea but it's something to watch out for.
        removeIndex = Number(i);
        break;
      }
    }
    if (removeIndex !== false) {
      var begin = entries.slice(0, removeIndex);
      var end = entries.slice(Number(removeIndex) + 1);
      if (begin.length + end.length + 1 != entries.length) {
        throw "Bad slicing (Probably bad math or not reading the docs).";
      }
      this._entries[actionStr] = begin.concat(end);
    }

    if (policy) {
      this._removeEntryFromRuleset(ruleData, ruleAction, policy);
    }
  },

  /**
   * Returns a |Ruleset| object initialized to reflect the contents of this
   * |RawRuleset|.
   */
  toRuleset : function(name) {
    var policy = new Ruleset(name);

    for (var actionStr in this._entries) {
      //dprint("actionStr: " + actionStr);
      if (actionStr != "allow" && actionStr != "deny") {
        dwarn("Invalid entry type: " + actionStr);
        continue;
      }
      var ruleAction = actionStr == "allow" ? RULE_ACTION_ALLOW : RULE_ACTION_DENY;
      var entryArray = this._entries[actionStr];
      for (var i in entryArray) {
        //dprint("toRuleset: adding entry");
        this._addEntryToRuleset(entryArray[i], ruleAction, policy);
      }
    }

    return policy;
  },

  _checkDataObj : function(dataObj) {
    if (!("metadata" in dataObj)) {
      throw "Invalid policy data: no 'metadata' key";
    }
    if (!("version" in dataObj.metadata)) {
      throw "Invalid policy data: no 'version' key";
    }
    if (dataObj.metadata.version != 1) {
      throw "Wrong metadata version. Expected 1, was "
          + dataObj.metadata.version;
    }
    if (!("entries" in dataObj)) {
      throw "Invalid policy data: no 'entries' key";
    }
  },

  /**
   * Initializes this |RawRuleset| from JSON data.
   */
  _fromJSON : function(data) {
    // TODO: sanity check imported data, decide whether to ignore unrecognized
    // keys.
    // TODO: wrap in try/catch block
    var dataObj = JSON.parse(data);

    //dprint(typeof dataObj);
    //dprint(dump(dataObj));
    this._checkDataObj(dataObj);
    this._metadata = dataObj.metadata;
    this._entries = dataObj.entries;
  },

  /**
   * Returns a simple object representing this |RawRuleset|. This function
   * is automatically invoked when |JSON.stringify(rawRulesetObj)| is called and
   * the result is passed through stringify before being returned.
   */
  toJSON : function() {
    // Note: unrecognized keys in the metadata and entries are preserved.
    var tempObj = {"metadata" : this._metadata, "entries" : this._entries};
    return tempObj;
  }
};




function RuleIterator(rules) {
  this._rulesIterator = new Iterator(rules);
}
RuleIterator.prototype.next = function() {
  // The default Iterator over arrays returns a tuple of [index, item].
  return this._rulesIterator.next()[1];
}


function Rules() {
  this._rules = [];
}

Rules.prototype = {
  _rules : null,

  print : function(depth) {
    depth = depth ? depth : 0;
    for (var i = 0, item; item = this._rules[i]; i++) {
      item.print(depth);
    }
  },

  getRules : function() {
    return this._rules;
  },

  isEmpty : function() {
    return this._rules.length == 0;
  },

  __iterator__ : function() {
    return new RuleIterator(this._rules);
  },

  get : function(scheme, port) {
    var rule = new Rule(scheme, port);
    for (var i = 0, item; item = this._rules[i]; i++) {
      if (item.isEqual(rule)) {
        return item;
      }
    }
    return null;
  },

  add : function(scheme, port) {
    var rule = new Rule(scheme, port);
    for (var i = 0, item; item = this._rules[i]; i++) {
      if (item.isEqual(rule)) {
        return item;
      }
    }
    this._rules.push(rule);
    return rule;
  }
};


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
function Rule(scheme, port) {
  this.scheme = scheme ? scheme : null;
  this.port = port ? port : null;
}

Rule.prototype = {

  scheme : null,
  port : null,
  path : null,

  // Either null, RULE_ACTION_ALLOW, or RULE_ACTION_DENY.
  // originRuleAction : null,
  // destinationRuleAction : null,

  allowOrigin : null,
  denyOrigin : null,
  allowDestination : null,
  denyDestination : null,

  // For origin-to-destination rules, these are the destinations.
  destinations : null,

  toString : function() {
    return "[Rule " + this.scheme + " " + this.port + " " + this.path + " "
    // TODO
           // + "originRuleAction:" + this.originRuleAction + " "
           // + "destinationRuleAction:" + this.destinationRuleAction + " "
           + "allowOrigin:" + this.allowOrigin + " "
           + "denyOrigin:" + this.denyOrigin + " "
           + "allowDestination:" + this.allowDestination + " "
           + "denyDestination:" + this.denyDestination + " "
           + "]";
  },

  print : function(depth) {
    depth = depth ? depth : 0;
    var indent = "";
    for (var i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    if (this.destinations) {
      dprint(indent + "  " + "destinations:");
      this.destinations.print(depth + 1);
    }
  },

  isEqual : function(otherRule) {
    return this.scheme == otherRule.scheme &&
           this.port == otherRule.port &&
           this.path == otherRule.path;
  },

  initDestinations : function() {
    if (this.destinations) {
      return;
    }
    this.destinations = new Ruleset();
  },

  isMatch : function(uriObj) {
    if (this.scheme && this.scheme != uriObj.scheme) {
      dprint("isMatch: wrong scheme");
      return false;
    }
    if (this.port) {
      // If the rule's port is "*" it means any port. We use this convention
      // because we assume an empty port in a rule means default ports rather
      // than any port.
      if (this.port != uriObj.port && this.port != "*") {
        dprint("isMatch: wrong port (not the port specified by the rule)");
        return false;
      }
    } else {
      if (!rp.mod.DomainUtil.hasStandardPort(uriObj)) {
        dprint("isMatch: wrong port (not the default port and the rule assumes default)");
        return false;
      }
    }
    if (this.path) {
      if (typeof this.path == "string") {
        if (uriObj.path.indexOf(this.path) != 0) {
          dprint("isMatch: wrong path (string): " + this.path + " vs " + uriObj.path);
          return false;
        }
      } else if (!this.path.test(uriObj.path)) {
        dprint("isMatch: wrong path (regex)");
        return false;
      }
    }
    //dprint("isMatch: MATCH");
    return true;
  }
};


function DomainEntry(name, fullName, higher) {
  if (typeof name != "string" && name !== null) {
    throw "Invalid type: DomainEntry name must be a string or null.";
  }
  this._name = name;
  this.fullName = fullName;
  this._higher = higher;
  this._lower = {};
  this.rules = new Rules();
}

DomainEntry.prototype = {
  _name : null,
  fullName : null,
  /**
   * A dictionary whose keys are strings of domain part names and values are
   * further DomainEntry objects.
   */
  _lower : null,
  _higher : null,
  rules : null,

  toString : function() {
    return "[DomainEntry '" + this._name + " (" + this.fullName + ")']";
  },

  print : function(depth) {
    depth = depth ? depth : 0;
    var indent = "";
    for (var i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    if (this.rules) {
      this.rules.print(depth + 1);
    }
    for (var entryName in this._lower) {
      this._lower[entryName].print(depth + 1);
    }
  },

  addLowerLevel : function(name, entry) {
    if (this._lower[name]) {
      throw "ENTRY_ALREADY_EXISTS";
    }
    this._lower[name] = entry;
  },

  getLowerLevel : function(name) {
    return this._lower[name];
  }
};


function IPAddressEntry(address) {
  this.address = address;
  this.rules = new Rules();
}

IPAddressEntry.prototype = {
  toString : function() {
    return "[IPAddressEntry '" + this.address + "']";
  },

  print : function(depth) {
    depth = depth ? depth : 0;
    var indent = "";
    for (var i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    if (this.rules) {
      this.rules.print(depth + 1);
    }
  },

  deleteAllRules : function() {

  }
};


function Ruleset(name) {
  this._name = name ? name : null;
  // Start off with an "empty" top-level domain entry. This will never have
  // its own rules. Non-host-specific rules go in |this.rules|.
  this._domain = new DomainEntry(null, null, null);
  this._ipAddr = {};
  this.rules = new Rules();
}

// TODO: remove
//if (!print) {
//  var print;
//}

Ruleset.prototype = {
  _name : null,
  _domain : null,
  _ipAddr : null,
  rules : null,

  toString : function() {
    return "[Ruleset " + this._name + "]";
  },

  print : function(depth) {
    depth = depth ? depth : 0;
    var indent = "";
    for (var i = 0; i < depth; i++) {
      indent += "  ";
    }
    dprint(indent + this.toString());
    this._domain.print(depth + 1);
    //this._ipAddr.print(depth + 1);
    this.rules.print(depth + 1);
  },

  _isIPAddress : function(host) {
    // Check if it's an IPv6 address.
    if (host.indexOf(":") != -1) {
      return true;
    }
    var parts = host.split(".");
    for (var i = 0; i < parts.length; i++) {
      if (!parseInt(parts[i])) {
        return false;
      }
    }
    return true;
  },

  _getIPAddress : function(address) {
    // TODO: Canonicalize IPv6 addresses.
    return this._ipAddr[address];
  },

  _addIPAddress : function(address) {
    // TODO: Canonicalize IPv6 addresses.
    if (!this._ipAddr[address]) {
      this._ipAddr[address] = new IPAddressEntry(address);
    }
    return this._ipAddr[address];
  },

  _getDomain : function(domain) {
    var parts = domain.split(".");
    var curLevel = this._domain;
    var nextLevel;
    var fullName = "";
    for (var i = parts.length - 1; i >= 0; i--) {
      //dprint(parts[i]);
      fullName = parts[i] + (fullName ? "." : "") + fullName;
      nextLevel = curLevel.getLowerLevel(parts[i]);
      if (!nextLevel) {
        return null;
      }
      curLevel = nextLevel;
    }
    return curLevel;
  },

  _addDomain : function(domain) {
    var parts = domain.split(".");
    var curLevel = this._domain;
    var nextLevel;
    var fullName = "";
    for (var i = parts.length - 1; i >= 0; i--) {
      //dprint(parts[i]);
      fullName = parts[i] + (fullName ? "." : "") + fullName;
      nextLevel = curLevel.getLowerLevel(parts[i]);
      if (!nextLevel) {
        nextLevel = new DomainEntry(parts[i], fullName, curLevel);
        //dprint(nextLevel);
        curLevel.addLowerLevel(parts[i], nextLevel);
      }
      curLevel = nextLevel;
    }
    return curLevel;
  },

  getHost : function(host) {
    if (!host) {
      throw "INVALID_HOST";
    }
    if (this._isIPAddress(host)) {
      return this._getIPAddress(host);
    } else {
      return this._getDomain(host);
    }
  },

  addHost : function(host) {
    if (!host) {
      throw "INVALID_HOST";
    }
    if (this._isIPAddress(host)) {
      return this._addIPAddress(host);
    } else {
      return this._addDomain(host);
    }
  },

  /**
   * Yields all matching hosts. For domains, this is in top-down order. For
   * example, first "com", then "foo", then "www".
   *
   * @param string
   *          host The host to get matching entries for.
   * @return DomainEntry|IPAddressEntry
   */
  getHostMatches : function(host) {
    if (!this.rules.isEmpty()) {
      // There are non-host-specific rules for this policy. If it's the start
      // of an origin-to-destination rule, the origin is non-host-specific but
      // the destination doesn't have to be. Note that we never check for
      // a domain entry of "*" because that is represented by these any
      // non-host-specific rules that are defined.
      yield this;
    }

    if (!host) {
      return;
    }

    if (this._isIPAddress(host)) {
      var addrEntry = this._ipAddr[host];
      if (addrEntry) {
        yield addrEntry;
      }
    } else {
      var parts = host.split(".");
      var curLevel = this._domain;
      // Start by checking for a wildcard at the highest level.
      var nextLevel = curLevel.getLowerLevel("*");
      if (nextLevel) {
        yield nextLevel;
      }
      for (var i = parts.length - 1; i >= 0; i--) {
        nextLevel = curLevel.getLowerLevel(parts[i]);
        if (!nextLevel) {
          break;
        }
        curLevel = nextLevel;
        yield nextLevel;

        // Check for *.domain rules at each level.
        nextLevel = curLevel.getLowerLevel("*");
        if (nextLevel) {
          yield nextLevel;
        }
      }
    }
  },

  check : function(origin, dest) {
    var matchedAllowRules = [];
    var matchedDenyRules = [];
    try {
     var originHost = origin["host"];
    } catch (e) {
      var originHost = '';
    }
    try {
      var destHost = dest["host"];
    } catch (e) {
      var destHost = '';
    }
    //dprint("Checking origin rules and origin-to-destination rules.");
    // First, check for rules for each part of the origin host.
    for (var entry in this.getHostMatches(originHost)) {
      //dprint(entry);
      for (var rule in entry.rules) {
        //dprint("Checking rule: " + rule);
        var ruleMatchedOrigin = rule.isMatch(origin);
        if (rule.allowOrigin && ruleMatchedOrigin) {
          //dprint("ALLOW origin by rule " + entry + " " + rule);
          matchedAllowRules.push(["origin", entry, rule]);
        }
        if (rule.denyOrigin && ruleMatchedOrigin) {
          //dprint("DENY origin by rule " + entry + " " + rule);
          matchedDenyRules.push(["origin", entry, rule]);
        }
        // Check if there are origin-to-destination rules from the origin host
        // entry we're currently looking at.
        if (ruleMatchedOrigin && rule.destinations) {
          //dprint("There are origin-to-destination rules using this origin rule.");
          for (var destEntry in rule.destinations.getHostMatches(destHost)) {
            //dprint(destEntry);
            for (var destRule in destEntry.rules) {
              //dprint("Checking rule: " + rule);
              if (destRule.allowDestination && destRule.isMatch(dest)) {
                //dprint("ALLOW origin-to-dest by rule origin " + entry + " " + rule + " to dest " + destEntry + " " + destRule);
                matchedAllowRules.push(["origin-to-dest", entry, rule, destEntry, destRule]);
              }
              if (destRule.denyDestination && destRule.isMatch(dest)) {
                //dprint("DENY origin-to-dest by rule origin " + entry + " " + rule + " to dest " + destEntry + " " + destRule);
                matchedDenyRules.push(["origin-to-dest", entry, rule, destEntry, destRule]);
              }
            }
          }
          //dprint("Done checking origin-to-destination rules using this origin rule.");
        } // end: if (rule.destinations)
      }
    }

    //dprint("Checking dest rules.");
    // Last, check for rules for each part of the destination host.
    for (var entry in this.getHostMatches(destHost)) {
      //dprint(entry);
      for (var rule in entry.rules) {
        //dprint("Checking rule: " + rule);
        if (rule.allowDestination && rule.isMatch(dest)) {
          //dprint("ALLOW dest by rule " + entry + " " + rule);
          matchedAllowRules.push(["dest", entry, rule]);
        }
        if (rule.denyDestination && rule.isMatch(dest)) {
          //dprint("DENY dest by rule " + entry + " " + rule);
          matchedDenyRules.push(["dest", entry, rule]);
        }
      }
    }

    return [matchedAllowRules, matchedDenyRules];
  }
}

/**
 * @static
 */
Ruleset._matchToRawRuleHelper = function(rawRule, originOrDest, entry, rule) {
  rawRule[originOrDest] = {};
  if (entry instanceof DomainEntry && entry.fullName) {
    rawRule[originOrDest]["h"] = entry.fullName;
  } else if (entry instanceof IPAddressEntry) {
    rawRule[originOrDest]["h"] = entry.address;
  }
  if (rule.scheme) {
    rawRule[originOrDest]["s"] = rule.scheme;
  }
  if (rule.port) {
    rawRule[originOrDest]["port"] = rule.port;
  }
  // TODO: path
}

/**
 * @static
 */
Ruleset.matchToRawRule = function(match) {
  // The matches are in the format
  //     [actionStr, entry, rule]
  // or
  //     [actionStr, originEntry, originRule, destEntry, destRule]
  // as returned by calls to |Ruleset.check()|.
  var rawRule = {};
  var entry, rule, destEntry, destRule;
  var actionStr = match[0];

  if (actionStr == "origin") {
    [actionStr, entry, rule] = match;
    Ruleset._matchToRawRuleHelper(rawRule, "o", entry, rule);
  } else if (actionStr == "dest") {
    [actionStr, entry, rule] = match;
    Ruleset._matchToRawRuleHelper(rawRule, "d", entry, rule);
  } else if (actionStr == "origin-to-dest") {
    [actionStr, entry, rule, destEntry, destRule] = match;
    Ruleset._matchToRawRuleHelper(rawRule, "o", entry, rule);
    Ruleset._matchToRawRuleHelper(rawRule, "d", destEntry, destRule);
  } else {
    throw "[matchToRawRule] Invalid match type: " + actionStr
          + " from match: " + match;
  }

  return rawRule;
}

/**
 * @static
 */
Ruleset._rawRuleToCanonicalStringHelper = function(rawRule, originOrDest, parts) {
  if (rawRule[originOrDest]) {
    parts.push('"' + originOrDest + '":{');
    var needComma = false;
    if (rawRule[originOrDest]["h"]) {
      parts.push('"h":"' + rawRule[originOrDest]["h"] + '"');
      needComma = true;
    }
    if (rawRule[originOrDest]["port"]) {
      if (needComma) {
        parts.push(',');
      }
      parts.push('"port":"' + rawRule[originOrDest]["port"] + '"');
    }
    if (rawRule[originOrDest]["s"]) {
      if (needComma) {
        parts.push(',');
      }
      parts.push('"s":"' + rawRule[originOrDest]["s"] + '"');
    }
    parts.push('}');
  }
  // TODO: pathPre and pathRegex (will need to escape strings)
  parts.push('}');
  return parts.join("");
}

Ruleset.rawRuleToCanonicalString = function(rawRule) {
  var parts = ['{'];
  if (rawRule["d"]) {
    Ruleset._rawRuleToCanonicalStringHelper(rawRule, "d", parts);
  }
  if (rawRule["d"] && rawRule["o"]) {
    parts.push(',');
  }
  if (rawRule["o"]) {
    Ruleset._rawRuleToCanonicalStringHelper(rawRule, "o", parts);
  }
  parts.push('}');
  return parts.join("");
}

/**
 * @static
 */
// Ruleset.rawRulesAreEqual = function(first, second) {
//   var firstStr = Ruleset.rawRuleToCanonicalString(first);
//   var secondStr = Ruleset.rawRuleToCanonicalString(second);
//   return firstStr == secondStr;
// }
