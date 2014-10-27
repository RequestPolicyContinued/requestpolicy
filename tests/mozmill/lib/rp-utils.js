/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * @param {MozMillController} _controller
 * @param {ElemBase} tab
 */
function waitForTabLoad(_controller, tab) {
  // sleep as a workaround because the "busy" attribute is not present
  // immediately.
  _controller.sleep(100);

  assert.waitFor(function() {
    return !tab.getNode().hasAttribute("busy");
  }, "The tab has loaded");
}

function selectText(_tabBrowser, text) {
  var findBar = _tabBrowser.findBar;
  findBar.open();
  findBar.search(text);
  findBar.value = "";
  findBar.close(true);
}

function getElementById(ancestor, id) {
  var element = ancestor.getElementById(id);
  assert.ok(element, 'element #' + id + ' has been found.');
  return element;
}

// Export of functions
exports.waitForTabLoad = waitForTabLoad;
exports.selectText = selectText;
exports.getElementById = getElementById;
