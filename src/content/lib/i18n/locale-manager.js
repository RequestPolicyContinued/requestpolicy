/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */

/**
 * This object is used to manage localization for i18n support.
 * Original source code is from Mozilla's Gecko Extension.jsm module,
 * and was modified to suite RequestPolicy needs.
 * See https://github.com/mozilla/gecko,
 * gecko/toolkit/components/extensions/Extension.jsm
 * revision 6991a6334725aabee674e17a2f4f01dc508e4d52.
 */

 /* global Services */

import {LocaleData} from "content/lib/i18n/locale-data";
import {ChromeFilesUtils} from "content/lib/utils/chrome-files";
import {I18nUtils} from "content/lib/i18n/i18n-utils";


export const LocaleManager = (function() {
  let self = {
    localeData: new LocaleData(),
    init: null,
  };

  /**
   * Return the application locale as a normalized BCP 47 tag.
   *
   * @return {String}
   */
  self.getAppLocale = function() {
    let appLocale;
    if (Services.locale.getAppLocaleAsBCP47) {
      appLocale = Services.locale.getAppLocaleAsBCP47();
    } else {
      // Fallback for older version of gecko
      let nsILocale = Services.locale.getApplicationLocale();
      appLocale = nsILocale.getCategory("NSILOCALE_MESSAGES");
    }
    return I18nUtils.normalizeToBCP47(appLocale);
  },

  /**
   * Return Promise which is fullfilled with a Map(bcp-47-tag -> locale-dir)
   * of available locales in the _locales dir of the extension.
   *
   * @return {Promise}
   */
  self.getAvailableLocales = function() {
    // During build, a JSON file containing all available locales should be
    // generated.
    const localesListJSON = ChromeFilesUtils.getChromeUrl(
      "content/bootstrap/data/locales.json");

    return ChromeFilesUtils.parseJSON(localesListJSON)
      .then(localesDirNames => {
        return Promise.all(localesDirNames.map(dirName =>
          [I18nUtils.normalizeToBCP47(dirName), dirName]));
      }).then(mapAsArray => new Map(mapAsArray));
  };

  /**
   * Return a Map(bcp-47-tag -> locale-dir) which are the best matches
   * for the requested locales (by the BestAvailableLocale algorithm,
   * see ecma-402, secton 9.2.2 specification).
   *
   * @param {Array} requestedLocales
   * @param {Map} localesMap a (locale-tag -> locale-dir) map
   * @return {Map}
   */
  self.getBestMatches = function(requestedLocales, localesMap) {
    let matchesSet = new Set();
    let localesTag = Array.from(localesMap.keys());
    for (let locale of requestedLocales) {
      let normTag = I18nUtils.normalizeToBCP47(locale);
      let matchTag = I18nUtils.getBestAvailableLocale(localesTag, normTag);
      if (matchTag) {
        matchesSet.add(matchTag);
      }
    }
    let result = new Map();
    for (let key of matchesSet) {
      result.set(key, localesMap.get(key));
    }
    return result;
  };

  /**
   * Return a promise which is fullfilled with an array of
   * {bcp-47-tag, messages} loaded from the map passed in argument.
   *
   * @param {Map} localesMap a (bcp-47-tag -> locale-dir) Map
   * @return {Promise}
   */
  self.loadLocalesMessages = function(localesMap) {
    return Promise.all(Array.from(localesMap.keys()).map(key => {
      let dir = localesMap.get(key);
      let file = `content/_locales/${dir}/messages.json`;
      const url = ChromeFilesUtils.getChromeUrl(file);

      return ChromeFilesUtils.parseJSON(url).then(messages => {
        return Promise.resolve({"locale": key, "messages": messages});
      });
    }));
  };

  /**
   * Set the locale to used primarly and its fallback according to
   * the best matches found in loaded locales.
   *
   * @param {String} defaultLocale requested default locale tag
   * @param {String} uiLocale requested UI locale tag
   * @return {Object} An object containing the best matches
   */
  self.updateLocalesPrefs = function(defaultLocale, uiLocale) {
    let normDefault = I18nUtils.normalizeToBCP47(defaultLocale);
    let normUi = I18nUtils.normalizeToBCP47(uiLocale);

    let loadedTags = Array.from(this.localeData.messages.keys()).filter(tag =>
      tag.toLowerCase() !== this.localeData.BUILTIN.toLowerCase()).map(tag =>
      I18nUtils.normalizeToBCP47(tag));

    let bestDefault = I18nUtils.getBestAvailableLocale(loadedTags, normDefault);
    if (!bestDefault) {
      throw new Error("Can't find a locale matching the default locale "
        + `'${defaultLocale}'`);
    }

    let bestUi = I18nUtils.getBestAvailableLocale(loadedTags, normUi);
    if (!bestUi) {
      // If a match isn't found, we put the real ui locale code. In fact it
      // doesn't matter which value we set because defaultLocale will be used
      bestUi = normUi;
    }
    this.localeData.defaultLocale = bestDefault;
    this.localeData.selectedLocale = bestUi;

    return {
      selected: bestUi,
      default: bestDefault,
    };
  };

  self.init = function() {
    const defaultLocale = I18nUtils.normalizeToBCP47("en-US");
    const uiLocale = this.getAppLocale();
    const requestedLocales = [defaultLocale, uiLocale];

    return this.getAvailableLocales()
      .then(AllLocales => this.getBestMatches(requestedLocales, AllLocales))
      .then(bestMatches => this.loadLocalesMessages(bestMatches))
      .then(localesMessages => Promise.all(localesMessages.map(
        obj => this.localeData.addLocale(obj.locale, obj.messages)))
      ).then(() => this.updateLocalesPrefs(defaultLocale, uiLocale));
  };

  /**
   * Gets the localized string for the specified message. If the message
   * can't be found in messages.json, returns "" and log an error.
   *
   * @param {string} messageName The name of the message, as specified in
   * the messages.json file.
   * @param {any} substitutions string or array of string. A single
   * substitution string, or an array of substitution strings.
   * @return {string} Message localized for current locale.
   */
  self.localizeMessage = function(messageName, substitutions) {
    return this.localeData.localizeMessage(messageName, substitutions);
  };

  /**
   * Localize a string, replacing all |__MSG_(.*)__| tokens with the
   * matching string from the current local. Should be only used for
   * substitution in HTML files.
   *
   * @param {string} str __MSG_(<message_name>)__
   * @return {string} String localized for current locale.
   */
  self.localize = function(str) {
    return this.localeData.localize(str);
  };

  return self;
})();
