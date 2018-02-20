"use strict";

const {assert} = require("chai");
const mrdescribe = require("mocha-repeat");
const {
  getFullStorageDirection,
} = require("../lib/settings-migration-utils");
const {createBrowserApi} = require("../lib/sinon-chrome");
const {destructureOptions} = require("../lib/utils");

const {defer} = require("lib/utils/js-utils");

const {Log} = require("models/log");
const {LegacySideSettingsMigrationController} = require(
    "app/legacy/legacy-side-settings-migration-controller"
);
const {WebextSideSettingsMigrationController} = require(
    "controllers/webext-side-settings-migration-controller"
);

function stubStorageLocalGet(aStorage, aInitialFullStorage) {
  aStorage.local.get.withArgs(null).resolves(aInitialFullStorage);
  const lastStorageChangeResponse = "lastStorageChange" in aInitialFullStorage ? {
    lastStorageChange: aInitialFullStorage.lastStorageChange,
  } : {};
  aStorage.local.get.withArgs("lastStorageChange").resolves(lastStorageChangeResponse);
}

function maybeAssignLastStorageChange(aObj, aLastStorageChange) {
  return Object.assign(aObj, aLastStorageChange ? {
    lastStorageChange: aLastStorageChange,
  } : {});
}


describe("legacy settings migration:", function() {
  const sinon = require("sinon").sandbox.create();
  afterEach(() => sinon.restore());

  const browser = createBrowserApi();
  const eweExternalBrowser = createBrowserApi();
  const eweInternalBrowser = createBrowserApi();

  let LegacySideController;
  let WebextSideController;
  function controllers() {
    return {
      LegacySideController: {
        // hack...
        startup() {
          LegacySideController.startup();
          return LegacySideController.pWaitingForEWE;
        },
      },
      WebextSideController,
    };
  }

  before(() => {
    const embeddedWE = {browser: eweExternalBrowser};
    global._pEmbeddedWebExtension = Promise.resolve(embeddedWE);
    global.browser = browser;
  });

  beforeEach(() => {
    eweExternalBrowser.runtime.whenReady = () => Promise.resolve(); // FIXME
    LegacySideController = new LegacySideSettingsMigrationController(
        Log.instance,
        browser.storage,
        eweExternalBrowser.runtime
    );
    WebextSideController = new WebextSideSettingsMigrationController(
        Log.instance,
        eweInternalBrowser.runtime,
        eweInternalBrowser.storage
    );
  });

  function restoreAll() {
    browser.flush();
    eweExternalBrowser.flush();
    eweInternalBrowser.flush();
  }

  function createTest(aOptions) {
    const o = destructureOptions([
      ["onFullStorageSet", () => {}],
      ["afterInitialSync", () => {}],
      ["afterStorageChangesDispatched", () => {}],
      ["legacySideInitialFullStorage", {}],
      ["webextSideInitialFullStorage", {}],
      ["storageChanges", null],
      ["startupOrder", ["WebextSideController", "LegacySideController"]],
    ], aOptions);

    const onFullStorageSet = o("onFullStorageSet");
    const afterInitialSync = o("afterInitialSync");
    const afterStorageChangesDispatched = o("afterStorageChangesDispatched");
    const legacySideInitialFullStorage = o("legacySideInitialFullStorage");
    const webextSideInitialFullStorage = o("webextSideInitialFullStorage");
    const storageChanges = o("storageChanges");
    const startupOrder = o("startupOrder");

    const fullStorageDirection = getFullStorageDirection(
        {legacySideInitialFullStorage, webextSideInitialFullStorage}
    );
    const isPush = fullStorageDirection === "push";

    let onRuntimeSendMessageCalled = null;

    function redirectMessages(aFromRuntime, aToRuntime) {
      aFromRuntime.sendMessage.callsFake((aMessage) => {
        const {_listeners} = aToRuntime.onMessage;
        assert.isAtMost(_listeners.length, 1);
        if (_listeners.length === 0) return Promise.resolve();
        const rv = Promise.resolve(_listeners[0](aMessage));
        if (onRuntimeSendMessageCalled) {
          onRuntimeSendMessageCalled(aMessage, rv);
        }
        return rv;
      });
    }

    return function() {
      const {runtime: eweExtRuntime} = eweExternalBrowser;
      const {runtime: eweIntRuntime, storage: webextStorage} = eweInternalBrowser;
      const {storage: legacyStorage} = browser;

      redirectMessages(eweExtRuntime, eweIntRuntime);
      redirectMessages(eweIntRuntime, eweExtRuntime);

      const olderStorage = isPush ? webextStorage : legacyStorage;
      stubStorageLocalGet(legacyStorage, legacySideInitialFullStorage);
      stubStorageLocalGet(webextStorage, webextSideInitialFullStorage);
      olderStorage.local.set.callsFake((...args) => {
        onFullStorageSet({args, webextStorage, legacyStorage});
        return Promise.resolve();
      });
      webextStorage.local.remove.resolves();

      let p = controllers()[startupOrder[0]].startup();
      p = p.then(() => {
        controllers()[startupOrder[1]].startup();
        return LegacySideController.pInitialSync;
      }).then(
          () => afterInitialSync({webextStorage, legacyStorage})
      );
      if (!storageChanges) return p;
      p = p.then(() => {
        legacyStorage.local.get.resetHistory();
        legacyStorage.local.set.reset();
        webextStorage.local.get.reset();
        webextStorage.local.set.reset();

        webextStorage.local.set.resolves();
        webextStorage.local.remove.resolves();
        const dStorageChange = defer();
        onRuntimeSendMessageCalled = (aMessage, aResponse) => {
          if (aMessage.type === "storage-change") {
            dStorageChange.resolve(aResponse);
            onRuntimeSendMessageCalled = null;
          }
        };
        legacyStorage.onChanged.dispatch(storageChanges, "local");
        return dStorageChange.promise;
      }).then(() => afterStorageChangesDispatched({webextStorage, legacyStorage}));
      return p;
    };
  }


  describe("startup tests", function() {
    const possibleTestParameterValues = {
      lastStorageChange: {
        "none": undefined,
        "empty string": "",
        "2010": "2010-10-20T07:13:28+00:00",
        "just now": (new Date()).toISOString(),
      },
    };

    const testParameters = {
      startupOrder: {
        "first start up WebextSideController, then LegacySideController": [
          ["WebextSideController", "LegacySideController"],
        ],
        "first start up LegacySideController, then WebextSideController": [
          ["LegacySideController", "WebextSideController"],
        ],
      },
      legacySideLastStorageChange: possibleTestParameterValues.lastStorageChange,
      webextSideLastStorageChange: possibleTestParameterValues.lastStorageChange,
    };

    /* eslint-disable indent */
    mrdescribe("by startup order",
                testParameters.startupOrder,
                function(startupOrder) {
      mrdescribe("legacy-side 'lastStorageChange'",
                  testParameters.legacySideLastStorageChange,
                  function(legacySideLastStorageChange) {
        mrdescribe("webext-side 'lastStorageChange'",
                    testParameters.webextSideLastStorageChange,
                    function(webextSideLastStorageChange) {
          it("test", createStartupTest({
            startupOrder,
            legacySideLastStorageChange,
            webextSideLastStorageChange,
          }));
        });
      });
    });
    /* eslint-enable indent */

    function createStartupTest(aOptions) {
      const o = destructureOptions([
        ["startupOrder"],
        ["legacySideLastStorageChange"],
        ["webextSideLastStorageChange"],
      ], aOptions);

      const startupOrder = o("startupOrder");
      const legacySideLastStorageChange = o("legacySideLastStorageChange");
      const webextSideLastStorageChange = o("webextSideLastStorageChange");

      const legacySideInitialFullStorage = maybeAssignLastStorageChange(
          {foo: "bar"}, legacySideLastStorageChange
      );
      const webextSideInitialFullStorage = maybeAssignLastStorageChange(
          {foo: "baz"}, webextSideLastStorageChange
      );
      const fullStorageDirection = getFullStorageDirection(
          {legacySideInitialFullStorage, webextSideInitialFullStorage}
      );

      return createTest({
        legacySideInitialFullStorage,
        webextSideInitialFullStorage,
        startupOrder,
        afterInitialSync({legacyStorage, webextStorage}) {
          const legacyInfo = {
            storage: legacyStorage,
            name: "legacyStorage",
            initialStorage: legacySideInitialFullStorage,
          };
          const webextInfo = {
            storage: webextStorage,
            name: "webextStorage",
            initialStorage: webextSideInitialFullStorage,
          };

          if (fullStorageDirection === "pull") {
            doStartupAssertions(webextInfo, legacyInfo);
          } else {
            doStartupAssertions(legacyInfo, webextInfo);
          }
        },
      });
    }

    function doStartupAssertions(
        {storage: newStorage, name: newStorageName, initialStorage: newInitialStorage},
        {storage: oldStorage, name: oldStorageName}
    ) {
      assert.equal(newStorage.local.set.callCount, 0,
          `${newStorageName}.local.set() has NOT been called.`);
      assert.equal(oldStorage.local.set.callCount, 1,
          `${oldStorageName}.local.set() has been called once.`);
      const call = oldStorage.local.set.getCall(0);
      assert.equal(call.args.length, 1);
      assert.strictEqual(call.args[0], newInitialStorage,
          `The initial full storage of "${newStorageName}" ` +
          `has been stored into "${oldStorageName}".`);
    }
  });

  describe("storage change tests", function() {
    function createStorageChangeTest(aOptions) {
      const o = destructureOptions([
        ["legacySideInitialFullStorage", {key1: "foo", key2: "bar"}],
        ["webextSideInitialFullStorage", {}],
        ["storageChanges"],
        ["expectedStorageSetKeys", null],
        ["expectedStorageRemoveKeys", null],
      ], aOptions);

      const legacySideInitialFullStorage = o("legacySideInitialFullStorage");
      const webextSideInitialFullStorage = o("webextSideInitialFullStorage");
      const storageChanges = o("storageChanges");
      const expectedStorageSetKeys = o("expectedStorageSetKeys");
      const expectedStorageRemoveKeys = o("expectedStorageRemoveKeys");

      return createTest({
        legacySideInitialFullStorage,
        webextSideInitialFullStorage,
        storageChanges,
        afterStorageChangesDispatched({webextStorage}) {
          const nSetCalls = expectedStorageSetKeys ? 1 : 0;
          const nRemoveCalls = expectedStorageRemoveKeys ? 1 : 0;
          assert.strictEqual(
              webextStorage.local.set.callCount,
              nSetCalls,
              `webextStorage.local.set() has been called ${nSetCalls} times.`
          );
          assert.strictEqual(
              webextStorage.local.remove.callCount,
              nRemoveCalls,
              `webextStorage.local.remove() has been called ${nRemoveCalls} times.`
          );
          if (expectedStorageSetKeys) {
            assert.deepEqual(
                webextStorage.local.set.getCall(0).args,
                [expectedStorageSetKeys],
                "webextStorage.local.set() has been called with the expected arguments."
            );
          }
          if (expectedStorageRemoveKeys) {
            assert.sameDeepMembers(
                webextStorage.local.remove.getCall(0).args,
                [expectedStorageRemoveKeys],
                "webextStorage.local.set() has been called with the expected arguments."
            );
          }
        },
      });
    }

    it("legacy storage change: adding new keys", createStorageChangeTest({
      storageChanges: {
        new1: {newValue: 1},
        new2: {newValue: 2},
      },
      expectedStorageSetKeys: {
        new1: 1,
        new2: 2,
      },
    }));

    it("legacy storage change: updating existing keys", createStorageChangeTest({
      storageChanges: {
        key1: {newValue: 1},
        key2: {newValue: 2},
      },
      expectedStorageSetKeys: {
        key1: 1,
        key2: 2,
      },
    }));

    it("legacy storage change: removing existing keys", createStorageChangeTest({
      storageChanges: {
        key1: {},
        key2: {},
      },
      expectedStorageRemoveKeys: ["key1", "key2"],
    }));

    it("storage change after full storage push", createStorageChangeTest({
      webextSideInitialFullStorage: {lastStorageChange: "2017"},
      storageChanges: {
        key1: {newValue: "new!11"},
        key2: {},
      },
      expectedStorageSetKeys: {
        key1: "new!11",
      },
      expectedStorageRemoveKeys: ["key2"],
    }));
  });

  afterEach(restoreAll);

  after(() => {
    delete global._pEmbeddedWebExtension;
    delete global.browser;
  });
});
