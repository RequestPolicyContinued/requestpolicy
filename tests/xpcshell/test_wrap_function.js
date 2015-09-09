const MODULE_URI = "chrome://rpcontinued/content/lib/utils.jsm";

var functionCalls = "";

var testObj = {
  testProp: "foo",
  testFunction: wrappedFunction
};

var mod = {};

Cu.import(MODULE_URI, mod);


function run_test() {

  // 1: Basic check.
  uut_wrap(wrapperFunction1, wrapperFunction2);
  callAndCheck("_1_0_2");

  // 2: Wrap "manually" so that RequestPolicy's wrapper function isn't the
  //    outermost anymore.
  manualWrap();
  callAndCheck("{_1_0_2}");

  // 3: Check that a second call to the uut_wrap function overwrites the
  //    old 'before' and 'after' functions. It should not wrap again.
  uut_wrap(wrapperFunction2, wrapperFunction1);
  callAndCheck("{_2_0_1}");

  // 4: Check that thrown errors are catched.
  // At first check that function 3 throws.
  Assert.throws(() => wrapperFunction3("foo", "bar"));
  uut_wrap(wrapperFunction3, wrapperFunction3);
  callAndCheck("{_3_0_3}");

  // 5: Check that 'before' and 'after' function can be `null` and `undefined`.
  uut_wrap(null, null);
  callAndCheck("{_0}");
  uut_wrap(undefined, undefined);
  callAndCheck("{_0}");

  // 6: Test the `unwrap` function.
  uut_unwrap();
  callAndCheck("{_0}");

  // 7: Check that the wrapped function works after unloading. Unloading
  //    is what is done when the addon gets shutdown, e.g. when disabled
  //    or being updated.
  Cu.unload(MODULE_URI);
  mod = {};
  callAndCheck("{_0}");

  // 8: Again importing the Module should work without again wrapping the
  //    outermost function. Reason: disable-enabling and update actions
  //    should not increase the number of wrapper functions.
  Cu.import(MODULE_URI, mod);
  // Note: Using `wrapperFunction3()` did not work. Since wrapperFunction3
  //       throws an error, the `Logger` is invoked. The error was:
  //           "Logger is undefined at […]/utils.jsm"
  //       I suppose the problem is that `Logger` and the other
  //       modules required by `utils.jsm` haven't been unloaded.
  //uut_wrap(wrapperFunction1, wrapperFunction3);
  //callAndCheck("{_1_0_3}");
  uut_wrap(wrapperFunction1, wrapperFunction2);
  callAndCheck("{_1_0_2}");
}

function uut_wrap(f1, f2) {
  mod.Utils.wrapFunction(testObj, "testFunction", f1, f2);
}

function uut_unwrap() {
  mod.Utils.unwrapFunction(testObj, "testFunction");
}

/**
 * Wraps `testObj.testFunction()` in order to test scenarios where
 * multiple addons are wrapping the same function.
 */
function manualWrap() {
  var _orig = testObj.testFunction;

  testObj.testFunction = function () {
    functionCalls += "{";
    var rv = _orig.apply(testObj, arguments);
    functionCalls += "}";
    return rv;
  };
}

function callAndCheck(expectedFunctionCalls) {
  // reset the function calls
  functionCalls = "";

  // call the function, remember the return value
  var rv = testObj.testFunction("foo", "bar");

  // do checks
  do_check_eq(rv, "baz");
  do_check_eq(functionCalls, expectedFunctionCalls);
}

function wrappedFunction(param1, param2) {
  functionCalls += "_0";

  // check that "this" is correctly set
  do_check_true(this.testProp === "foo");

  // check that the parameters have been passed correctly
  do_check_true(param1 === "foo");
  do_check_true(param2 === "bar");

  return "baz";
}

function wrapperFunction1(param1, param2) {
  functionCalls += "_1";

  // check that the parameters have been passed correctly
  do_check_true(param1 === "foo");
  do_check_true(param2 === "bar");
}

function wrapperFunction2(param1, param2) {
  functionCalls += "_2";

  // check that the parameters have been passed correctly
  do_check_true(param1 === "foo");
  do_check_true(param2 === "bar");
}

function wrapperFunction3(param1, param2) {
  functionCalls += "_3";

  // check that the parameters have been passed correctly
  do_check_true(param1 === "foo");
  do_check_true(param2 === "bar");

  // test that errors are catched
  throw "test error";
}
