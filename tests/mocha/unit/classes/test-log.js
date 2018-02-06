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

const {assert} = require("chai");

const {Log} = require("content/models/log");
const {C} = require("content/data/constants");

describe("Log", () => {
  const sinon = require("sinon").sandbox.create();
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

    _it("log", {callCount: false});
    _it("info", {isCalled: false});
    _it("warn", {isCalled: false});
    _it("error", {isCalled: true});
  });
});
