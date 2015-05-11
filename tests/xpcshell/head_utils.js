Components.utils.import("chrome://rpcontinued/content/lib/file-util.jsm");
//// TODO: Maybe the script loader needs to be used instead?
//var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
//    .getService(Components.interfaces.mozIJSSubScriptLoader);
//loader.loadSubScript("chrome://rpcontinued/content/modules/FileUtil.jsm");

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

/**
 * Compares to objects recursively to see if they have the same keys
 * and values.
 */
function objectsAreEqual(objA, objB) {
  print("%%%%%%%%%%%%%%%%%%%%%%%%%%");
  print(objToStr(objA));
  print("//////////////");
  print(objToStr(objB));
  print("%%%%%%%%%%%%%%%%%%%%%%%%%%");

  // We compare two objects converted to strings because the first approach
  // I tried, adding an "equals" method to Object.prototype, has unexpected
  // results I believe because the Object object used by modules is
  // different than our Object, and thus objects created in modules and
  // passed back to the test didn't have the equals method. I'm sure a
  // JavaScript master could have sorted it out, but for our purposes
  // comparing "canonical" string representations works fine.
  var result = objToStr(objA) == objToStr(objB);
  return result;
}

// Returns the object represented as a string. If we had a library to
// generate canonical JSON, we'd use that, instead.
function objToStr(object, depth, max){
  depth = depth || 1;
  max = max || 20;

  if (depth > max) {
    return false;
  }

  var indent = "";
  for (var i = 0; i < depth; i++) {
    indent += "  ";
  }

  var output = "{";

  var keys = Object.keys(object);
  keys.sort();

  for (var i in keys) {
    var key = keys[i];
    output += "\n" + indent + '"' + key + '" : ';
    switch (typeof object[key]) {
      case "object":
        output += objToStr(object[key], depth + 1, max);
        break;
      case "function": output += "function";
        break;
      default: output += object[key];
        break;
    }
    if (i < keys.length - 1) {
      output += ",";
    }
  }

  var indent = "";
  for (var i = 0; i < depth - 1; i++) {
    indent += "  ";
  }

  output +="\n" + indent + "}";
  return output;
}
