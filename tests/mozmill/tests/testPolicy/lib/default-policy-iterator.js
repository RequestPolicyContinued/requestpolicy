/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var prefs = require(rootDir + "firefox/lib/prefs");


let DefaultPolicyManager = exports.DefaultPolicyManager = (function() {
  let self = {};

  let maxBinaryValue = 3;
  let currentBinaryValue;

  function isDefaultAllow(binaryPref) {
    // true if 1 or 3
    return (binaryPref & 0x1) != 0;
  }
  function isInterSubdomainAllowed(binaryPref) {
    // true if 2 or 3
    return (binaryPref & 0x2) != 0;
  }
  self.isDefaultAllow = function() {
    return isDefaultAllow(currentBinaryValue);
  };
  self.isInterSubdomainAllowed = function() {
    return isInterSubdomainAllowed(currentBinaryValue);
  };

  self.dumpState = function() {
    dump("[Prefs]  Default Allow: " + self.isDefaultAllow() + ", " +
        "Default Allow same domain: " + self.isInterSubdomainAllowed()+".\n");
  }

  self.getCurrentBinaryValue = function() {
    return currentBinaryValue;
  };
  self.setPref = function(binaryValue) {
    if (binaryValue < 0 || binaryValue > maxBinaryValue) {
      return false;
    } else {
      prefs.setPref(rpConst.PREF_DEFAULT_ALLOW, isDefaultAllow(binaryValue));
      prefs.setPref(rpConst.PREF_DEFAULT_ALLOW_SAME_DOMAIN,
                    isInterSubdomainAllowed(binaryValue));
      currentBinaryValue = binaryValue;
      return true;
    }
  };

  // initialize
  self.setPref(0);

  return self;
}());



function* makeDefaultPolicyIterator() {
  for (let i = 0; DefaultPolicyManager.setPref(i); ++i) {
    yield i;
  }
};

exports.DefaultPolicyManager = DefaultPolicyManager;
exports.makeDefaultPolicyIterator = makeDefaultPolicyIterator;
