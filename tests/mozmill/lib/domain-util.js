/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var DomainUtil = exports.DomainUtil = (function() {
  let self = {};

  var domains = {
    'maindomain.test': [
      'www.maindomain.test',
      'sub-1.maindomain.test',
      'sub-2.maindomain.test'
    ],
    'otherdomain.test': [
      'www.otherdomain.test',
      'sub-1.otherdomain.test',
      'sub-2.otherdomain.test'
    ],
    'thirddomain.test': [
      'www.thirddomain.test',
      'sub-1.thirddomain.test',
      'sub-2.thirddomain.test'
    ]
  };

  self.isSameDomain = function(dom1, dom2) {
    return dom1 == dom2;
  };

  self.isSameBaseDomain = function(dom1, dom2) {
    for (var i in domains) {
      var count = 0;
      if (i == dom1 || i == dom2) {
        ++count;
      }
      for (var j in domains[i]) {
        var d = domains[i][j];
        if (d == dom1 || d == dom2) {
          if (++count >= 2) {
            return true;
          }
        }
      }
    }
    return false;
  };

  self.isDifferentDomain = function(dom1, dom2) {
    return !self.isSameDomain(dom1, dom2);
  };

  return self;
}());
