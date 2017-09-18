/* exported run_test */
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://rpcontinued/content/lib/ruleset.jsm");
Components.utils.import("chrome://rpcontinued/content/lib/utils/constants.jsm");

function run_test() {
  run_next_test();
}

add_test(function() {
  function testRuleSpec(ruleSpec, shouldMatch, originUriSpec, destUriSpec) {
    // SETUP
    // create a Ruleset
    let rawRuleset = new RawRuleset();
    let ruleset = new Ruleset();
    // Add the rule to the ruleset
    let ruleAction = C.RULE_ACTION_ALLOW; // Doesn't matter
    rawRuleset.addRule(ruleAction, ruleSpec, ruleset);
    // create nsIURI
    let originUri = Services.io.newURI(originUriSpec, null, null);
    let destUri = Services.io.newURI(destUriSpec, null, null);

    // EXERCISE
    let [matchedAllowRules ] = ruleset.check(originUri, destUri);

    // VERIFY
    strictEqual(shouldMatch ? 1 : 0, matchedAllowRules.length);
  }

  function test(endpointSpec, shouldMatch, uriSpec) {
    testRuleSpec({o: endpointSpec}, shouldMatch, uriSpec, "dummy://destination/uri");
    testRuleSpec({d: endpointSpec}, shouldMatch, "dummy://origin/uri", uriSpec);
  }

  // anything
  test({                                          }, true,  "http://localhost/");
  test({                                          }, true,  "http://localhost:8080/");
  test({                                          }, true,  "about:blank");
  test({                                          }, true,  "file:///etc/hosts");

  // Specific port
  test({                                 port: 81 }, true,  "http://localhost:81");
  test({                                 port: 81 }, false, "http://localhost");
  test({                                 port: 80 }, true,  "http://localhost");
  test({                                 port: 81 }, false, "about:blank");
  test({                                 port: 81 }, false, "file:///etc/hosts");

  // Default port
  test({                                 port: -1 }, true,  "http://localhost");
  test({                                 port: -1 }, false, "http://localhost:81");
  test({                                 port: -1 }, true,  "https://localhost");
  test({                                 port: -1 }, false, "https://localhost:82");
  test({                                 port: -1 }, false, "about:blank");
  test({                                 port: -1 }, true,  "file:///etc/hosts");

  // Any port
  test({                                 port: "*"}, true,  "http://localhost");
  test({                                 port: "*"}, true,  "http://localhost:81");
  test({                                 port: "*"}, true,  "https://localhost");
  test({                                 port: "*"}, true,  "https://localhost:82");
  test({                                 port: "*"}, false, "about:blank");
  test({                                 port: "*"}, true,  "file:///etc/hosts");

  // Host + Default port
  test({           h: "www.example.com"           }, true,  "http://www.example.com/");
  test({           h: "www.example.com"           }, false, "http://www.example.com:81/");

  // Host + Specific port
  test({           h: "www.example.com", port: 81 }, false, "http://www.example.com/");
  test({           h: "www.example.com", port: 81 }, true, "http://www.example.com:81/");

  // Host + Any port
  test({           h: "www.example.com", port: "*"}, true, "http://www.example.com/");
  test({           h: "www.example.com", port: "*"}, true, "http://www.example.com:81/");

  // FIXME
  // // Host non-existent
  // test({           h: null                        }, false, "http://localhost/");
  // test({           h: null                        }, false, "http://localhost:8080/");
  // test({           h: null                        }, true,  "about:blank");
  // test({           h: null                        }, false, "file:///etc/hosts");

  // FIXME
  // // Host empty
  // test({           h: ""                          }, false, "http://localhost/");
  // test({           h: ""                          }, false, "http://localhost:8080/");
  // test({           h: ""                          }, false, "about:blank");
  // test({           h: ""                          }, true,  "file:///etc/hosts");

  // FIXME; see PR #555
  // Any Host + Default port
  test({           h: "*"                         }, true,  "http://www.example.com/");
  test({           h: "*"                         }, true,  "http://localhost/");
  test({           h: "*"                         }, false, "http://www.example.com:81/");
  test({           h: "*"                         }, false, "http://localhost:81/");

  // Specific Scheme
  test({s: "http"                                 }, true,  "http://localhost/");
  test({s: "http"                                 }, true,  "http://localhost:8080/");
  test({s: "http"                                 }, false, "about:blank");
  test({s: "http"                                 }, false, "file:///etc/hosts");
  test({s: "http"                                 }, false, "https://localhost/");
  test({s: "about"                                }, true,  "about:blank");
  test({s: "about"                                }, false,  "http://localhost/");

  // Any Scheme
  test({s: "*"                                    }, true,  "http://localhost/");
  test({s: "*"                                    }, true,  "http://localhost:8080/");
  test({s: "*"                                    }, true,  "about:blank");
  test({s: "*"                                    }, true,  "file:///etc/hosts");

  run_next_test();
});
