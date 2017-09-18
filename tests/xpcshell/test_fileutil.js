/* exported run_test */
Components.utils.import("chrome://rpcontinued/content/lib/utils/files.jsm");

function run_test() {
  // Make sure the RP user dir doesn't already exist.
  const rpUserDir = do_get_profile();
  rpUserDir.append("requestpolicy");
  do_check_false(rpUserDir.exists());

  // Ask for RP user dir.
  const dir1 = FileUtil.getRPUserDir();
  do_check_true(dir1.isDirectory());
  do_check_true(dir1.exists());

  // Ask for a subdirectory or the RP user dir.
  const dir2 = FileUtil.getRPUserDir("foo");
  do_check_true(dir2.isDirectory());
  do_check_true(dir2.exists());

  // Make sure the subdirectory isn't really RP user dir.
  do_check_neq(dir1.path, dir2.path);

  // TODO: check perms on the created directories.
}
