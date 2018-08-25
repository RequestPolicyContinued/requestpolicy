/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2014 Martin Kimmerle
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

export interface IKeyAttributes {
  success: true;
  key: string;
  modifiers: string;
}

export interface IError {
  success: false;
  errorMessage: string;
}

import { arrayIncludes } from "lib/utils/js-utils";

// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Attribute/modifiers
// See also the SDK Hotkeys API
// https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/hotkeys
const VALID_MODIFIERS = [
  "shift",
  "alt",
  "meta",
  "control",
  "accel",
];

function error(msg: string): IError {
  return {success: false, errorMessage: msg};
}

function success<T extends {success?: boolean}>(returnValue: T) {
  returnValue.success = true;
  return returnValue as T & {success: true};
}

function isValidModifier(aModifier: string) {
  return arrayIncludes(VALID_MODIFIERS, aModifier);
}

const keyRegEx = /^[a-z]$/;

/**
 * Check if the <key modifiers="..."> string is valid.
 */
export function getKeyAttributesFromCombo(
    aCombo: string,
): IError | IKeyAttributes {
  if (typeof aCombo !== "string") {
    return error("Not a string!");
  }
  if (aCombo === "") {
    return error("The string must not be empty.");
  }

  const parts = aCombo.split(" ");
  // Take the last element as the key
  const key = parts.slice(-1)[0];
  // Take all elements except the last one as the modifiers.
  let modifiers = parts.slice(0, -1);
  // Remove duplicates
  modifiers = [...new Set(modifiers)];

  for (const modifier of modifiers) {
    if (false === isValidModifier(modifier)) {
      return error(`Invalid modifier: "${modifier}"`);
    }
  }

  if (!keyRegEx.test(key)) {
    return error(`Invalid key: "${key}"`);
  }

  return success({
    key,
    modifiers: modifiers.join(" "),
    success: undefined,
  });
}
