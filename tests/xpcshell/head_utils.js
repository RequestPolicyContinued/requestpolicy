/* exported
    createRPFile,
    removeAllRPFiles,
    copyRulesetFileToProfile,
    deleteFileFromProfile,
*/

const RPFileUtils = require("bootstrap/lib/utils/file-utils");

function createRPFile(aPath, aContent) {
  const file = RPFileUtils.getRPFile(aPath);

  const foStream = Cc["@mozilla.org/network/file-output-stream;1"].
      createInstance(Ci.nsIFileOutputStream);
  foStream.init(file, 0x02 | 0x08 | 0x20, 0o666, 0);

  const converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
      createInstance(Ci.nsIConverterOutputStream);
  converter.init(foStream, "UTF-8", 0, 0);
  converter.writeString(aContent);
  converter.close(); // this closes foStream
}

function removeAllRPFiles() {
  RPFileUtils.getRPDir().remove(true);
}

function copyRulesetFileToProfile(filename, destFilename) {
  if (!destFilename) {
    // eslint-disable-next-line no-param-reassign
    destFilename = "";
  }
  const testResources = do_get_file("resources", false);
  const profilePolicyDir = RPFileUtils.getRPDir("policies");
  const file = testResources.clone();
  file.append(filename);
  if (!file.exists()) {
    throw `Test resource does not exist: ${file.path}`;
  }
  // An empty second argument means keep the same filename when copying.
  file.copyTo(profilePolicyDir, destFilename);
}

/*
 * @throws If the file to delete doesn't exist.
 */
function deleteFileFromProfile(filename) {
  const profilePolicyDir = RPFileUtils.getRPDir("policies");
  const file = profilePolicyDir.clone();
  file.append(filename);
  file.remove(false);
}
