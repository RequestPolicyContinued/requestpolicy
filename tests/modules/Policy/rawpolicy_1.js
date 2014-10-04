

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

var jsonData = JSON.stringify(exampleRawDataObj);
tprint("typeof jsonData: " + typeof jsonData);
tprint(jsonData);

var raw1 = new RawRuleset(jsonData);
tprint(raw1);

tprint("");

var jsonData2 = JSON.stringify(raw1);
tprint("typeof jsonData2: " + typeof jsonData2);
tprint(jsonData2);

var raw2 = new RawRuleset(jsonData2);
tprint(raw2);
