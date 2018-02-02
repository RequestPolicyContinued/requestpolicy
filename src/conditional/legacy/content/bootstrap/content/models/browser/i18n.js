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

import {AsyncLocaleData} from "bootstrap/models/browser/i18n/async-locale-data";

export class I18n {
  constructor() {
    this.lLocaleData = new AsyncLocaleData();
  }

  get subModels() {
    return [
      this.lLocaleData,
    ];
  }

  get whenReady() {
    return Promise.all(this.subModels.map(
        (model) => model.whenReady)
    );
  }

  init() {
    const p = Promise.all(this.subModels.map(
        (model) => model.init()
    ));
    p.catch((e) => {
      console.error("I18n init() error:");
      console.dir(e);
    });
    return p;
  }

  get localeData() {
    if (!this.lLocaleData.ready) {
      throw new Error("I18n: localeData is not ready yet!");
    }
    return this.lLocaleData;
  }

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
  getMessage(messageName, substitutions) {
    return this.localeData.localizeMessage(messageName, substitutions);
  }

  /**
   * Gets the UI language of the browser.
   *
   * @return {string} The browser UI language code as a BCP 47 tag.
   */
  getUILanguage() {
    return this.localeData.getAppLocale();
  }
}

export class ContentI18n {
  constructor(i18n) {
    this.i18n = i18n;
  }

  getMessage(...args) {
    return this.i18n.getMessage(...args);
  }
  getAcceptLanguages() {
    return null;
  }
  getUILanguage(...args) {
    return this.i18n.getUILanguage(...args);
  }
  detectLanguage() {
    return null;
  }
}
