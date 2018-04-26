/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */

"use strict";

import {assert} from "chai";

import {C} from "data/constants";
import {Log, LogLevel} from "lib/classes/log";
import { defer } from "lib/utils/js-utils";
import * as Sinon from "sinon";

describe("Log", () => {
  const sinon = Sinon.sandbox.create();
  afterEach(() => sinon.restore());

  function stubConsoleFn(aFnName) {
    if (typeof console[aFnName].restore === "function") {
      console[aFnName].restore();
    }
    sinon.stub(console, aFnName);
  }

  describe("basic functions, all levels", () => {
    function _it(fnName) {
      it(fnName, () => {
        stubConsoleFn(fnName);
        const spiedFn = console[fnName];

        const log = new Log({enabled: true, level: "all"});
        log[fnName]("test");

        const expectedArgs = [
          `${C.LOG_PREFIX}test`,
        ];
        assert.strictEqual(spiedFn.callCount, 1,
            `console.${fnName} called once`);
        assert.deepEqual(
            spiedFn.getCall(0).args,
            expectedArgs,
            `console.${fnName} called with "${expectedArgs[0]}"`
        );
      });
    }

    _it("log");
    _it("info");
    _it("warn");
    _it("error");
  });

  describe("extended Log", () => {
    function _it(fnName) {
      it(fnName, () => {
        stubConsoleFn(fnName);
        const spiedFn = console[fnName];

        const baseLogger = new Log();
        const extendedLogger = baseLogger.extend({
          enabled: true,
          level: "all",
          name: "testname",
        });
        extendedLogger[fnName]("test");

        const expectedArgs = [
          `${C.LOG_PREFIX}[testname] test`,
        ];
        assert(spiedFn.calledOnce,
            `console.${fnName} called once`);
        assert.deepEqual(
            spiedFn.getCall(0).args,
            expectedArgs,
            `console.${fnName} called with "${expectedArgs[0]}"`
        );
      });
    }

    _it("log");
    _it("info");
    _it("warn");
    _it("error");
  });

  describe("default level", () => {
    function _it(fnName, {isCalled}) {
      it(fnName, () => {
        stubConsoleFn(fnName);
        const spiedFn = console[fnName];

        const log = new Log({enabled: true});
        log[fnName]("test");

        const expectedCallCount = isCalled ? 1 : 0;

        assert.equal(
            spiedFn.callCount, expectedCallCount,
            `console.${fnName} ${isCalled ? "called once" : "not called"}`
        );
        if (isCalled) {
          const expectedArgs = [
            `${C.LOG_PREFIX}test`,
          ];
          assert.deepEqual(
              spiedFn.getCall(0).args,
              expectedArgs,
              `console.${fnName} called with "${expectedArgs[0]}"`
          );
        }
      });
    }

    _it("log", {isCalled: false});
    _it("info", {isCalled: false});
    _it("warn", {isCalled: false});
    _it("error", {isCalled: true});
  });

  describe("delayed", () => {
    describe("severities", function() {
      function test_severity(fnName) {
        describe(fnName, function() {
          it("does not log before promise is resolved", function() {
            // setup
            stubConsoleFn(fnName);
            const spiedFn = console[fnName] as Sinon.SinonSpy;
            const dEnabled = defer<boolean>();
            const log = new Log({enabled: dEnabled.promise, level: "all"});

            // exercise
            log[fnName]("test");

            // verify
            sinon.assert.notCalled(spiedFn);

            // cleanup
            dEnabled.resolve(false);
          });

          it("does log after promise is resolved w/ true", async function() {
            // setup
            stubConsoleFn(fnName);
            const spiedFn = console[fnName] as Sinon.SinonSpy;
            const dEnabled = defer<boolean>();
            const log = new Log({enabled: dEnabled.promise, level: "all"});

            // exercise
            log[fnName]("test");
            dEnabled.resolve(true);
            await Promise.resolve();

            // verify
            sinon.assert.calledOnce(spiedFn);
            sinon.assert.calledWithExactly(spiedFn, `${C.LOG_PREFIX}[DELAYED] test`);
          });

          if (fnName !== "error") {
            it("does not log if promise is resolved w/ false", async function() {
              // setup
              stubConsoleFn(fnName);
              const spiedFn = console[fnName] as Sinon.SinonSpy;
              const dEnabled = defer<boolean>();
              const log = new Log({enabled: dEnabled.promise, level: "all"});

              // exercise
              log[fnName]("test");
              dEnabled.resolve(false);
              await Promise.resolve();

              // verify
              sinon.assert.notCalled(spiedFn);
            });
          }

          it("should dir() with the correct arguments", async function() {
            // setup
            stubConsoleFn(fnName);
            stubConsoleFn("dir");
            const spiedConsoleDir = console.dir as Sinon.SinonSpy & typeof console.dir;
            const dEnabled = defer<boolean>();
            const log = new Log({enabled: dEnabled.promise, level: "all"});

            // exercise
            log[fnName]("foo", "bar");
            dEnabled.resolve(true);
            await Promise.resolve();

            // verify
            sinon.assert.calledOnce(spiedConsoleDir);
            sinon.assert.calledWithExactly(spiedConsoleDir, "bar");
          });

          if (fnName !== "error") {
            it("allows multiple promises", async function() {
              // setup
              stubConsoleFn(fnName);
              const spiedFn = console[fnName] as Sinon.SinonSpy;
              const dEnabled1 = defer<boolean>();
              const dEnabled2 = defer<boolean>();
              const dEnabled3 = defer<boolean>();
              const log = new Log({enabled: false, level: "all"});

              // exercise (1)
              log.setEnabled(dEnabled1.promise)
              log[fnName]("1");
              log.setEnabled(dEnabled2.promise)
              log[fnName]("2");
              log.setEnabled(dEnabled3.promise)
              log[fnName]("3");

              // verify (1)
              sinon.assert.notCalled(spiedFn);

              // exercise (2)
              dEnabled1.resolve(true);
              dEnabled2.resolve(false);
              dEnabled3.resolve(true);
              await Promise.resolve();

              // verify (2)
              sinon.assert.calledTwice(spiedFn);
              sinon.assert.calledWithExactly(spiedFn, `${C.LOG_PREFIX}[DELAYED] 1`);
              sinon.assert.calledWithExactly(spiedFn, `${C.LOG_PREFIX}[DELAYED] 3`);
            });
          }
        });
      }

      test_severity("log");
      test_severity("info");
      test_severity("warn");
      test_severity("error");
    });

    describe("levels", function() {
      function test_level(levelName, level) {
        describe(levelName, function() {
          it("always logs errors, even with multiple promises", async function() {
            // setup
            stubConsoleFn("error");
            const spiedFn = console.error as Sinon.SinonSpy & typeof console.error;
            const dEnabled1 = defer<boolean>();
            const dEnabled2 = defer<boolean>();
            const dEnabled3 = defer<boolean>();
            const log = new Log({enabled: false, level});

            // exercise (1)
            log.setEnabled(dEnabled1.promise)
            log.error("1");
            log.setEnabled(dEnabled2.promise)
            log.error("2");
            log.setEnabled(dEnabled3.promise)
            log.error("3");

            // verify (1)
            sinon.assert.notCalled(spiedFn);

            // exercise (2)
            dEnabled1.resolve(false);
            dEnabled2.resolve(true);
            dEnabled3.resolve(false);
            await Promise.resolve();

            // verify (2)
            sinon.assert.calledThrice(spiedFn);
            sinon.assert.calledWithExactly(spiedFn, `${C.LOG_PREFIX}[DELAYED] 1`);
            sinon.assert.calledWithExactly(spiedFn, `${C.LOG_PREFIX}[DELAYED] 2`);
            sinon.assert.calledWithExactly(spiedFn, `${C.LOG_PREFIX}[DELAYED] 3`);
          });
        });
      }

      test_level("OFF", LogLevel.OFF);
      test_level("ERROR", LogLevel.ERROR);
      test_level("WARNING", LogLevel.WARNING);
      test_level("INFO", LogLevel.INFO);
      test_level("DEBUG", LogLevel.DEBUG);
      test_level("ALL", LogLevel.ALL);
    });

    it("works with extended logs", async function() {
      // setup
      stubConsoleFn("info");
      const spiedFn = console.info as Sinon.SinonSpy & typeof console.info;
      const dEnabled = defer<boolean>();
      const mainLog = new Log({enabled: false, level: "all"});
      mainLog.setEnabled(dEnabled.promise);
      const log = mainLog.extend({});

      // exercise
      mainLog.info("mainLog");
      log.info("log");
      dEnabled.resolve(true);
      await Promise.resolve();

      // verify (2)
      sinon.assert.calledTwice(spiedFn);
      sinon.assert.calledWithExactly(spiedFn, `${C.LOG_PREFIX}[DELAYED] mainLog`);
      sinon.assert.calledWithExactly(spiedFn, `${C.LOG_PREFIX}[DELAYED] log`);
    });
  });
});
