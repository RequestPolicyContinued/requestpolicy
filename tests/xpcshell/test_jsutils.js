Cu.import("chrome://rpcontinued/content/lib/utils/javascript.jsm");

function run_test() {
  "use strict";

  test_arrayIncludes();
  test_leftRotateArray();
  test_range();
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

function test_leftRotateArray() {
  "use strict";

  let {leftRotateArray} = JSUtils;

  deepEqual([1, 2, 3], leftRotateArray([1, 2, 3], 0));
  deepEqual([2, 3, 1], leftRotateArray([1, 2, 3], 1));
  deepEqual([3, 1, 2], leftRotateArray([1, 2, 3], 2));
  deepEqual([1, 2, 3], leftRotateArray([1, 2, 3], 3));
  deepEqual([2, 3, 1], leftRotateArray([1, 2, 3], 4));
}

function test_range() {
  "use strict";

  let {range} = JSUtils;

  deepEqual([], range(0));
  deepEqual([0, 1, 2, 3], range(4));
  deepEqual([0, 1, 2, 3, 4, 5], range(6));
  deepEqual([], range(-1));
}
