Components.utils.import("chrome://rpcontinued/content/lib/domain-util.jsm");
Components.utils.import("chrome://rpcontinued/content/lib/ruleset.jsm");
Components.utils.import("chrome://rpcontinued/content/lib/policy-manager.jsm");


var config = {
  "subscriptions" : {
    "foo" : {
      "name" : "The Foo RP whitelist and blacklist.",
      "updateUrls" : {
        "http://foo.com/rp.json" : {}
      },
      "infoUrls" : {
        "About" : "http://foo.com/about.html"
      }
    }
  }
};


function run_test() {
  test_0();
  test_1();
  test_2();
}


function test_0() {
  copyRulesetFileToProfile("user_0.json", "user.json");
  copyRulesetFileToProfile("foo.json");

  var manager = new PolicyManager();
  manager.loadPolicies(config);

  for (var i in manager._rulesets) {
    print("print ruleset: " + i);
    manager._rulesets[i].ruleset.print(0, print);
    print(JSON.stringify(manager._rulesets[i].rawRuleset));
  }

  // "user", "temp", and "foo".
  do_check_eq(Object.keys(manager._rulesets).length, 3);

  var result;

  // This is allowed because of https to http.
  var origin = DomainUtil.getUriObject("https://example.com/");
  var dest = DomainUtil.getUriObject("http://foo.com/");

  result = manager.checkRequest(origin, dest);
  do_check_false(result.isDenied());
  do_check_true(result.isAllowed());
  // for (var i in detailedResults) {
  //   print("ruleset: " + i);
  //   print("  allow: " + detailedResults[i]["allowMatches"]);
  //   print(detailedResults[i]["allowMatches"].length);
  //   for (var rule in detailedResults[i]["allowMatches"]) {
  //     print("  rule: " + rule);
  //   }
  //   print("  deny: " + detailedResults[i]["denyMatches"]);
  //   print(detailedResults[i]["denyMatches"].length);
  //   for (var rule in detailedResults[i]["denyMatches"]) {
  //     print("  rule: " + rule);
  //   }
  // }

  var origin = DomainUtil.getUriObject("http://www.foo.com/");
  var dest = DomainUtil.getUriObject("https://www.example.com/");

  result = manager.checkRequest(origin, dest);
  do_check_false(result.isDenied());
  do_check_false(result.isAllowed());

  deleteFileFromProfile("user.json");
  deleteFileFromProfile("foo.json");
}

  // Functions to test:
  // addRule
  // addTemporaryRule
  // removeRule

/*
 * Test only persistent (non-temporary) rules.
 */
function test_1() {
  var noStore = true;
  var manager = new PolicyManager();
  manager.loadPolicies();

  var origin = DomainUtil.getUriObject("http://www.foo.com/");
  var dest = DomainUtil.getUriObject("https://www.example.com/");

  var rules = {"origin"         : {"o" : {"h" : "*.foo.com"}},
               "dest"           : {"d" : {"h" : "www.example.com"}},
               "origin-to-dest" : {"o" : {"h" : "*.foo.com"},
                                   "d" : {"h" : "www.example.com"}}};

  for (var i in rules) {
    // Resetting the policy manager is useful for debugging failures.
    // var manager = new PolicyManager();
    // manager.loadPolicies();

    print("Starting: " + i);
    var rawRule = rules[i];
    // Add a rule we just added.
    manager.addRule(RULE_ACTION_ALLOW, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_true(result.isAllowed());
    do_check_eq(result.matchedAllowRules.length, 1);

    // Remove the rule we just added.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());

    // Remove the same rule twice in a row.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    // Add the original allow rule back.
    manager.addRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_true(result.isAllowed());

    // Add the same rule details but as a deny rule.
    manager.addRule(RULE_ACTION_DENY, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());

    // Add the same rule again.
    manager.addRule(RULE_ACTION_DENY, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());
    do_check_eq(result.matchedDenyRules.length, 1);

    // Add same rule as an allow rule.
    manager.addRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());

    // Remove both rules.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);
    manager.removeRule(RULE_ACTION_DENY, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());
  }
}


  // Functions to test:
  // addRule
  // addTemporaryRule
  // removeRule

/*
 * Test only temporary rules.
 */
function test_2() {
  var noStore = true;
  var manager = new PolicyManager();
  manager.loadPolicies();

  var origin = DomainUtil.getUriObject("http://www.foo.com/");
  var dest = DomainUtil.getUriObject("https://www.example.com/");

  var rules = {"origin"         : {"o" : {"h" : "*.foo.com"}},
               "dest"           : {"d" : {"h" : "www.example.com"}},
               "origin-to-dest" : {"o" : {"h" : "*.foo.com"},
                                   "d" : {"h" : "www.example.com"}}};

  for (var i in rules) {
    // Resetting the policy manager is useful for debugging failures.
    // var manager = new PolicyManager();
    // manager.loadPolicies();

    print("Starting: " + i);
    var rawRule = rules[i];
    // Add a rule we just added.
    manager.addTemporaryRule(RULE_ACTION_ALLOW, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_true(result.isAllowed());
    do_check_eq(result.matchedAllowRules.length, 1);

    // Remove the rule we just added.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());

    // Remove the same rule twice in a row.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    // Add the original allow rule back.
    manager.addTemporaryRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_true(result.isAllowed());

    // Add the same rule details but as a deny rule.
    manager.addTemporaryRule(RULE_ACTION_DENY, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());

    // Add the same rule again.
    manager.addTemporaryRule(RULE_ACTION_DENY, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());
    do_check_eq(result.matchedDenyRules.length, 1);

    // Add same rule as an allow rule.
    manager.addTemporaryRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());

    // Remove both rules.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);
    manager.removeRule(RULE_ACTION_DENY, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());
  }
}



  // Functions to test:
  // addRule
  // addTemporaryRule
  // removeRule

/*
 * Test both persistent and temporary rules whenever adding rules. A
 * single remove should remove from both.
 */
function test_2() {
  var noStore = true;
  var manager = new PolicyManager();
  manager.loadPolicies();

  var origin = DomainUtil.getUriObject("http://www.foo.com/");
  var dest = DomainUtil.getUriObject("https://www.example.com/");

  var rules = {"origin"         : {"o" : {"h" : "*.foo.com"}},
               "dest"           : {"d" : {"h" : "www.example.com"}},
               "origin-to-dest" : {"o" : {"h" : "*.foo.com"},
                                   "d" : {"h" : "www.example.com"}}};

  for (var i in rules) {
    // Resetting the policy manager is useful for debugging failures.
    // var manager = new PolicyManager();
    // manager.loadPolicies();

    print("Starting: " + i);
    var rawRule = rules[i];
    // Add a rule as both persistent and temporary.
    manager.addRule(RULE_ACTION_ALLOW, rawRule, noStore);
    manager.addTemporaryRule(RULE_ACTION_ALLOW, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_true(result.isAllowed());
    do_check_eq(result.matchedAllowRules.length, 2);

    // Remove the rule we just added.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());

    // Remove the same rule twice in a row.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    // Add the original allow rules back.
    manager.addRule(RULE_ACTION_ALLOW, rawRule, noStore);
    manager.addTemporaryRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_true(result.isAllowed());

    // Add the same rule details but as a deny rule.
    manager.addRule(RULE_ACTION_DENY, rawRule, noStore);
    manager.addTemporaryRule(RULE_ACTION_DENY, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());

    // Add the same rule again.
    manager.addRule(RULE_ACTION_DENY, rawRule, noStore);
    manager.addTemporaryRule(RULE_ACTION_DENY, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());
    do_check_eq(result.matchedDenyRules.length, 2);

    // Add same rule as an allow rule.
    manager.addRule(RULE_ACTION_ALLOW, rawRule, noStore);
    manager.addTemporaryRule(RULE_ACTION_ALLOW, rawRule, noStore);

    for (var i in manager._rulesets) {
      print("print ruleset: " + i);
      manager._rulesets[i].ruleset.print(0, print);
    }

    result = manager.checkRequest(origin, dest);
    do_check_true(result.isDenied());
    do_check_true(result.isAllowed());

    // Remove both rules.
    manager.removeRule(RULE_ACTION_ALLOW, rawRule, noStore);
    manager.removeRule(RULE_ACTION_DENY, rawRule, noStore);

    result = manager.checkRequest(origin, dest);
    do_check_false(result.isDenied());
    do_check_false(result.isAllowed());
  }
}
