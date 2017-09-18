/* exported run_test */
Components.utils.import("chrome://rpcontinued/content/lib/ruleset.jsm");
Components.utils.import("chrome://rpcontinued/content/lib/ruleset-storage.jsm");
Components.utils.import("chrome://rpcontinued/content/lib/utils/constants.jsm");

// jscs:disable validateIndentation

// We expect JSON data to represent the following data structure.
const exampleJsonObj = {
  "metadata": {
    "version": 1,
    "name": "policyname", // unique name for this policy, used in filename
    "source": "user" // "user" or "subscription"
  },
  "entries": {
    "allow": [
      // 'o' => origin
      // 'd' => destination
      // 's' => scheme
      // 'port' => port ('*' for any, integer for specific port, -1 for default port [default])
      // 'pathPre' => path prefix (must start with "/")
      // 'pathRegex' => path regex (no enclosing characters: '^/abc' not '/^\/abc/')
      {"o": {"h": "www.foo.com"},
       "d": {"h": "www.bar.com"}},
      {"o": {"h": "www.example.com",
             "s": "https",
             "pathPre": "/test/"},
       "d": {"h": "www.bar.com",
             "s": "https"}},
    ],
    "deny": [
      {"d": {"h": "google-analytics.com"}},
      {"o": {"s": "https"}, "d": {"s": "http"}},
    ]
  }
};

function run_test() {
  test_1();
  test_2();
}

function test_1() {
  const filename = "foo.json";

  let jsonData = JSON.stringify(exampleJsonObj);
  const rawRuleset = new RawRuleset(jsonData);

  // Write it to the file. This will create the file in the policies directory.
  RulesetStorage.saveRawRulesetToFile(rawRuleset, filename);

  // Read it back from the file.
  const readRuleset = RulesetStorage.loadRawRulesetFromFile(filename);

  jsonData = JSON.stringify(readRuleset);
  const readJsonObj = JSON.parse(jsonData);

  deepEqual(readJsonObj, exampleJsonObj);

  deleteFileFromProfile(filename);
}


function test_2() {
  const filename = "foo.json";
  const rules = {"origin":         {"o": {"h": "*.foo.com"}},
                 "dest":           {"d": {"h": "www.example.com"}},
                 "origin-to-dest": {"o": {"h": "*.foo.com"},
                                    "d": {"h": "www.example.com"}}};

  let rawRuleset = new RawRuleset();

  do_check_eq(Object.keys(rawRuleset._metadata).length, 1);
  do_check_eq(rawRuleset._metadata.version, 1);
  do_check_eq(rawRuleset._entries.allow.length, 0);
  do_check_eq(rawRuleset._entries.deny.length, 0);

  // Write it to a file and read it back.
  RulesetStorage.saveRawRulesetToFile(rawRuleset, filename);
  rawRuleset = RulesetStorage.loadRawRulesetFromFile(filename);

  do_check_eq(Object.keys(rawRuleset._metadata).length, 1);
  do_check_eq(rawRuleset._metadata.version, 1);
  do_check_eq(rawRuleset._entries.allow.length, 0);
  do_check_eq(rawRuleset._entries.deny.length, 0);

  // Add all of the rules as allow rules.
  for (let name in Iterator(rules, true)) {
    // Do it twice to trigger bugs/check for duplicates.
    rawRuleset.addRule(C.RULE_ACTION_ALLOW, rules[name]);
    rawRuleset.addRule(C.RULE_ACTION_ALLOW, rules[name]);
  }

  // Write it to a file and read it back.
  RulesetStorage.saveRawRulesetToFile(rawRuleset, filename);
  rawRuleset = RulesetStorage.loadRawRulesetFromFile(filename);

  do_check_eq(rawRuleset._entries.allow.length, 3);
  do_check_eq(rawRuleset._entries.deny.length, 0);

  // Add all of the rules as deny rules.
  for (let name in Iterator(rules, true)) {
    // Do it twice to trigger bugs/check for duplicates.
    rawRuleset.addRule(C.RULE_ACTION_DENY, rules[name]);
    rawRuleset.addRule(C.RULE_ACTION_DENY, rules[name]);
  }

  // Write it to a file and read it back.
  RulesetStorage.saveRawRulesetToFile(rawRuleset, filename);
  rawRuleset = RulesetStorage.loadRawRulesetFromFile(filename);

  do_check_eq(rawRuleset._entries.allow.length, 3);
  do_check_eq(rawRuleset._entries.deny.length, 3);

  // Remove one of the deny rules.
  rawRuleset.removeRule(C.RULE_ACTION_DENY, rules.origin);

  // Write it to a file and read it back.
  RulesetStorage.saveRawRulesetToFile(rawRuleset, filename);
  rawRuleset = RulesetStorage.loadRawRulesetFromFile(filename);

  do_check_eq(rawRuleset._entries.allow.length, 3);
  do_check_eq(rawRuleset._entries.deny.length, 2);

  // Remove all of the deny rules.
  for (let name in Iterator(rules, true)) {
    // Do it twice to trigger bugs/check for duplicates.
    rawRuleset.removeRule(C.RULE_ACTION_DENY, rules[name]);
    rawRuleset.removeRule(C.RULE_ACTION_DENY, rules[name]);
  }

  // Write it to a file and read it back.
  RulesetStorage.saveRawRulesetToFile(rawRuleset, filename);
  rawRuleset = RulesetStorage.loadRawRulesetFromFile(filename);

  do_check_eq(rawRuleset._entries.allow.length, 3);
  do_check_eq(rawRuleset._entries.deny.length, 0);

  // Remove one of the allow rules.
  rawRuleset.removeRule(C.RULE_ACTION_ALLOW, rules.dest);

  // Write it to a file and read it back.
  RulesetStorage.saveRawRulesetToFile(rawRuleset, filename);
  rawRuleset = RulesetStorage.loadRawRulesetFromFile(filename);

  do_check_eq(rawRuleset._entries.allow.length, 2);
  do_check_eq(rawRuleset._entries.deny.length, 0);

  // Remove all of the allow rules.
  for (let name in Iterator(rules, true)) {
    // Do it twice to trigger bugs/check for duplicates.
    rawRuleset.removeRule(C.RULE_ACTION_ALLOW, rules[name]);
    rawRuleset.removeRule(C.RULE_ACTION_ALLOW, rules[name]);
  }

  // Write it to a file and read it back.
  RulesetStorage.saveRawRulesetToFile(rawRuleset, filename);
  rawRuleset = RulesetStorage.loadRawRulesetFromFile(filename);

  do_check_eq(rawRuleset._entries.allow.length, 0);
  do_check_eq(rawRuleset._entries.deny.length, 0);

  deleteFileFromProfile(filename);
}
