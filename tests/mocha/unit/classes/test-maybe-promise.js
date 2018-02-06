"use strict";

const {assert} = require("chai");

const {MaybePromise} = require("content/lib/classes/maybe-promise");

function genPromise({isFulfilled, value = {}}) {
  return isFulfilled ? Promise.resolve(value) : Promise.reject(value);
}

function genMaybePromise({isFulfilled, isPromiseWrapper, value = {}}) {
  const mpArg = isPromiseWrapper ? genPromise({isFulfilled, value}) : value;
  const mpFnName = isPromiseWrapper || isFulfilled ? "resolve" : "reject";
  return MaybePromise[mpFnName](mpArg);
}

function callDescribeOrIt(aDescribeOrIt, aDescription, aFn, aArgs) {
  aDescribeOrIt(aDescription, function() {
    // eslint-disable-next-line no-invalid-this
    aFn.apply(this, aArgs);
  });
}

function callForFakeAndRealPromise(aDescribeOrIt, aFn, aDescriptionPrefix = "") {
  [
    ["fake promise", {isPromiseWrapper: false}],
    ["real promise", {isPromiseWrapper: true}],
  ].forEach(([aDescription, ...aFnArgs]) => {
    callDescribeOrIt(aDescribeOrIt, aDescriptionPrefix + aDescription, aFn, aFnArgs);
  });
}

function callForFulfilledAndRejected(aDescribeOrIt, aFn, aDescriptionPrefix = "") {
  [
    ["fulfilled MaybePromise", {isFulfilled: true}],
    ["rejected MaybePromise", {isFulfilled: false}],
  ].forEach(([aDescription, ...aFnArgs]) => {
    callDescribeOrIt(aDescribeOrIt, aDescriptionPrefix + aDescription, aFn, aFnArgs);
  });
}

// eslint-disable-next-line camelcase
function callFor_fulfilledAndRejected_fakeAndRealPromise(aDescribe, aFn, aDescriptionPrefix = "") {
  callForFulfilledAndRejected(aDescribe, function({isFulfilled}) {
    callForFakeAndRealPromise(describe, function({isPromiseWrapper}) {
      // eslint-disable-next-line no-invalid-this
      aFn.call(this, {isPromiseWrapper, isFulfilled});
    }, aDescriptionPrefix);
  }, aDescriptionPrefix);
}

describe("MaybePromise", () => {
  describe("isFulfilled(), isRejected(), isPromiseWrapper()", function() {
    callFor_fulfilledAndRejected_fakeAndRealPromise(describe, function({
      isFulfilled, isPromiseWrapper,
    }) {
      it("test", function() {
        const mp = genMaybePromise({isFulfilled, isPromiseWrapper});
        assert.strictEqual(mp.isPromiseWrapper(), isPromiseWrapper);
        if (isPromiseWrapper) {
          assert.throws(() => mp.isFulfilled());
          assert.throws(() => mp.isRejected());
        } else {
          assert.strictEqual(mp.isFulfilled(), isFulfilled);
          assert.strictEqual(mp.isRejected(), !isFulfilled);
        }
        return mp.catch(() => {}).toPromise();
      });
    });
  });

  describe("toPromise() returns a Promise", function() {
    callFor_fulfilledAndRejected_fakeAndRealPromise(describe, function({
      isFulfilled, isPromiseWrapper,
    }) {
      it("test", function() {
        const mp = genMaybePromise({isFulfilled, isPromiseWrapper});
        const p = mp.toPromise();
        assert.notInstanceOf(p, MaybePromise);
        assert.instanceOf(p, Promise);
        return p.then((aValue) => {
          if (!isFulfilled) assert.fail(1, 0, `then-function called: ${aValue}`);
          return;
        }, (aError) => {
          if (isFulfilled) assert.fail(1, 0, `catch-fn called: ${aError}`);
        });
      });
    });
  });

  describe("then(), catch()", function() {
    describe("then-fn/catch-fn is called (or not)", function() {
      callFor_fulfilledAndRejected_fakeAndRealPromise(describe, function({
        isFulfilled, isPromiseWrapper,
      }) {
        it("test", function() {
          let thenFnCalled = false;
          let catchFnCalled = false;
          return genMaybePromise({isFulfilled, isPromiseWrapper}).
              then(() => {
                thenFnCalled = true;
                return;
              }, () => {
                catchFnCalled = true;
                return;
              }).
              then(() => {
                assert.strictEqual(thenFnCalled, isFulfilled);
                assert.strictEqual(catchFnCalled, !isFulfilled);
                return;
              }).
              toPromise();
        });
      });
    });

    describe("then-fn/catch-fn is passed a value", function() {
      callFor_fulfilledAndRejected_fakeAndRealPromise(describe, function({
        isFulfilled, isPromiseWrapper,
      }) {
        it("test", function() {
          const value = {};
          const assertArgument = (aValue) => {
            assert.strictEqual(aValue, value);
          };
          return genMaybePromise({isFulfilled, isPromiseWrapper, value}).
              then(assertArgument, assertArgument).
              toPromise();
        });
      });
    });

    describe("then-fn/catch-fn may return a Promise", function() {
      callFor_fulfilledAndRejected_fakeAndRealPromise(describe, function({
        isFulfilled: originalMPIsFulfilled,
        isPromiseWrapper: originalMPIsPromiseWrapper,
      }) {
        callForFulfilledAndRejected(describe, function({
          isFulfilled: returnedPromiseIsFulfilled,
        }) {
          it("test", function() {
            const value = {};
            const returnPromise = () => genPromise({
              isFulfilled: returnedPromiseIsFulfilled,
              value,
            });
            const mp = genMaybePromise({
              isFulfilled: originalMPIsFulfilled,
              isPromiseWrapper: originalMPIsPromiseWrapper,
            }).then(returnPromise, returnPromise);

            assert.isTrue(mp.isPromiseWrapper());
            return mp.catch((v) => v).then((aValue) => {
              assert.strictEqual(aValue, value);
              return;
            }).toPromise();
          });
        }, "returned Promise: ");
      });
    });

    describe("then-fn/catch-fn may return a MaybePromise", function() {
      callFor_fulfilledAndRejected_fakeAndRealPromise(describe, function({
        isFulfilled: originalMPIsFulfilled,
        isPromiseWrapper: originalMPIsPromiseWrapper,
      }) {
        callFor_fulfilledAndRejected_fakeAndRealPromise(describe, function({
          isFulfilled: returnedMaybePromiseIsFulfilled,
          isPromiseWrapper: returnedMaybePromiseIsPromiseWrapper,
        }) {
          it("test", function() {
            const value = {};
            const toBeReturnedMaybePromise = genMaybePromise({
              isFulfilled: returnedMaybePromiseIsFulfilled,
              isPromiseWrapper: returnedMaybePromiseIsPromiseWrapper,
              value,
            });
            const returnMaybePromise = () => toBeReturnedMaybePromise;
            const mp = genMaybePromise({
              isFulfilled: originalMPIsFulfilled,
              isPromiseWrapper: originalMPIsPromiseWrapper,
            }).then(returnMaybePromise, returnMaybePromise);

            return mp.catch((v) => v).then((aValue) => {
              assert.strictEqual(aValue, value);
              return;
            }).toPromise();
          });
        }, "returned MaybePromise: ");
      });
    });

    describe("errors thrown from then-fn/catch-fn cause the MaybePromise " +
        "to be rejected", function() {
      callFor_fulfilledAndRejected_fakeAndRealPromise(describe, function({
        isFulfilled, isPromiseWrapper,
      }) {
        it("test", function() {
          const error = new Error("foo");
          const throwError = () => {
            throw error;
          };
          return genMaybePromise({isFulfilled, isPromiseWrapper}).
              then(throwError, throwError).
              catch((aError) => {
                assert.strictEqual(aError, error);
              }).
              toPromise();
        });
      });
    });
  });
});
