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

import {defer} from "content/lib/utils/js-utils";
import {LocaleData} from "./locale-data";
import * as ChromeFilesUtils from "bootstrap/lib/utils/chrome-files-utils";
import * as I18nUtils from "./i18n-utils";

/**
 * This object manages loading locales for i18n support.
 */
export class AsyncLocaleData extends LocaleData {
  constructor() {
    super();
    this.dReady = defer();
    this.ready = false;
  }

  get whenReady() {
    return this.dReady.promise;
  }

  /**
   * Return the application locale as a normalized BCP 47 tag.
   *
   * @return {String}
   */
  getAppLocale() {
    let appLocale;
    if (Services.locale.getAppLocaleAsBCP47) {
      appLocale = Services.locale.getAppLocaleAsBCP47();
    } else {
      // Fallback for older version of gecko
      let nsILocale = Services.locale.getApplicationLocale();
      appLocale = nsILocale.getCategory("NSILOCALE_MESSAGES");
    }
    return I18nUtils.normalizeToBCP47(appLocale);
  }

  /**
   * Return a promise which is fullfilled with the value of default_locale
   * indicated in manifest.json as a normalized BCP 47 tag.
   *
   * @return {Promise}
   */
  getDefaultLocale() {
    const manifestUrl = ChromeFilesUtils.getChromeUrl(
      "content/bootstrap/data/manifest.json");

    return ChromeFilesUtils.parseJSON(manifestUrl).then(manifest => {
      if (manifest && manifest.default_locale) {
        let bcp47tag = I18nUtils.normalizeToBCP47(manifest.default_locale);
        return Promise.resolve(bcp47tag);
      } else {
        return Promise.reject(
          new Error("'default_locale' key not found in manifest.json"));
      }
    });
  }

  /**
   * Return Promise which is fullfilled with a Map(bcp-47-tag -> locale-dir)
   * of available locales in the _locales dir of the extension.
   *
   * @return {Promise}
   */
  getAvailableLocales() {
    // During build, a JSON file containing all available locales should be
    // generated.
    const localesListJSON = ChromeFilesUtils.getChromeUrl(
      "content/bootstrap/data/locales.json");

    return ChromeFilesUtils.parseJSON(localesListJSON)
      .then(localesDirNames => {
        return Promise.all(localesDirNames.map(dirName =>
          [I18nUtils.normalizeToBCP47(dirName), dirName]));
      }).then(mapAsArray => new Map(mapAsArray));
  }

  /**
   * Return a Map(bcp-47-tag -> locale-dir) which are the best matches
   * for the requested locales (by the BestAvailableLocale algorithm,
   * see ecma-402, secton 9.2.2 specification).
   *
   * @param {Array} requestedLocales
   * @param {Map} localesMap a (locale-tag -> locale-dir) map
   * @return {Map}
   */
  getBestMatches(requestedLocales, localesMap) {
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
  }

  /**
   * Return a promise which is fullfilled with an array of
   * {bcp-47-tag, messages} loaded from the map passed in argument.
   *
   * @param {Map} localesMap a (bcp-47-tag -> locale-dir) Map
   * @return {Promise}
   */
  loadLocalesMessages(localesMap) {
    return Promise.all(Array.from(localesMap.keys()).map(key => {
      let dir = localesMap.get(key);
      let file = `content/_locales/${dir}/messages.json`;
      const url = ChromeFilesUtils.getChromeUrl(file);

      return ChromeFilesUtils.parseJSON(url).then(messages => {
        return Promise.resolve({"locale": key, "messages": messages});
      });
    }));
  }

  /**
   * Set the locale to used primarly and its fallback according to
   * the best matches found in loaded locales.
   *
   * @param {String} defaultLocale requested default locale tag
   * @param {String} uiLocale requested UI locale tag
   * @return {Object} An object containing the best matches
   */
  updateLocalesPrefs(defaultLocale, uiLocale) {
    let normDefault = I18nUtils.normalizeToBCP47(defaultLocale);
    let normUi = I18nUtils.normalizeToBCP47(uiLocale);

    let loadedTags = Array.from(this.messages.keys()).filter(tag =>
      tag.toLowerCase() !== this.BUILTIN.toLowerCase()).map(tag =>
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
    this.defaultLocale = bestDefault;
    this.selectedLocale = bestUi;

    return {
      selected: bestUi,
      default: bestDefault,
    };
  }

  init() {
    let defaultLocale;
    let uiLocale;

    const p = this.getDefaultLocale()
      .then(result => defaultLocale = result)
      .then(() => uiLocale = this.getAppLocale())
      .then(() => this.getAvailableLocales())
      .then(AllLocales => this.getBestMatches([defaultLocale, uiLocale],
        AllLocales))
      .then(bestMatches => this.loadLocalesMessages(bestMatches))
      .then(localesMessages => Promise.all(localesMessages.map(
        obj => this.addLocale(obj.locale, obj.messages)))
      ).then(() => this.updateLocalesPrefs(defaultLocale, uiLocale))
      .then(() => {
        this.dReady.resolve();
        this.ready = true;
        return;
      });
    p.catch((e) => {
      console.error("LazyLocaleData.init()");
      console.dir(e);
      this.dReady.reject(e);
    });
    return p;
  }
}
