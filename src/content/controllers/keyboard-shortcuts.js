/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2015 Martin Kimmerle
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK *****
 */

import {KeyboardShortcut} from "lib/classes/keyboard-shortcut";

// =============================================================================
// KeyboardShortcuts
// =============================================================================

export const KeyboardShortcuts = (function() {
  let self = {};

  let keyboardShortcuts = [];

  self.startup = function() {
    keyboardShortcuts.push(new KeyboardShortcut("openMenu", "alt shift r",
        function(window) {
          window.rpcontinued.overlay.toggleMenu();
        },
        "keyboardShortcuts.openMenu.enabled",
        "keyboardShortcuts.openMenu.combo"));
    keyboardShortcuts.push(new KeyboardShortcut("openRequestLog", "none",
        function(window) {
          window.rpcontinued.overlay.toggleRequestLog();
        },
        "keyboardShortcuts.openRequestLog.enabled",
        "keyboardShortcuts.openRequestLog.combo"));
  };

  self.shutdown = function() {
    keyboardShortcuts.forEach(ks => {
      ks.destroy();
    });
    keyboardShortcuts.length = 0;
  };

  return self;
})();
