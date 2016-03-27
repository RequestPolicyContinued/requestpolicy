/* exported run_test */
Components.utils.import("chrome://rpcontinued/content/lib/utils/rules.jsm");

function run_test() {
  run_next_test();
}

// endpointSpecToDisplayString
add_test(function() {
  function test(endpointSpec, expectedString) {
    strictEqual(expectedString,
        RuleUtils.endpointSpecToDisplayString(endpointSpec));
  }

  let invalid = "[invalid endpoint specification]";

  // About the display-strings where the host is `undefined`, `null` or "":
  // Do not use `http:*` as a display-string! It could be confused
  // with `*://http:*`, with "http" being the hostname.
  // The string `http://*` wouldn't be correct for all cases, since there are
  // URIs _without_ a host.

  test({                                         }, "");
  test({                                 port: 80}, "*://*:80");
  test({           h: "www.example.com"          }, "www.example.com");
  test({           h: "www.example.com", port: 80}, "*://www.example.com:80");
  test({           h: null                       }, "*:<path> (no host)");
  test({           h: null,              port: 80}, invalid);
  test({           h: ""                         }, "*://<path> (empty host)");
  test({           h: "",                port: 80}, invalid);
  test({s: "http"                                }, "http:<path> (host optional)");
  test({s: "http",                       port: 80}, "http://*:80");
  test({s: "http", h: "www.example.com"          }, "http://www.example.com");
  test({s: "http", h: "www.example.com", port: 80}, "http://www.example.com:80");
  test({s: "http", h: null                       }, "http:<path> (no host)");
  test({s: "http", h: null,              port: 80}, invalid);
  test({s: "http", h: ""                         }, "http://<path> (empty host)");
  test({s: "http", h: "",                port: 80}, invalid);

  run_next_test();
});
