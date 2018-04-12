import { SinonStub } from "sinon";

import {assert} from "chai";
import * as Sinon from "sinon";
const sinon = Sinon.sandbox.create();

beforeEach(function() {
  sinon.spy(console, "error");
});

afterEach(function() {
  // FIXME: Something like `this.test.error(err)` would be better, see
  // https://github.com/mochajs/mocha/pull/1944
  if ("getCalls" in console.error) {
    assert.deepEqual(
        (console.error as SinonStub).getCalls().map((call) => call.args),
        [],
        "console.error() shouldn't be called.",
    );
  }
  sinon.restore();
});
