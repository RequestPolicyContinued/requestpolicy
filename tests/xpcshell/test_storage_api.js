/* exported run_test */

const {FileService} = require("bootstrap/api/services/file-service");
const {JSMService} = require("bootstrap/api/services/jsm-service");
const {XPConnectService} = require("bootstrap/api/services/xpconnect-service");
const {JsonStorage} = require("bootstrap/api/storage/json-storage");
const {PrefBranch} = require("bootstrap/api/storage/pref-branch");
const {Storage} = require("bootstrap/api/storage/storage.module");
const {SyncLocalStorageArea} = require("bootstrap/api/storage/sync-local-storage-area");
const {Log} = require("lib/classes/log");
const {defer} = require("lib/utils/js-utils");

const log = new Log();
const xpconnectService = new XPConnectService();
const jsmService = new JSMService(Cu);
const mozFileUtils = jsmService.getFileUtils();
const mozServices = jsmService.getServices();
const rpPrefBranch = new PrefBranch(
    Ci,
    mozServices.prefs,
    xpconnectService,
    "extensions.requestpolicy."
);
const fileService = new FileService(xpconnectService, mozFileUtils);
const jsonStorage = new JsonStorage(fileService);
const syncLocalStorageArea = new SyncLocalStorageArea(
    mozServices.prefs, rpPrefBranch, jsonStorage
);

function createStorageApi() {
  return new Storage(log, syncLocalStorageArea, rpPrefBranch);
}

// @ts-ignore
function run_test() {
  run_next_test();
}

//
// get()
//

["foo", ["foo"], {foo: "DEFAULT"}].forEach((getParameter) => {
  add_test(function() {
    // setup
    rpPrefBranch.set("foo", "bar");
    const storageApi = createStorageApi();
    storageApi.startup();
    do_test_pending();

    // eslint-disable-next-line arrow-body-style
    storageApi.whenReady.then(() => {
      // exercise
      return storageApi.backgroundApi.local.get(getParameter);
    }).then((result) => {
      // verify
      Assert.deepEqual(result, {foo: "bar"});

      // cleanup
      rpPrefBranch.reset("foo");
      storageApi.shutdown();

      do_test_finished();
      return;
    }).catch((e) => {
      console.dir(e);
      Assert.ok(false, e);
    });

    run_next_test();
  });
});

add_test(function() {
  // setup
  const storageApi = createStorageApi();
  storageApi.startup();
  do_test_pending();

  // eslint-disable-next-line arrow-body-style
  storageApi.whenReady.then(() => {
    // exercise
    return storageApi.backgroundApi.local.get({foo: "DEFAULT"});
  }).then((result) => {
    // verify
    Assert.deepEqual(result, {foo: "DEFAULT"});

    // cleanup
    storageApi.shutdown();

    do_test_finished();
    return;
  }).catch((e) => {
    console.dir(e);
    Assert.ok(false, e);
  });

  run_next_test();
});

//
// onChanged
//

[true, 42, "someValue"].forEach((testValue) => {
  add_test(function() {
    // setup
    rpPrefBranch.set("someRandomPrefName", "foo");
    let observedEvent;
    const dListenerFnCalled = defer();
    let listenerFn = (event) => {
      observedEvent = event;
      dListenerFnCalled.resolve(undefined);
    };
    const storageApi = createStorageApi();
    storageApi.startup();
    do_test_pending();
    storageApi.whenReady.then(() => {
      storageApi.backgroundApi.onChanged.addListener(listenerFn),

      // exercise
      rpPrefBranch.set("someRandomPrefName", testValue);

      return dListenerFnCalled.promise;
    }).then(() => {
      // verify
      Assert.deepEqual(observedEvent, {changes: {newValue: testValue}});

      // cleanup
      storageApi.backgroundApi.onChanged.removeListener(listenerFn),
      rpPrefBranch.reset("someRandomPrefName");
      storageApi.shutdown();

      do_test_finished();
      return;
    }).catch((e) => {
      console.dir(e);
      Assert.ok(false, e);
    });

    run_next_test();
  });
});

// removed pref
add_test(function() {
  // setup
  rpPrefBranch.set("someRandomPrefName", "foo");
  let observedEvent;
  const dListenerFnCalled = defer();
  let listenerFn = (event) => {
    observedEvent = event;
    dListenerFnCalled.resolve(undefined);
  };
  const storageApi = createStorageApi();
  storageApi.startup();
  do_test_pending();
  storageApi.whenReady.then(() => {
    storageApi.backgroundApi.onChanged.addListener(listenerFn),

    // exercise
    rpPrefBranch.reset("someRandomPrefName");

    return dListenerFnCalled.promise;
  }).then(() => {
    // verify
    Assert.deepEqual(observedEvent, {changes: {}});

    // cleanup
    storageApi.backgroundApi.onChanged.removeListener(listenerFn),
    rpPrefBranch.reset("someRandomPrefName");
    storageApi.shutdown();

    do_test_finished();
    return;
  }).catch((e) => {
    console.dir(e);
    Assert.ok(false, e);
  });

  run_next_test();
});
