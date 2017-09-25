const {assert} = require("chai");
const sinon = require("sinon");

const {Logger} = require("content/lib/classes/logger");
const {C} = require("content/lib/utils/constants");

describe("Logger", () => {
  describe("basic functions, all levels", () => {
    let spiedFn = null;

    function _it(fnName) {
      it(fnName, () => {
        sinon.stub(console, fnName);
        spiedFn = console[fnName];

        const logger = new Logger({enabled: true, level: "all"});
        logger[fnName]("test");

        const expectedArgs = [
          C.LOG_PREFIX + "test",
        ];
        assert(spiedFn.calledOnce,
            `console.${fnName} called once`);
        assert.deepEqual(
            spiedFn.getCall(0).args,
            expectedArgs,
            `console.${fnName} called with "${expectedArgs[0]}"`);
      });
    }

    _it("log");
    _it("info");
    _it("warn");
    _it("error");

    afterEach(() => {
      spiedFn.restore();
    });
  });

  describe("extended logger", () => {
    let spiedFn = null;

    function _it(fnName) {
      it(fnName, () => {
        sinon.stub(console, fnName);
        spiedFn = console[fnName];

        const baseLogger = new Logger();
        const extendedLogger = baseLogger.extend({
          enabled: true,
          level: "all",
          name: "testname",
        });
        extendedLogger[fnName]("test");

        const expectedArgs = [
          C.LOG_PREFIX + "[testname] test",
        ];
        assert(spiedFn.calledOnce,
            `console.${fnName} called once`);
        assert.deepEqual(
            spiedFn.getCall(0).args,
            expectedArgs,
            `console.${fnName} called with "${expectedArgs[0]}"`);
      });
    }

    _it("log");
    _it("info");
    _it("warn");
    _it("error");

    afterEach(() => {
      spiedFn.restore();
    });
  });

  describe("default level", () => {
    let spiedFn = null;

    function _it(fnName, {isCalled}) {
      it(fnName, () => {
        sinon.stub(console, fnName);
        spiedFn = console[fnName];

        const logger = new Logger({enabled: true});
        logger[fnName]("test");

        const expectedCallCount = isCalled ? 1 : 0;

        assert.equal(spiedFn.callCount, expectedCallCount,
          `console.${fnName} ${isCalled ? "called once" : "not called"}`);
        if (isCalled) {
          const expectedArgs = [
            C.LOG_PREFIX + "test",
          ];
          assert.deepEqual(
              spiedFn.getCall(0).args,
              expectedArgs,
              `console.${fnName} called with "${expectedArgs[0]}"`);
        }
      });
    }

    _it("log", {callCount: false});
    _it("info", {isCalled: false});
    _it("warn", {isCalled: false});
    _it("error", {isCalled: true});

    afterEach(() => {
      spiedFn.restore();
    });
  });
});
