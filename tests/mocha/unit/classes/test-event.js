"use strict";

const {assert} = require("chai");

const {Event} = require("content/lib/classes/event");
const {C} = require("content/data/constants");

describe("Event", () => {
  const sinon = require("sinon").sandbox.create();
  afterEach(() => sinon.restore());

  describe("emit()", () => {
    function _it(aDescription, {
      rvSpecs: aRVSpecs,
      withPromises: aWithPromises,
    }) {
      it(aDescription, function() {
        const event = new Event();
        const expectedRVs = [];
        aRVSpecs.forEach((rvSpec) => {
          if (!("value" in rvSpec)) {
            event.addListener(() => {});
            return;
          }
          const {value} = rvSpec;
          expectedRVs.push(value);
          const rv = rvSpec.promise ? Promise.resolve(value) : value;
          event.addListener(() => rv);
        });

        const emitRV = event.emit();
        const checkReturnValues = (returnValues) => {
          assert.sameDeepMembers(returnValues, expectedRVs);
        };
        if (aWithPromises) return emitRV.then(checkReturnValues);
        checkReturnValues(emitRV);
      });
    }

    _it("works with no listeners", {
      rvSpecs: [],
      withPromises: false,
    });

    _it("works with listeners returning non-Promise values", {
      rvSpecs: [
        {value: 1},
        {value: 2},
      ],
      withPromises: false,
    });

    _it("works with listeners returning Promises", {
      rvSpecs: [
        {value: 3, promise: true},
        {value: 4, promise: true},
      ],
      withPromises: true,
    });

    _it("works with Promise-returning and non-Promise-returning listeners", {
      rvSpecs: [
        {value: "foo"},
        {value: "bar", promise: true},
        {value: "baz"},
        {value: ";-)", promise: true},
      ],
      withPromises: true,
    });

    _it("works with listeners without return value", {
      rvSpecs: [
        {},
        {},
      ],
      withPromises: false,
    });
  });
});
