/* exported run_test */

const {XPConnectService} = require("bootstrap/api/services/xpconnect-service");
const xpconnectService = new XPConnectService();
const {
  FileUtils: mozFileUtils,
} = Cu.import("resource://gre/modules/FileUtils.jsm", {});
const {FileService} = require("bootstrap/api/services/file-service");
const fileService = new FileService(xpconnectService, mozFileUtils);

const {JsonStorage} = require("bootstrap/api/storage/json-storage");
const jsonStorage = new JsonStorage(fileService);

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
