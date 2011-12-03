
function tprint(msg) {
  print(msg);
}

function runPolicyTests(policy, testsArray) {
  var passCount = 0;
  var failCount = 0;
  for (var i = 0, test; test = testsArray[i]; i++) {
    tprint("\n** Test " + i + " **");
    tprint("origin: " + test["origin"]);
    tprint("dest: " + test["dest"]);
    var allow, deny;
    var origin = uriStrToObj(test["origin"]);
    var dest = uriStrToObj(test["dest"]);
    [allow, deny] = policy.check(origin, dest);
    if (allow.length != test["allowCount"]) {
      tprint("FAIL: incorrect allow count. Was " + allow.length + ", expected "
          + test["allowCount"]);
      failCount++;
    } else if (deny.length != test["denyCount"]) {
      tprint("FAIL: incorrect deny count. Was " + allow.length + ", expected "
          + test["denyCount"]);
      failCount++;
    } else {
      tprint("PASS");
      passCount++;
    }
  }
  tprint("=== Summary ===");
  tprint("Pass count: " + passCount);
  tprint("Fail count: " + failCount);
}


// We'll assume we have a function that splits the url into the things we want
// and just hard code these now for simple testing.

function uriStrToObj(uriString) {
  var uriObj = {};
  var parts = uriString.split("://");
  uriObj["scheme"] = parts.shift();
  parts = parts.join("://").split("/");
  var hostPortParts = parts.shift().split(":");
  uriObj["host"] = hostPortParts[0];
  // A port of -1 in the uri object means the default port for the protocol.
  uriObj["port"] = hostPortParts.length == 2 ? hostPortParts[1] : -1;
  uriObj["path"] = "/" + parts.join("/");
  // dprint("=== split of: " + uriString);
  // for (var i in uriObj) {
  //   dprint(i + ": " + uriObj[i]);
  // }
  return uriObj;
}
