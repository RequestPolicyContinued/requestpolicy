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

import {rp} from "app/app.background";
import {Windows} from "models/windows";
import {ManagerForPrefObservers} from "lib/manager-for-pref-observer";
import * as XULUtils from "lib/utils/xul-utils";
import {MainEnvironment} from "lib/environment";

const {cachedSettings} = rp.storage;

// =============================================================================
// KeyboardShortcut
// =============================================================================

/**
 * Overview of events:
 *
 * Init:
 * - determine attributes
 * - create element (all windows)          \  load into
 * - set element attributes (all windows)  /  window
 *
 * New window:
 * - create element (this window)          \  load into
 * - set element attributes (this window)  /  window
 *
 * Pref changed:
 * - determine attributes
 * - set element attributes (all windows)
 */

export function KeyboardShortcut(
    aID, aDefaultCombo, aCallback,
    aUserEnabledPrefName, aUserComboPrefName
) {
  // ---------------------------------------------------------------------------
  // initialize properties
  // ---------------------------------------------------------------------------

  this._id = aID;
  this._elementID = `rpKey_${this._id}`;
  this._defaultCombo = aDefaultCombo;
  this._callback = aCallback;
  this._userEnabledPrefName = aUserEnabledPrefName;
  this._userComboPrefName = aUserComboPrefName;

  this._elementAttributes = {
    disabled: null,
    modifiers: null,
    key: null,
  };

  this._listeners = {
    onWindowLoad: this._loadIntoWindow.bind(this),
    onWindowUnload: this._unloadFromWindow.bind(this),
    onKeyCommand: this._onPress.bind(this),
    onPrefChange: this._onPrefChange.bind(this),
  };

  // ---------------------------------------------------------------------------
  // initialize
  // ---------------------------------------------------------------------------

  this._determineElementAttributes();
  Windows.forEachOpenWindow(this._loadIntoWindow.bind(this));

  Windows.addListener("load", this._listeners.onWindowLoad);
  Windows.addListener("unload", this._listeners.onWindowUnload);
  ManagerForPrefObservers.get(MainEnvironment).addListeners([
    this._userEnabledPrefName,
    this._userComboPrefName,
  ], this._listeners.onPrefChange);
}

// -----------------------------------------------------------------------------
// main methods
// -----------------------------------------------------------------------------

KeyboardShortcut.prototype.destroy = function() {
  Windows.forEachOpenWindow(this._unloadFromWindow.bind(this));
  Windows.removeListener("load", this._listeners.onWindowLoad);
  Windows.removeListener("unload", this._listeners.onWindowUnload);
  ManagerForPrefObservers.get(MainEnvironment).removeListeners([
    this._userEnabledPrefName,
    this._userComboPrefName,
  ], this._listeners.onPrefChange);
};

KeyboardShortcut.prototype._loadIntoWindow = function(window) {
  this._createElement(window);
  this._setElementAttributes(window);
};

KeyboardShortcut.prototype._unloadFromWindow = function(window) {
  this._removeElement(window);
};

KeyboardShortcut.prototype._onPress = function(event) {
  let window = event.target.ownerDocument.defaultView;
  this._callback.call(null, window);
};

KeyboardShortcut.prototype._onPrefChange = function() {
  this._determineElementAttributes();
  Windows.forEachOpenWindow((window) => {
    this._setElementAttributes(window);

    // Each time one of the key's attributes changes it's necessary to
    // newly append the keyset to it's parent. Otherwise the
    // keyboard shortcut doesn't get updated!
    let keyset = window.document.getElementById("rpcontinuedKeyset");
    keyset.parentNode.appendChild(keyset);
  });
};

// -----------------------------------------------------------------------------
// assisting methods
// -----------------------------------------------------------------------------

KeyboardShortcut.prototype._createElement = function(window) {
  let keyset = window.document.getElementById("rpcontinuedKeyset");
  let element = window.document.createElement("key");
  element.setAttribute("id", this._elementID);
  element.setAttribute("disabled", "true");
  // "oncommand" (or "command") is required! See
  // https://stackoverflow.com/questions/16779316/how-to-set-an-xul-key-dynamically-and-securely/16786770#16786770
  element.setAttribute("oncommand", "void(0);");
  element.addEventListener("command", this._listeners.onKeyCommand, false);
  keyset.appendChild(element);
};

KeyboardShortcut.prototype._setElementAttributes = function(window) {
  let element = window.document.getElementById(this._elementID);

  element.setAttribute("modifiers", this._elementAttributes.modifiers);
  element.setAttribute("key", this._elementAttributes.key);
  element.setAttribute("disabled", this._elementAttributes.disabled);
};

KeyboardShortcut.prototype._removeElement = function(window) {
  let element = window.document.getElementById(this._elementID);
  element.removeEventListener("command", this._listeners.onKeyCommand, false);
  element.remove();
};

Object.defineProperty(KeyboardShortcut.prototype, "userCombo", {
  get: function() {
    return cachedSettings.get(this._userComboPrefName);
  },
});

Object.defineProperty(KeyboardShortcut.prototype, "userEnabled", {
  get: function() {
    return cachedSettings.get(this._userEnabledPrefName);
  },
});

const ELEMENT_ATTRIBUTES_WHEN_DISABLED = {
  disabled: "true",
  modifiers: "",
  key: "",
};

KeyboardShortcut.prototype._determineElementAttributes = function() {
  if (!this.userEnabled) {
    this._elementAttributes = ELEMENT_ATTRIBUTES_WHEN_DISABLED;
    return;
  }

  let combo = this.userCombo;
  if (combo === "default") {
    combo = this._defaultCombo;
  }
  if (combo === "none") {
    this._elementAttributes = ELEMENT_ATTRIBUTES_WHEN_DISABLED;
    return;
  }

  let rv = XULUtils.keyboardShortcuts.getKeyAttributesFromCombo(combo);
  if (false === rv.success) {
    console.error("Error parsing keyboard combination for shortcut " +
        `"${this._id}": ${rv.errorMessage}`);
    this._elementAttributes = ELEMENT_ATTRIBUTES_WHEN_DISABLED;
    return;
  }
  this._elementAttributes = {
    disabled: "false",
    modifiers: rv.modifiers,
    key: rv.key,
  };
};
