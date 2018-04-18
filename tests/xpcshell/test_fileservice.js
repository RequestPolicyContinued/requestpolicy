/* exported run_test */

const {XPConnectService} = require("bootstrap/api/services/xpconnect-service");
const xpcService = new XPConnectService();

const {JSMService} = require("bootstrap/api/services/jsm-service");
const jsmService = new JSMService(Cu);
const mozFileUtils = jsmService.getFileUtils();

const {FileService} = require("bootstrap/api/services/file-service");
const fileService = new FileService(xpcService, mozFileUtils);

function run_test() {
  run_next_test();
}

add_test(function() {
  // Make sure the RP user dir doesn't already exist.

  // exercise
  const rpUserDir = do_get_profile();
  rpUserDir.append("requestpolicy");

  // verify
  do_check_false(rpUserDir.exists());

  run_next_test();
});

add_test(function() {
  // Ask for RP user dir.

  // exercise
  const dir = fileService.getRPDir();

  // verify
  Assert.ok(dir.exists());
  Assert.ok(dir.isDirectory());

  // cleanup
  removeAllRPFiles();

  run_next_test();
});

add_test(function() {
  // Ask for a subdirectory or the RP user dir.

  // exercise
  const dir = fileService.getRPDir("foo");

  // verify
  Assert.ok(dir.exists());
  Assert.ok(dir.isDirectory());

  // cleanup
  removeAllRPFiles();

  run_next_test();
});

add_test(function() {
  // exercise
  const allRPFiles = fileService.getAllRPFiles();

  // verify
  Assert.deepEqual(allRPFiles, {});

  run_next_test();
});

add_test(function() {
  // setup
  createRPFile("policies/foo/foo1.json", `{"foo": 1}`);

  // exercise
  const allJsonStorageFiles = fileService.getAllRPFiles();

  // verify
  Assert.deepEqual(allJsonStorageFiles, [
    "policies/foo/foo1.json",
  ]);

  // cleanup
  removeAllRPFiles();

  run_next_test();
});
