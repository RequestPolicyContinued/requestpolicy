"use strict";

let {assert} = require("chai");
let {isTrue, strictEqual} = assert;

let {Utils} = require("lib/utils");

describe("Utils", function() {
  describe("wrapFunction(), unwrapFunction()", function() {
    let functionCalls = "";

    let testObj = {
      testProp: "foo",
      testFunction: wrappedFunction
    };

    it("Basic check", function() {
      uutWrap(wrapperFunction1, wrapperFunction2);
      callAndCheck("_1_0_2");
    });

    it(`Wrap "manually" so that RequestPolicy's wrapper function isn't the ` +
        `outermost anymore.`, function() {
      manualWrap();
      callAndCheck("{_1_0_2}");
    });

    it("Check that a second call to the uut_wrap function overwrites the " +
        "old 'before' and 'after' functions. It should not wrap again.",
        function() {
      uutWrap(wrapperFunction2, wrapperFunction1);
      callAndCheck("{_2_0_1}");
    });

    it("Check that thrown errors are catched. " +
        "At first check that function 3 throws.", function() {
      assert.throws(() => wrapperFunction3("foo", "bar"));
      uutWrap(wrapperFunction3, wrapperFunction3);
      callAndCheck("{_3_0_3}");
    });

    it("Check that 'before' and 'after' function can be `null` and `undefined`.",
        function() {
      uutWrap(null, null);
      callAndCheck("{_0}");
      uutWrap(undefined, undefined);
      callAndCheck("{_0}");
    });

    it("unwrap()", function() {
      uutUnwrap();
      callAndCheck("{_0}");
    });

    it("Again calling Utils.wrapFunction() should work without again " +
        "wrapping the outermost function. Reason: disable-enabling and " +
        "update actions should not increase the number of wrapper functions.",
        function() {
      uutWrap(wrapperFunction1, wrapperFunction3);
      callAndCheck("{_1_0_3}");
      uutWrap(wrapperFunction1, wrapperFunction2);
      callAndCheck("{_1_0_2}");
    });

    function errorCallback(aMessage, aError) {
      assert.fail(0, 1, aMessage);
    }

    function uutWrap(f1, f2) {
      Utils.wrapFunction(testObj, "testFunction", errorCallback, f1, f2);
    }

    function uutUnwrap() {
      Utils.unwrapFunction(testObj, "testFunction");
    }

    /**
     * Wraps `testObj.testFunction()` in order to test scenarios where
     * multiple addons are wrapping the same function.
     */
    function manualWrap() {
      const _orig = testObj.testFunction;

      testObj.testFunction = function() {
        functionCalls += "{";
        const rv = _orig.apply(testObj, arguments);
        functionCalls += "}";
        return rv;
      };
    }

    function callAndCheck(expectedFunctionCalls) {
      // reset the function calls
      functionCalls = "";

      // call the function, remember the return value
      const rv = testObj.testFunction("foo", "bar");

      // do checks
      strictEqual(rv, "baz");
      strictEqual(functionCalls, expectedFunctionCalls);
    }

    function wrappedFunction(param1, param2) {
      /* jshint validthis: true */

      functionCalls += "_0";

      // check that "this" is correctly set
      isTrue(this.testProp === "foo");

      // check that the parameters have been passed correctly
      isTrue(param1 === "foo");
      isTrue(param2 === "bar");

      return "baz";
    }

    function wrapperFunction1(param1, param2) {
      functionCalls += "_1";

      // check that the parameters have been passed correctly
      isTrue(param1 === "foo");
      isTrue(param2 === "bar");
    }

    function wrapperFunction2(param1, param2) {
      functionCalls += "_2";

      // check that the parameters have been passed correctly
      isTrue(param1 === "foo");
      isTrue(param2 === "bar");
    }

    function wrapperFunction3(param1, param2) {
      functionCalls += "_3";

      // check that the parameters have been passed correctly
      isTrue(param1 === "foo");
      isTrue(param2 === "bar");

      // test that errors are catched
      throw "test error";
    }
  });
});
