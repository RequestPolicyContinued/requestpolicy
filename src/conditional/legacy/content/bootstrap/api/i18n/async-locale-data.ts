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

import { API, JSMs } from "bootstrap/api/interfaces";
import { MaybePromise } from "lib/classes/maybe-promise";
import { IModule } from "lib/classes/module";
import {defer} from "lib/utils/js-utils";
import * as I18nUtils from "./i18n-utils";
import {LocaleData} from "./locale-data";

/**
 * This object manages loading locales for i18n support.
 */
export class AsyncLocaleData extends LocaleData implements IModule {
  private dReady = defer();

  constructor(
      private tryCatchUtils: API.ITryCatchUtils,
      private chromeFileService: API.services.IChromeFileService,
      private mozServices: JSMs.Services,
  ) {
    super();
  }

  public get whenReady() {
    return this.dReady.promise;
  }

  /**
   * Return the application locale as a normalized BCP 47 tag.
   *
   * @return {String}
   */
  public getAppLocale() {
    const appLocale = this.tryCatchUtils.getAppLocale(
        this.mozServices.prefs,
        this.mozServices.locale,
    );
    return I18nUtils.normalizeToBCP47(appLocale);
  }

  /**
   * Return a promise which is fullfilled with the value of default_locale
   * indicated in manifest.json as a normalized BCP 47 tag.
   *
   * @return {Promise}
   */
  public getDefaultLocale() {
    const manifestUrl = this.chromeFileService.getChromeUrl(
        "bootstrap-data/manifest.json",
    );

    return this.chromeFileService.parseJSON(manifestUrl).then((manifest) => {
      if (manifest && manifest.default_locale) {
        const bcp47tag = I18nUtils.normalizeToBCP47(manifest.default_locale);
        return Promise.resolve(bcp47tag);
      } else {
        return Promise.reject(
            new Error("'default_locale' key not found in manifest.json"),
        );
      }
    });
  }

  /**
   * Return Promise which is fullfilled with a Map(bcp-47-tag -> locale-dir)
   * of available locales in the _locales dir of the extension.
   *
   * @return {Promise}
   */
  public getAvailableLocales() {
    // During build, a JSON file containing all available locales should be
    // generated.
    const localesListJSON = this.chromeFileService.getChromeUrl(
        "bootstrap-data/locales.json",
    );

    return this.chromeFileService.parseJSON(
        localesListJSON,
    ).then((localesDirNames: string[]) => Promise.all(
        localesDirNames.map((dirName) => [
          I18nUtils.normalizeToBCP47(dirName),
          dirName,
        ]) as Array<[string, string]>,
    )).then((mapAsArray) => new Map(mapAsArray));
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
  public getBestMatches(
      requestedLocales: string[],
      localesMap: Map<string, string>,
  ) {
    const matchesSet = new Set();
    const localesTag = Array.from(localesMap.keys());
    for (const locale of requestedLocales) {
      const normTag = I18nUtils.normalizeToBCP47(locale);
      const matchTag = I18nUtils.getBestAvailableLocale(localesTag, normTag);
      if (matchTag) {
        matchesSet.add(matchTag);
      }
    }
    const result = new Map();
    for (const key of matchesSet) {
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
  public loadLocalesMessages(localesMap: Map<string, string>) {
    return Promise.all(Array.from(localesMap.keys()).map((key) => {
      const dir = localesMap.get(key);
      const file = `_locales/${dir}/messages.json`;
      const url = this.chromeFileService.getChromeUrl(file);

      return this.chromeFileService.parseJSON(url).then(
          (messages) => Promise.resolve({locale: key, messages}),
      );
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
  public updateLocalesPrefs(defaultLocale: string, uiLocale: string) {
    const normDefault = I18nUtils.normalizeToBCP47(defaultLocale);
    const normUi = I18nUtils.normalizeToBCP47(uiLocale);

    const loadedTags = Array.from(this.messages.keys()).
        filter((tag) => tag.toLowerCase() !== this.BUILTIN.toLowerCase()).
        map((tag) => I18nUtils.normalizeToBCP47(tag));

    const bestDefault = I18nUtils.
        getBestAvailableLocale(loadedTags, normDefault);
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
      default: bestDefault,
      selected: bestUi,
    };
  }

  public startup() {
    let defaultLocale: string;
    let uiLocale: string;

    const p = this.getDefaultLocale().
        then((result) => defaultLocale = result).
        then(() => uiLocale = this.getAppLocale()).
        then(() => this.getAvailableLocales()).
        then((AllLocales) => this.getBestMatches(
            [defaultLocale, uiLocale],
            AllLocales,
        )).
        then((bestMatches) => this.loadLocalesMessages(bestMatches)).
        then((localesMessages) => Promise.all(
            localesMessages.map(
                (obj) => this.addLocale(obj.locale, obj.messages),
            ),
        )).then(() => this.updateLocalesPrefs(defaultLocale, uiLocale)).
        then(() => {
          this.dReady.resolve(undefined);
          return;
        });
    p.catch((e) => {
      console.error("LazyLocaleData.startup()");
      console.dir(e);
      this.dReady.reject(e);
    });
    return MaybePromise.resolve(p);
  }
}
