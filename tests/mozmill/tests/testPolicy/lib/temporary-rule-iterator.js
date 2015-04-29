/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// TODO: implement
let TemporaryRuleManager = (function() {
  let self = {};

  self.getCurrentBinaryValue = function() {
  };
  self.setPref = function(binaryValue) {
  };

  // initialize
  self.setPref(0);

  return self;
}());

function* makeTemporaryRules(doc) {
  if (!doc) {
    throw new Error("no doc specified.");
  }

  yield "this will be rule one";
}

exports.TemporaryRuleManager = TemporaryRuleManager;
exports.makeTemporaryRules = makeTemporaryRules;
