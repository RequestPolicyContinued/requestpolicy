/* exported
    copyRulesetFileToProfile,
    deleteFileFromProfile,
*/

Components.utils.import("chrome://rpcontinued/content/lib/utils/files.jsm");

function copyRulesetFileToProfile(filename, destFilename) {
  if (!destFilename) {
    destFilename = "";
  }
  const testResources = do_get_file("resources", false);
  const profilePolicyDir = FileUtil.getRPUserDir("policies");
  const file = testResources.clone();
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
  const profilePolicyDir = FileUtil.getRPUserDir("policies");
  const file = profilePolicyDir.clone();
  file.append(filename);
  file.remove(false);
}
