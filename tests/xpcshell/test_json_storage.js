/* exported run_test */

const {XPConnectService} = require("bootstrap/api/services/xpconnect-service");
const xpconnectService = new XPConnectService();

const {JSMService} = require("bootstrap/api/services/jsm-service");
const jsmService = new JSMService(Cu);
const mozFileUtils = jsmService.getFileUtils();

const {FileService} = require("bootstrap/api/services/file-service");
const fileService = new FileService(xpconnectService, mozFileUtils);

const {JsonStorage} = require("bootstrap/api/storage/json-storage");
const jsonStorage = new JsonStorage(fileService);

// @ts-ignore
function run_test() {
  run_next_test();
}

add_test(function() {
  // exercise
  const fullJsonStorage = jsonStorage.getAll();

  // verify
  Assert.deepEqual(fullJsonStorage, {});

  run_next_test();
});

add_test(function() {
  // setup
  createRPFile("policies/foo/foo1.json", `{"foo": 1}`);
  createRPFile("policies/foo/foo2.json", `{"foo": 2}`);
  createRPFile("policies/bar/barA.json", `{"bar": "A"}`);
  createRPFile("policies/bar/barB.json", `{"bar": "B"}`);

  // exercise
  const fullJsonStorage = jsonStorage.getAll();

  // verify
  Assert.deepEqual(fullJsonStorage, {
    "policies/foo/foo1": {foo: 1},
    "policies/foo/foo2": {foo: 2},
    "policies/bar/barA": {bar: "A"},
    "policies/bar/barB": {bar: "B"},
  });

  // cleanup
  removeAllRPFiles();

  run_next_test();
});

add_test(function() {
  // setup
  createRPFile("policies/foo/foo1.json", `{"foo": 1}`);
  createRPFile("policies/foo/foo2.json", `{"foo": 2}`);
  createRPFile("policies/foo/foo3.json", `{"foo": 3}`);
  createRPFile("policies/bar/barA.json", `{"bar": "A"}`);
  createRPFile("policies/bar/barB.json", `{"bar": "B"}`);

  // exercise
  jsonStorage.remove("policies/foo/foo2");
  jsonStorage.remove("policies/bar/barB");
  const fullJsonStorage = jsonStorage.getAll();

  // verify
  Assert.deepEqual(fullJsonStorage, {
    "policies/foo/foo1": {foo: 1},
    "policies/foo/foo3": {foo: 3},
    "policies/bar/barA": {bar: "A"},
  });

  // cleanup
  removeAllRPFiles();

  run_next_test();
});

add_test(function() {
  // setup
  createRPFile("policies/foo/foo1.json", `{"foo": 1}`);

  // exercise
  jsonStorage.remove("policies/foo/foo");
  const fullJsonStorage = jsonStorage.getAll();

  // verify
  Assert.deepEqual(fullJsonStorage, {
    "policies/foo/foo1": {foo: 1},
  });

  // cleanup
  removeAllRPFiles();

  run_next_test();
});
