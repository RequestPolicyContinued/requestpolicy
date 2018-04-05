/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */

const PREF_MATCH_OS_LOCALE = "intl.locale.matchOS";
const PREF_SELECTED_LOCALE = "general.useragent.locale";

// https://dxr.mozilla.org/comm-esr45/source/mozilla/toolkit/mozapps/extensions/AddonManager.jsm#283-308

export function getAppLocale() {
  try {
    if (Services.prefs.getBoolPref(PREF_MATCH_OS_LOCALE)) {
      return Services.locale.getLocaleComponentForUserAgent();
    }
    // eslint-disable-next-line no-empty
  } catch (e) {}

  try {
    let locale = Services.prefs.getComplexValue(
        PREF_SELECTED_LOCALE,
        Ci.nsIPrefLocalizedString
    );
    if (locale) return locale.data;
    // eslint-disable-next-line no-empty
  } catch (e) {}

  try {
    return Services.prefs.getCharPref(PREF_SELECTED_LOCALE);
    // eslint-disable-next-line no-empty
  } catch (e) {}

  return "en-US";
}
