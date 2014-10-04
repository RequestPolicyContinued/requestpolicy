
var policy = new Ruleset();

dprint("== Allow all requests from origin www.foo.com ==");
var host = policy.addHost("www.foo.com");
var r = host.rules.add();
r.originRuleAction = RULE_ACTION_ALLOW;
dprint("=======");

dprint("== Deny all requests to destination www.foo.com ==");
var host = policy.addHost("www.foo.com");
var r = host.rules.add();
r.destinationRuleAction = RULE_ACTION_DENY;
dprint("=======");

dprint("== Allow all requests from https://www.foo.com to https://* ==");
var host = policy.addHost("www.foo.com");
var r = host.rules.add("https");
r.initDestinations();
var destRule = r.destinations.rules.add("https");
destRule.destinationRuleAction = RULE_ACTION_ALLOW;
dprint("=======");

dprint("== Allow all requests from *.foo.com to *.bar.com ==");
var host = policy.addHost("*.foo.com");
var r = host.rules.add();
r.initDestinations();
var barHost = r.destinations.addHost("*.bar.com");
var destRule = barHost.rules.add();
destRule.destinationRuleAction = RULE_ACTION_ALLOW;
dprint("=======");

dprint("== Allow all requests to https:// ==");
var r = policy.rules.add("https");
r.destinationRuleAction = RULE_ACTION_ALLOW;
dprint("=======");

dprint("== Allow all requests to https://localhost:8888/baz ==");
var host = policy.addHost("localhost");
var r = host.rules.add("https", 8888);
r.path = "/baz";
r.destinationRuleAction = RULE_ACTION_ALLOW;
dprint("=======");


policy.print();


var tests = [];

tests.push({"origin" : "https://foo.com/",
            "dest" : "http://z.bar.com:81/blah",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://www.foo.com/",
            "dest" : "http://z.bar.com:81/blah",
            "allowCount" : 1,
            "denyCount" : 0});

tests.push({"origin" : "http://www.example.com/",
            "dest" : "https://localhost:8888/baz/test",
            "allowCount" : 1,
            "denyCount" : 0});

runPolicyTests(policy, tests);
