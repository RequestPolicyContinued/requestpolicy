
var policy = new Ruleset();

dprint("== Allow all requests from *.foo.com to *.bar.com ==");
var host = policy.addHost("*.foo.com");
var r = host.rules.add();
r.initDestinations();
barHost = r.destinations.addHost("*.bar.com");
var destRule = barHost.rules.add();
destRule.destinationRuleAction = RULE_ACTION_ALLOW;
dprint("=======");

dprint("== Deny all requests from https://*.foo.com to http://*.bar.com ==");
var host = policy.addHost("*.foo.com");
var r = host.rules.add("https");
r.initDestinations();
barHost = r.destinations.addHost("*.bar.com");
var destRule = barHost.rules.add("http");
destRule.destinationRuleAction = RULE_ACTION_DENY;
dprint("=======");


policy.print();


var tests = [];

tests.push({"origin" : "http://a.b.foo.com/zz",
            "dest" : "http://bar.com/",
            "allowCount" : 1,
            "denyCount" : 0});

tests.push({"origin" : "http://a.b.foo.com/zz",
            "dest" : "https://bar.com/",
            "allowCount" : 1,
            "denyCount" : 0});

tests.push({"origin" : "https://a.b.foo.com/zz",
            "dest" : "https://bar.com/",
            "allowCount" : 1,
            "denyCount" : 0});

tests.push({"origin" : "https://a.b.foo.com/zz",
            "dest" : "http://bar.com/",
            "allowCount" : 1,
            "denyCount" : 1});

runPolicyTests(policy, tests);
