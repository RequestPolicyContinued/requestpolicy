Components.utils.import("chrome://rpcontinued/content/lib/utils/files.jsm");

function copyRulesetFileToProfile(filename, destFilename) {
  if (!destFilename) {
    destFilename = "";
  }
  var testResources = do_get_file("resources", false);
  var profilePolicyDir = FileUtil.getRPUserDir("policies");
  var file = testResources.clone();
  file.append(filename);
  if (!file.exists()) {
    throw "Test resource does not exist: " + file.path;
  }
  // An empty second argument means keep the same filename when copying.
  file.copyTo(profilePolicyDir, destFilename);
}

/*
 * @throws If the file to delete doesn't exist.
 */
function deleteFileFromProfile(filename) {
  var profilePolicyDir = FileUtil.getRPUserDir("policies");
  var file = profilePolicyDir.clone();
  file.append(filename);
  file.remove(false);
}
