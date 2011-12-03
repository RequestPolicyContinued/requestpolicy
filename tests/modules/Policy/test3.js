
var policy = new Policy();

dprint("== Allow all requests from https://localhost:8888/baz ==");
var host = policy.addHost("localhost");
var r = host.rules.add("https", 8888);
r.path = "/baz";
r.originRuleType = RULE_TYPE_ALLOW;
dprint("=======");


policy.print();


var tests = [];

tests.push({"origin" : "https://localhost:8888/ba",
            "dest" : "https://foo.com/",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://localhost:8888/ba",
            "dest" : "https://localhost:8888/baz",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://localhost/baz",
            "dest" : "https://foo.com/",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://127.0.0.1:8443/baz",
            "dest" : "https://foo.com/",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "http://localhost:8888/baz",
            "dest" : "https://foo.com/",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "http://localhost/baz",
            "dest" : "https://foo.com/",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://localhost:443/baz",
            "dest" : "https://foo.com/",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "http://localhost:80/baz",
            "dest" : "https://foo.com/",
            "allowCount" : 0,
            "denyCount" : 0});

tests.push({"origin" : "https://localhost:8888/baz",
            "dest" : "https://foo.com/",
            "allowCount" : 1,
            "denyCount" : 0});

tests.push({"origin" : "https://localhost:8888/bazbaz",
            "dest" : "https://foo.com/",
            "allowCount" : 1,
            "denyCount" : 0});

runPolicyTests(policy, tests);
