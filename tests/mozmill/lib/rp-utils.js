/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global findElement, assert */

function getElementById(ancestor, id) {
  var element = ancestor.getElementById(id);
  assert.ok(element, "element #" + id + " has been found.");
  return element;
}

/**
 * Create all combinations of a two-dimensional array.
 *
 * Example:
 * input: [[1,2],["a"],[5,6]]
 * output: [[1,"a",5], [1,"a",6], [2,"a",5], [2,"a",6]]
 */
function combinations(list) {
  var prefixes, tailCombinations;

  if(list.length === 1) {
    return list[0];
  }

  prefixes = list[0];
  // recursively call `combinations()` on the tail of the array
  tailCombinations = combinations(list.slice(1));

  var combined = [];

  prefixes.forEach(function(prefix) {
    tailCombinations.forEach(function(tailCombination) {
      combined.push([prefix].concat(tailCombination));
    });
  });

  return combined;
}

// Export of functions
exports.getElementById = getElementById;
exports.combinations = combinations;
