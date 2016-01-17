/* exported run_test */
Cu.import("chrome://rpcontinued/content/lib/utils/xul.jsm");

function run_test() {
  "use strict";

  test_getKeyAttributesFromCombo();
}

function test_getKeyAttributesFromCombo() {
  "use strict";

  function testSuccess(combo, expectedModifiers, expectedKey) {
    let rv = XULUtils.keyboardShortcuts.getKeyAttributesFromCombo(combo);
    strictEqual(true, rv.success);
    strictEqual(expectedModifiers, rv.modifiers);
    strictEqual(expectedKey, rv.key);
  }

  function testFailure(combo) {
    let rv = XULUtils.keyboardShortcuts.getKeyAttributesFromCombo(combo);
    strictEqual(false, rv.success);
    strictEqual("string", typeof rv.errorMessage);
  }

  testSuccess("shift a", "shift", "a");
  testSuccess("alt b", "alt", "b");
  testSuccess("meta c", "meta", "c");
  testSuccess("control d", "control", "d");
  testSuccess("accel e", "accel", "e");

  // multiple modifiers
  testSuccess("alt shift f", "alt shift", "f");
  testSuccess("control alt g", "control alt", "g");
  testSuccess("control alt shift h", "control alt shift", "h");

  // no modifier
  testSuccess("r", "", "r");

  // Disallow these modifiers. They are allowed for <key> but
  // not allowed in the SDK Hotkeys API.
  testFailure("os r");
  testFailure("access r");
  testFailure("any r");

  // redundant modifier
  testSuccess("alt alt r", "alt", "r");
  testSuccess("alt shift alt r", "alt shift", "r");

  // invalid modifiers
  testFailure("ctrl r");
  testFailure("foobar r");

  // No key
  testFailure("alt");
  testFailure("control shift");
  // invalid key
  testFailure("alt _");
  testFailure("alt 0");
  testFailure("alt rr");

  // empty string
  testFailure("");
  // invalid separator
  testFailure("alt,x");
  testFailure("alt-y");
}
