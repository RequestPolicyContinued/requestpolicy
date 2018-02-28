/* exported run_test */

const FileUtils = require("bootstrap/lib/utils/file-utils");

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
  const dir = FileUtils.getRPDir();

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
  const dir = FileUtils.getRPDir("foo");

  // verify
  Assert.ok(dir.exists());
  Assert.ok(dir.isDirectory());

  // cleanup
  removeAllRPFiles();

  run_next_test();
});

add_test(function() {
  // exercise
  const allRPFiles = FileUtils.getAllRPFiles();

  // verify
  Assert.deepEqual(allRPFiles, {});

  run_next_test();
});

add_test(function() {
  // setup
  createRPFile("policies/foo/foo1.json", `{"foo": 1}`);

  // exercise
  const allJsonPrefFiles = FileUtils.getAllRPFiles();

  // verify
  Assert.deepEqual(allJsonPrefFiles, [
    "policies/foo/foo1.json",
  ]);

  // cleanup
  removeAllRPFiles();

  run_next_test();
});
