Cu.import("chrome://rpcontinued/content/lib/utils/javascript.jsm");

function run_test() {
  "use strict";

  test_arrayIncludes();
}

function test_arrayIncludes() {
  "use strict";

  let {arrayIncludes} = JSUtils;

  strictEqual(true, arrayIncludes(["a", "b"], "a"));
  strictEqual(true, arrayIncludes(["a", "b"], "b"));
  strictEqual(false, arrayIncludes(["a", "b"], "c"));

  strictEqual(true, arrayIncludes([0], 0));
  strictEqual(false, arrayIncludes([0], "0"));
}
