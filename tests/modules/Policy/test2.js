
var policy = new Ruleset();

dprint("== Allow all requests to https://localhost:8888/baz ==");
var host = policy.addHost("localhost");
var r = host.rules.add("https", 8888);
r.path = "/baz";
r.destinationRuleType = RULE_TYPE_ALLOW;
dprint("=======");


policy.print();


var tests = [];

tests.push({"origin" : "https://foo.com/",
            "dest" : "https://localhost:8888/ba",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://localhost:8888/baz",
            "dest" : "https://localhost:8888/ba",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://foo.com/",
            "dest" : "https://localhost/baz",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://foo.com/",
            "dest" : "https://127.0.0.1:8443/baz",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://foo.com/",
            "dest" : "http://localhost:8888/baz",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://foo.com/",
            "dest" : "http://localhost/baz",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://foo.com/",
            "dest" : "https://localhost:443/baz",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://foo.com/",
            "dest" : "http://localhost:80/baz",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://foo.com/",
            "dest" : "https://localhost:8888/baz",
            "allowCount" : 1,
            "denyCount" : 0});

tests.push({"origin" : "https://foo.com/",
            "dest" : "https://localhost:8888/bazbaz",
            "allowCount" : 1,
            "denyCount" : 0});

runPolicyTests(policy, tests);
