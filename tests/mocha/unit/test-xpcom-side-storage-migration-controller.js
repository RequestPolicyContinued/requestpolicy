"use strict";

const {assert} = require("chai");
const deepFreeze = require("deep-freeze");
const mrdescribe = require("mocha-repeat");
const {createBrowserApi} = require("../lib/sinon-chrome");
const {
  getFullStorageDirection,
} = require("../lib/settings-migration-utils");
const {destructureOptions} = require("../lib/utils");

const {Log} = require("lib/classes/log");
const {StorageMigrationToWebExtension} = require(
    "legacy/app/migration/storage-migration-to-we"
);

function maybeAssignLastStorageChange(aObj, aFullStorage) {
  return Object.assign(aObj, aFullStorage.lastStorageChange ? {
    lastStorageChange: aFullStorage.lastStorageChange,
  } : {});
}

describe("legacy-side settings migration controller", function() {
  const sinon = require("sinon").sandbox.create();
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

    global._pEmbeddedWebExtension = Promise.resolve({
      browser: eweExternalBrowser,
    });
    global.browser = browser;
  });

  beforeEach(() => {
    eweExternalBrowser.runtime.whenReady = () => Promise.resolve(); // FIXME
    const log = new Log();
    LegacySideController = new StorageMigrationToWebExtension(
        log, browser.storage, eweExternalBrowser.runtime
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
      ["afterStorageChangeDispatched", () => {}],
      ["stopAfter", "never"],
      ["storageChangeSuccess", true],
      ["legacySideInitialFullStorage", {}],
      ["webextSideInitialFullStorage", {}],
      ["storageChange", null],
    ], aOptions);

    const afterControllerStartedUp = o("afterControllerStartedUp");
    const afterReadyMessageSent = o("afterReadyMessageSent");
    const onFullStorageMessageSent = o("onFullStorageMessageSent");
    const afterInitialSync = o("afterInitialSync");
    const afterStorageChangeDispatched = o("afterStorageChangeDispatched");
    const stopAfter = o("stopAfter");
    const storageChangeSuccess = o("storageChangeSuccess");
    const legacySideInitialFullStorage = o("legacySideInitialFullStorage");
    const webextSideInitialFullStorage = o("webextSideInitialFullStorage");
    const storageChange = o("storageChange");

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
          target: "legacy-side-settings-migration-controller",
          type: "startup",
          value,
        });
      }

      function fullStorageResponse() {
        return Promise.resolve({
          target: "legacy-side-settings-migration-controller",
          type: `${isPull ? "request:" : ""}full-storage:response`,
          value: isPull ? webextSideInitialFullStorage : {success: true},
        });
      }

      function storageChangeResponse() {
        return Promise.resolve({
          target: "legacy-side-settings-migration-controller",
          type: "storage-change:response",
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
      if (!storageChange) return p;
      p = p.then(() => {
        eRuntime.sendMessage.resolves(storageChangeResponse());
        storage.onChanged.dispatch(storageChange, "local");
        afterStorageChangeDispatched({eRuntime, storage});
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

  function createStorageChangeTest(aOptions) {
    const o = destructureOptions([
      ["legacySideInitialFullStorage"],
      ["storageChange"],
      ["success", true],
    ], aOptions);

    const legacySideInitialFullStorage = o("legacySideInitialFullStorage");
    const storageChange = o("storageChange");
    const success = o("success");

    return createTest({
      legacySideInitialFullStorage,
      storageChange,
      storageChangeSuccess: success,
      afterStorageChangeDispatched({eRuntime}) {
        sinon.assert.calledWithMatch(eRuntime.sendMessage, {
          target: "storage-migration-from-xpcom",
          type: "storage-change",
          value: storageChange,
        });

        sinon.assert.callCount(console.error, success ? 0 : 1);
        if (!success) {
          assert.strictEqual(
              console.error.getCall(0).args[0].startsWith("[RequestPolicy]"),
              true, "An RP error has been logged"
          );
        }
      },
    });
  }

  it("send storage change", createStorageChangeTest({
    legacySideInitialFullStorage: {
      foo: "bar",
    },
    storageChange: {
      bar: {newValue: "baz"},
    },
  }));

  it("send the storage change (including deletion)", createStorageChangeTest({
    legacySideInitialFullStorage: {
      foo: "bar",
    },
    storageChange: {
      foo: {},
      baz: {newValue: ["foo"]},
    },
  }));

  afterEach(restoreAll);

  after(() => {
    delete global._pEmbeddedWebExtension;
    delete global.browser;
  });
});
