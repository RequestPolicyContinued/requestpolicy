/* exported run_test */

const {FileService} = require("bootstrap/api/services/file-service");
const {JSMService} = require("bootstrap/api/services/jsm-service");
const {XPConnectService} = require("bootstrap/api/services/xpconnect-service");
const {JsonStorage} = require("bootstrap/api/storage/json-storage");
const {PrefBranch} = require("bootstrap/api/storage/pref-branch");
const {Storage} = require("bootstrap/api/storage/storage.module");
const {SyncLocalStorageArea} = require("bootstrap/api/storage/sync-local-storage-area");
const {Log} = require("lib/classes/log");

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

//
// get()
//

["foo", ["foo"], {foo: "DEFAULT"}].forEach((getParameter) => {
  add_task(function * () {
    // setup
    rpPrefBranch.set("foo", "bar");
    const storageApi = createStorageApi();
    storageApi.startup();

    // eslint-disable-next-line arrow-body-style
    yield storageApi.whenReady;

    // exercise
    const result = yield storageApi.backgroundApi.local.get(getParameter);

    // verify
    Assert.deepEqual(result, {foo: "bar"});

    // cleanup
    rpPrefBranch.reset("foo");
    storageApi.shutdown();
  });
});

add_task(function * () {
  // setup
  const storageApi = createStorageApi();
  storageApi.startup();

  // eslint-disable-next-line arrow-body-style
  yield storageApi.whenReady;

  // exercise
  const result = yield storageApi.backgroundApi.local.get({foo: "DEFAULT"});

  // verify
  Assert.deepEqual(result, {foo: "DEFAULT"});

  // cleanup
  storageApi.shutdown();
});

//
// onChanged (pref branch)
//

// pref change
[true, 42, "someValue-pref-changed"].forEach((testValue) => {
  add_task(function * () {
    // setup
    rpPrefBranch.set("someRandomPrefName", "foo");
    let changesArray = [];
    let listenerFn = (changes) => changesArray.push(changes);
    const storageApi = createStorageApi();
    storageApi.startup();
    yield storageApi.whenReady;
    storageApi.backgroundApi.onChanged.addListener(listenerFn),

    // exercise
    yield storageApi.backgroundApi.local.set({"someRandomPrefName": testValue});

    // verify
    Assert.strictEqual(changesArray.length, 1);
    Assert.deepEqual(changesArray[0], {"someRandomPrefName": {newValue: testValue}});

    // cleanup
    storageApi.backgroundApi.onChanged.removeListener(listenerFn),
    rpPrefBranch.reset("someRandomPrefName");
    storageApi.shutdown();
  });
});

// pref creation
[true, 42, "someValue-pref-creation"].forEach((testValue) => {
  add_task(function * () {
    // setup
    rpPrefBranch.reset("someRandomPrefName");
    let changesArray = [];
    let listenerFn = (changes) => changesArray.push(changes);
    const storageApi = createStorageApi();
    storageApi.startup();
    yield storageApi.whenReady;
    storageApi.backgroundApi.onChanged.addListener(listenerFn),

    // exercise
    yield storageApi.backgroundApi.local.set({"someRandomPrefName": testValue});

    // verify
    Assert.strictEqual(changesArray.length, 1);
    Assert.deepEqual(changesArray[0], {"someRandomPrefName": {newValue: testValue}});

    // cleanup
    storageApi.backgroundApi.onChanged.removeListener(listenerFn),
    rpPrefBranch.reset("someRandomPrefName");
    storageApi.shutdown();
  });
});

// pref removed
add_task(function * () {
  // setup
  rpPrefBranch.set("someRandomPrefName", "foo");
  let changesArray = [];
  let listenerFn = (changes) => changesArray.push(changes);
  const storageApi = createStorageApi();
  storageApi.startup();
  yield storageApi.whenReady;
  storageApi.backgroundApi.onChanged.addListener(listenerFn),

  // exercise
  yield storageApi.backgroundApi.local.remove("someRandomPrefName");

  // verify
  Assert.strictEqual(changesArray.length, 1);
  Assert.deepEqual(changesArray[0], {"someRandomPrefName": {}});

  // cleanup
  storageApi.backgroundApi.onChanged.removeListener(listenerFn),
  rpPrefBranch.reset("someRandomPrefName");
  storageApi.shutdown();
});

//
// onChanged (json pref)
//

// pref change
[true, 42, "someValue-json-change"].forEach((testValue) => {
  add_task(function * () {
    // setup
    createRPFile("policies/someRandomPrefName.json", `"foo"`);
    let changesArray = [];
    let listenerFn = (changes) => changesArray.push(changes);
    const storageApi = createStorageApi();
    storageApi.startup();
    yield storageApi.whenReady;
    storageApi.backgroundApi.onChanged.addListener(listenerFn),

    // exercise
    yield storageApi.backgroundApi.local.set({"policies/someRandomPrefName": testValue});

    // verify
    Assert.strictEqual(changesArray.length, 1);
    Assert.deepEqual(changesArray[0], {"policies/someRandomPrefName": {newValue: testValue}});

    // cleanup
    storageApi.backgroundApi.onChanged.removeListener(listenerFn),
    removeAllRPFiles();
    storageApi.shutdown();
  });
});

// pref creation
[true, 42, "someValue-json-creation"].forEach((testValue) => {
  add_task(function * () {
    // setup
    removeAllRPFiles();
    let changesArray = [];
    let listenerFn = (changes) => changesArray.push(changes);
    const storageApi = createStorageApi();
    storageApi.startup();
    yield storageApi.whenReady;
    storageApi.backgroundApi.onChanged.addListener(listenerFn),

    // exercise
    yield storageApi.backgroundApi.local.set({"policies/someRandomPrefName": testValue});

    // verify
    Assert.strictEqual(changesArray.length, 1);
    Assert.deepEqual(changesArray[0], {"policies/someRandomPrefName": {newValue: testValue}});

    // cleanup
    storageApi.backgroundApi.onChanged.removeListener(listenerFn),
    removeAllRPFiles();
    storageApi.shutdown();
  });
});

// pref removed
add_task(function * () {
  // setup
  createRPFile("policies/someRandomPrefName.json", `"foo"`);
  let changesArray = [];
  let listenerFn = (changes) => changesArray.push(changes);
  const storageApi = createStorageApi();
  storageApi.startup();
  yield storageApi.whenReady;
  storageApi.backgroundApi.onChanged.addListener(listenerFn),

  // exercise
  yield storageApi.backgroundApi.local.remove("policies/someRandomPrefName");

  // verify
  Assert.strictEqual(changesArray.length, 1);
  Assert.deepEqual(changesArray[0], {"policies/someRandomPrefName": {}});

  // cleanup
  storageApi.backgroundApi.onChanged.removeListener(listenerFn),
  removeAllRPFiles();
  storageApi.shutdown();
});
