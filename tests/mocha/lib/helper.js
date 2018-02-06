const {assert} = require("chai");
const sinon = require("sinon").sandbox.create();

beforeEach(function() {
  sinon.stub(console, "error");
});

afterEach(function() {
  // FIXME: Something like `this.test.error(err)` would be better, see
  // https://github.com/mochajs/mocha/pull/1944
  if ("getCalls" in console.error) {
    assert.deepEqual(console.error.getCalls().map((call) => call.args), [],
        "console.error() shouldn't be called.");
  }
  sinon.restore();
});
