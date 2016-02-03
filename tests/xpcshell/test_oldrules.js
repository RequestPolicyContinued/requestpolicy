/* exported run_test */
Cu.import("chrome://rpcontinued/content/lib/old-rules.jsm");
Cu.import("chrome://rpcontinued/content/models/prefs.jsm");


function run_test() {
  "use strict";

  test_0();
  test_1();
  test_2();
}


/**
 * Usual rulues.
 */
function test_0() {
  "use strict";

  testGetOldRulesAsNewRules(
      [
        "mozilla.org",
        "mozilla.net",
        "mozilla.org|mozilla.net"
      ],
      [
        {o: {h: "*.mozilla.org"}},
        {d: {h: "*.mozilla.net"}},
        {o: {h: "*.mozilla.org"}, d: {h: "*.mozilla.net"}}
      ]);

  testGetOldRulesAsNewRules(
      [
        "https://www.mozilla.org " +
        "www.mozilla.org " +
        "mozilla.org",

        "https://mozorg.cdn.mozilla.net " +
        "mozorg.cdn.mozilla.net " +
        "mozilla.net",

        "https://www.mozilla.org|https://mozorg.cdn.mozilla.net " +
        "www.mozilla.org|mozorg.cdn.mozilla.net " +
        "mozilla.org|mozilla.net"
      ],
      [
        {o: {s: "https", h: "www.mozilla.org"}},
        {o: {h: "www.mozilla.org"}},
        {o: {h: "*.mozilla.org"}},

        {d: {s: "https", h: "mozorg.cdn.mozilla.net"}},
        {d: {h: "mozorg.cdn.mozilla.net"}},
        {d: {h: "*.mozilla.net"}},

        {
          o: {s: "https", h: "www.mozilla.org"},
          d: {s: "https", h: "mozorg.cdn.mozilla.net"}
        }, {
          o: {h: "www.mozilla.org"},
          d: {h: "mozorg.cdn.mozilla.net"}
        }, {
          o: {h: "*.mozilla.org"},
          d: {h: "*.mozilla.net"}
        }
      ]);

  // localhost IP address
  testGetOldRulesAsNewRules(
      [
        // IPv4
        "127.0.0.1 " +
        "http://127.0.0.1:8080 " +
        // IPv6
        "::1 " +
        "http://[::1]:8080",
        "",
        ""
      ],
      [
        {o: {h: "127.0.0.1"}},
        {o: {s: "http", h: "127.0.0.1", port: 8080}},
        {o: {h: "::1"}},
        {o: {s: "http", h: "::1", port: 8080}}
      ]);

  // Get the old rules from the prefs.
  // The prefs don't exist.
  testGetOldRulesAsNewRules([undefined, undefined, undefined], []);

  // Get the old rules from the prefs.
  // Some rules are defined in the prefs.
  usingOldRulePrefs({
    "allowedOrigins": "mozilla.org",
    "allowedDestinations": "mozilla.net",
    "allowedOriginsToDestinations": "mozilla.org|mozilla.net"
  }, function() {
    testGetOldRulesAsNewRules([undefined, undefined, undefined], [
      {o: {h: "*.mozilla.org"}},
      {d: {h: "*.mozilla.net"}},
      {o: {h: "*.mozilla.org"}, d: {h: "*.mozilla.net"}}
    ]);
  });
}


/**
 * Rules where the URIs don't have an "authority" part.
 */
function test_1() {
  "use strict";

  testGetOldRulesAsNewRules(
      [
        "foo1: " +
        "foo2:",

        "foo3: " +
        "foo4:",

        "foo5o:|foo5d: " +
        "foo6o:|foo6d:"
      ],
      [
        {o: {s: "foo1"}},
        {o: {s: "foo2"}},

        {d: {s: "foo3"}},
        {d: {s: "foo4"}},

        {o: {s: "foo5o"}, d: {s: "foo5d"}},
        {o: {s: "foo6o"}, d: {s: "foo6d"}}
      ]);
}


/**
 * Special cases.
 */
function test_2() {
  "use strict";

  // invalid rules

  function testInvalidRule(originToDest) {
    Assert.throws(function() {
      testGetOldRulesAsNewRules(["", "", originToDest], []);
    }, OldRulesParseError);
  }

  testInvalidRule("|");
  testInvalidRule("zeroVerticalBars");
  testInvalidRule("multiple|vertical|bars");
  testInvalidRule("foo|");
  testInvalidRule("|bar");
  testInvalidRule("|foobar|");

  // many spaces

  testGetOldRulesAsNewRules(
      [
        "a     b",
        " c    d ",
        " e|f  g|h "
      ],
      [
        {o: {h: "a"}}, {o: {h: "b"}},
        {d: {h: "c"}}, {d: {h: "d"}},
        {o: {h: "e"}, d: {h: "f"}},
        {o: {h: "g"}, d: {h: "h"}}
      ]);

  // UTF8 domain names

  testGetOldRulesAsNewRules(
      ["müller.de http://foo.bar.الاردن", "", ""],
      [
        {o: {h: "*.müller.de"}},
        {o: {s: "http", h: "foo.bar.الاردن"}}
      ]);
}


function usingOldRulePrefs(aPrefs, aFunction) {
  "use strict";

  function forEachPrefName(fn) {
    Object.getOwnPropertyNames(aPrefs).forEach(fn);
  }

  // Set the prefs.
  forEachPrefName(function(prefName) {
    let prefValue = aPrefs[prefName];
    setOldRulePref(prefName, prefValue);
  });

  aFunction.call(null);

  // Clear the prefs.
  forEachPrefName(function(prefName) {
    Prefs.reset(prefName);
  });
}

function setOldRulePref(aPrefName, aValue) {
  "use strict";
  // Code taken from RequestPolicy 0.5.28 (requestpolicyService.js).

  // Not using just setCharPref because these values may contain Unicode
  // strings (e.g. for IDNs).
  var str = Cc["@mozilla.org/supports-string;1"]
      .createInstance(Ci.nsISupportsString);
  str.data = aValue;
  Prefs.branches.rp.branch.
      setComplexValue(aPrefName, Ci.nsISupportsString, str);
}

function testGetOldRulesAsNewRules(
    [origins, destinations, originsToDestinations], expectedRuleSpecs) {
  "use strict";

  var oldRules = new OldRules(origins, destinations, originsToDestinations);
  var actualRuleSpecs = oldRules.getAsNewRules();
  assertRuleSpecsEqual(actualRuleSpecs, expectedRuleSpecs);
}

function assertRuleSpecsEqual(actual, expected) {
  "use strict";

  if (false === Array.isArray(actual)) {
    actual = [actual];
  }
  if (false === Array.isArray(expected)) {
    expected = [expected];
  }

  equal(actual.length, expected.length);

  actual.sort();
  expected.sort();

  for (let i = 0, len = expected.length; i < len; ++i) {
    deepEqual(actual[i], expected[i]);
  }
}
