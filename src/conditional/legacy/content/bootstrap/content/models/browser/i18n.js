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

import {LocaleManager} from "./i18n/locale-manager";

export class I18n {
  static get instance() {
    if (!I18n._instance) {
      I18n._instance = new I18n();
    }
    return I18n._instance;
  }

  constructor() {
    LocaleManager.instance.init().catch(e => {
      console.error("[Fatal] Unable to prepare locales manager! Details:");
      console.dir(e);
    });
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
    return LocaleManager.instance.localizeMessage(messageName, substitutions);
  }

  /**
   * Gets the UI language of the browser.
   *
   * @return {string} The browser UI language code as a BCP 47 tag.
   */
  getUILanguage() {
    return LocaleManager.instance.getAppLocale();
  }
}

export class ContentI18n {
  static get instance() {
    if (!this._instance) {
      this._instance = new ContentI18n();
    }
    return this._instance;
  }

  getMessage(...args) {
    return I18n.instance.getMessage(...args);
  }
  getAcceptLanguages() {
    return null;
  }
  getUILanguage(...args) {
    return I18n.instance.getUILanguage(...args);
  }
  detectLanguage() {
    return null;
  }
}
