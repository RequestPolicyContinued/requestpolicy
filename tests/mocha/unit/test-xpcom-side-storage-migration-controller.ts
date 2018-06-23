"use strict";

import {assert} from "chai";
import deepFreeze = require("deep-freeze");
import mrdescribe = require("mocha-repeat");
import Sinon = require("sinon");
import {createBrowserApi} from "../lib/sinon-chrome";
import {
  getFullStorageDirection,
} from "../lib/storage-migration-utils";
import {destructureOptions} from "../lib/utils";

import {Log} from "lib/classes/log";
import {
  StorageMigrationToWebExtension,
} from "legacy/app/migration/storage-migration-to-we";

function maybeAssignLastStorageChange(aObj, aFullStorage) {
  return Object.assign(aObj, aFullStorage.lastStorageChange ? {
    lastStorageChange: aFullStorage.lastStorageChange,
  } : {});
}

describe("legacy-side settings migration controller", function() {
  const sinon = Sinon.sandbox.create();
  afterEach(() => sinon.restore());

  const browser = createBrowserApi();
  const eweExternalBrowser = createBrowserApi();

  let LegacySideController;

  before(() => {
    assert.notStrictEqual(browser, eweExternalBrowser);
    let assertNotStrictEqual = (name) => {
      assert.notStrictEqual(browser[name], eweExternalBrowser[name]);
    };
    assertNotStrictEqual("runtime");
    assertNotStrictEqual("storage");
    assertNotStrictEqual = (name) => {
      assert.notStrictEqual(browser.runtime[name], eweExternalBrowser.runtime[name]);
    };
    assertNotStrictEqual("onMessage");
    assertNotStrictEqual("sendMessage");
    assertNotStrictEqual = (name) => {
      assert.notStrictEqual(browser.storage[name], eweExternalBrowser.storage[name]);
    };
    assertNotStrictEqual("onChanged");
    assertNotStrictEqual("local");
  });

  beforeEach(() => {
    const log = new Log();
    LegacySideController = new StorageMigrationToWebExtension(
        log,
        browser.storage.local,
        browser.storage.onChanged,
        Promise.resolve(eweExternalBrowser.runtime),
    );
  });

  function restoreAll() {
    browser.flush();
    eweExternalBrowser.flush();
  }

  function createTest(aOptions) {
    const o = destructureOptions([
      ["afterControllerStartedUp", () => {}],
      ["afterReadyMessageSent", () => {}],
      ["onFullStorageMessageSent", () => {}],
      ["afterInitialSync", () => {}],
      ["afterStorageChangesDispatched", () => {}],
      ["stopAfter", "never"],
      ["storageChangeSuccess", true],
      ["legacySideInitialFullStorage", {}],
      ["webextSideInitialFullStorage", {}],
      ["storageChanges", null],
    ], aOptions);

    const afterControllerStartedUp = o("afterControllerStartedUp");
    const afterReadyMessageSent = o("afterReadyMessageSent");
    const onFullStorageMessageSent = o("onFullStorageMessageSent");
    const afterInitialSync = o("afterInitialSync");
    const afterStorageChangesDispatched = o("afterStorageChangesDispatched");
    const stopAfter = o("stopAfter");
    const storageChangeSuccess = o("storageChangeSuccess");
    const legacySideInitialFullStorage = o("legacySideInitialFullStorage");
    const webextSideInitialFullStorage = o("webextSideInitialFullStorage");
    const storageChanges = o("storageChanges");

    const fullStorageDirection = getFullStorageDirection(
        {legacySideInitialFullStorage, webextSideInitialFullStorage}
    );
    const isPush = fullStorageDirection === "push";
    const isPull = !isPush;

    return function() {
      const {runtime: eRuntime} = eweExternalBrowser;
      const {storage} = browser;

      function sendReadyMessage() {
        const value = {ready: true};
        maybeAssignLastStorageChange(value, webextSideInitialFullStorage);
        eRuntime.onMessage.dispatch({
          target: "legacy-side-storage-migration-controller",
          type: "startup",
          value,
        });
      }

      function fullStorageResponse() {
        return Promise.resolve({
          target: "legacy-side-storage-migration-controller",
          type: `${isPull ? "request:" : ""}full-storage:response`,
          value: isPull ? webextSideInitialFullStorage : {success: true},
        });
      }

      function storageChangesResponse() {
        return Promise.resolve({
          target: "legacy-side-storage-migration-controller",
          type: "storage-changes:response",
          value: {success: storageChangeSuccess},
        });
      }

      storage.local.get.withArgs(null).resolves(legacySideInitialFullStorage);
      storage.local.get.withArgs("lastStorageChange").resolves(
          maybeAssignLastStorageChange({}, legacySideInitialFullStorage)
      );
      LegacySideController.startup();
      let p = LegacySideController.pWaitingForEWE.then(() => {
        afterControllerStartedUp({eRuntime, storage});
        return;
      });
      if (stopAfter === "startup") return p;
      p = p.then(() => {
        storage.local.get.resetHistory();
        eRuntime.sendMessage.reset();
        eRuntime.sendMessage.callsFake((...args) => {
          onFullStorageMessageSent({args, eRuntime, storage});
          return fullStorageResponse();
        });
        sendReadyMessage();
        return;
      }).then(() => {
        afterReadyMessageSent({eRuntime, storage});
        return LegacySideController.pInitialSync;
      }).then(() => {
        afterInitialSync({eRuntime, storage});
        return;
      });
      if (!storageChanges) return p;
      p = p.then(() => {
        eRuntime.sendMessage.resolves(storageChangesResponse());
        storage.onChanged.dispatch(storageChanges, "local");
        afterStorageChangesDispatched({eRuntime, storage});
        return;
      });
    };
  }

  it("first add message listener, then send message", createTest({
    stopAfter: "startup",
    afterControllerStartedUp({eRuntime}) {
      sinon.assert.callOrder(
          eRuntime.onMessage.addListener,
          eRuntime.sendMessage
      );
      sinon.assert.calledWithMatch(eRuntime.sendMessage, {
        target: "storage-migration-from-xpcom",
        type: "startup",
        value: "ready",
      });
    },
  }));

  it("send settings when getting 'ready' message", createTest({
    legacySideInitialFullStorage: {
      foo: "bar",
    },
    onFullStorageMessageSent({args: aFullStorageMessageArgs}) {
      assert.deepEqual(aFullStorageMessageArgs, [
        {
          target: "storage-migration-from-xpcom",
          type: "full-storage",
          value: {foo: "bar"},
        },
      ]);
    },
  }));

  function createPushFullStorageTests(it, aOptions) {
    const o = destructureOptions([
      ["legacySideInitialFullStorage"],
      ["webextSideInitialFullStorage"],
    ], aOptions);

    const legacySideInitialFullStorage = o("legacySideInitialFullStorage");
    const webextSideInitialFullStorage = o("webextSideInitialFullStorage");

    it("storage.local.get() is called", createTest({
      legacySideInitialFullStorage,
      webextSideInitialFullStorage,
      afterControllerStartedUp({storage}) {
        sinon.assert.callCount(storage.local.get.withArgs(null), 0);
      },
      afterInitialSync({storage}) {
        sinon.assert.callCount(storage.local.get, 1);
        sinon.assert.calledWithMatch(storage.local.get, null);
      },
    }));
  }

  describe("push full storage to webext side", function() {
    const testOptions = deepFreeze({
      "1": {
        legacySideInitialFullStorage: {},
        webextSideInitialFullStorage: {},
      },
      "2": {
        legacySideInitialFullStorage: {
          lastStorageChange: (new Date()).toISOString(),
        },
        webextSideInitialFullStorage: {},
      },
      "3": {
        legacySideInitialFullStorage: {
          lastStorageChange: (new Date()).toISOString(),
        },
        webextSideInitialFullStorage: {
          lastStorageChange: "2010",
        },
      },
    });

    mrdescribe("test different options", testOptions, function(options) {
      createPushFullStorageTests(it, options);
    });
  });

  function createPullStorageTest(aOptions) {
    const o = destructureOptions([
      ["legacySideInitialFullStorage"],
      ["webextSideInitialFullStorage"],
    ], aOptions);

    const legacySideInitialFullStorage = o("legacySideInitialFullStorage");
    const webextSideInitialFullStorage = o("webextSideInitialFullStorage");

    return createTest({
      legacySideInitialFullStorage,
      webextSideInitialFullStorage,

      afterReadyMessageSent({storage}) {
        sinon.assert.callCount(storage.local.get, 0);
        sinon.assert.callCount(storage.local.set, 0);
      },
      afterInitialSync({storage}) {
        sinon.assert.callCount(storage.local.set, 1);
        sinon.assert.calledWithMatch(storage.local.set, webextSideInitialFullStorage);
      },
    });
  }

  describe("pull full storage from webext side", function() {
    const testOptions = deepFreeze({
      "1": {
        legacySideInitialFullStorage: {},
        webextSideInitialFullStorage: {
          lastStorageChange: (new Date()).toISOString(),
        },
      },
      "2": {
        legacySideInitialFullStorage: {
          lastStorageChange: "2010",
        },
        webextSideInitialFullStorage: {
          lastStorageChange: (new Date()).toISOString(),
        },
      },
    });

    mrdescribe("test different options", testOptions, function(options) {
      it(
          "first add storage listener, then get full storage",
          createPullStorageTest(options)
      );
    });
  });

  function createStorageChangesTest(aOptions) {
    const o = destructureOptions([
      ["legacySideInitialFullStorage"],
      ["storageChanges"],
      ["success", true],
    ], aOptions);

    const legacySideInitialFullStorage = o("legacySideInitialFullStorage");
    const storageChanges = o("storageChanges");
    const success = o("success");

    return createTest({
      legacySideInitialFullStorage,
      storageChanges,
      storageChangeSuccess: success,
      afterStorageChangesDispatched({eRuntime}) {
        sinon.assert.calledWithMatch(eRuntime.sendMessage, {
          target: "storage-migration-from-xpcom",
          type: "storage-changes",
          value: storageChanges,
        });

        const errorFn = console.error as typeof console.error & Sinon.SinonStub;
        sinon.assert.callCount(errorFn, success ? 0 : 1);
        if (!success) {
          assert.strictEqual(
              errorFn.getCall(0).args[0].startsWith("[RequestPolicy]"),
              true, "An RP error has been logged"
          );
        }
      },
    });
  }

  it("send storage changes", createStorageChangesTest({
    legacySideInitialFullStorage: {
      foo: "bar",
    },
    storageChanges: {
      bar: {newValue: "baz"},
    },
  }));

  it("send the storage changes (including deletion)", createStorageChangesTest({
    legacySideInitialFullStorage: {
      foo: "bar",
    },
    storageChanges: {
      foo: {},
      baz: {newValue: ["foo"]},
    },
  }));

  afterEach(restoreAll);
});
