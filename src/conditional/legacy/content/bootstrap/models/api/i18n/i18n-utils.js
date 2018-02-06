/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2017 Jérard Devarulrajah
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

import {Intl as IntlPolyfill} from "content/lib/polyfills/intl/8.intl";

/**
 * Convert a Chrome-compatible locale code to the appropriate
 * BCP 47 lower-cased and canonical tag. Converting into BCP 47 currently
 * means to simply replace underscores with hyphens.
 *
 * @param {string} tag a Chrome-compatible locale code
 * @return {string}
 */
export function normalizeToBCP47(tag) {
  let bcpTag = tag.replace(/_/g, "-");
  let canonicalList = IntlPolyfill.getCanonicalLocales(bcpTag);
  let result = canonicalList[0];
  return result.toLowerCase();
}

/**
 * Returns either the longest non-empty prefix of locale that is an
 * element of availableLocales, or undefined if there is no such element.
 * It uses the fallback mechanism of RFC 4647, section 3.4.
 * see https://ecma-international.org/ecma-402/#sec-bestavailablelocale
 *
 * @param {Array} availableLocales list of BCP 47 tags of available locales
 * @param {String} locale canonicalized BCP 47 tag of requested locale
 * @return {String} Best match BCP 47 tag
 */
export function getBestAvailableLocale(availableLocales, locale) {
  let lcAvailable = availableLocales.map((l) => l.toLowerCase());

  if (lcAvailable.indexOf(locale.toLowerCase()) !== -1) {
    return locale;
  } else {
    let pos = locale.lastIndexOf("-");
    if (pos === -1) {
      return undefined;
    } else {
      if (pos >= 2 && locale.charAt(pos - 2) === "-") {
        pos -= 2;
      }
      let candidate = locale.substring(0, pos);
      return getBestAvailableLocale(availableLocales, candidate);
    }
  }
}
