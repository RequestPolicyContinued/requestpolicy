/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */

// eslint-disable-next-line no-unused-vars
import {JSMs} from "bootstrap/api/interfaces";

const PREF_MATCH_OS_LOCALE = "intl.locale.matchOS";
const PREF_SELECTED_LOCALE = "general.useragent.locale";

// https://dxr.mozilla.org/mozilla-esr45/source/toolkit/mozapps/extensions/AddonManager.jsm#283-308

// eslint-disable-next-line valid-jsdoc
/**
 *
 * @param {JSMs.Services["prefs"]} prefsService
 * @param {JSMs.Services["locale"]} localeService
 * @return {string}
 */
export function getAppLocale(prefsService, localeService) {
  try {
    if (prefsService.getBoolPref(PREF_MATCH_OS_LOCALE)) {
      return localeService.getLocaleComponentForUserAgent();
    }
    // eslint-disable-next-line no-empty
  } catch (e) {}

  try {
    let locale = prefsService.getComplexValue(
        PREF_SELECTED_LOCALE,
        Ci.nsIPrefLocalizedString
    );
    if (locale) return locale.data;
    // eslint-disable-next-line no-empty
  } catch (e) {}

  try {
    return prefsService.getCharPref(PREF_SELECTED_LOCALE);
    // eslint-disable-next-line no-empty
  } catch (e) {}

  return "en-US";
}
