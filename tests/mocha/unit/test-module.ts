"use strict";

import { assert } from "chai";
import { Module } from "lib/classes/module";
import { defer } from "lib/utils/js-utils";
import { Log } from "lib/classes/log";

class TestModule extends Module {
  public dStartupPreconditions = defer();
  protected get startupPreconditions() {
    return [this.dStartupPreconditions.promise];
  }

  public subModulesGetterCalled = false;
  protected get subModules() {
    this.subModulesGetterCalled = true;
    return {};
  }
}

describe("connection", function() {
  it("subModules are not fetched before startupPreconditions have finished", function() {
    const m = new TestModule("test", new Log());
    assert.isNotOk(m.subModulesGetterCalled);
    m.startup();
    assert.isNotOk(m.subModulesGetterCalled);
    m.dStartupPreconditions.resolve(undefined);
    return m.whenReady.then(() => {
      assert.isOk(m.subModulesGetterCalled);
    });
  });
});
