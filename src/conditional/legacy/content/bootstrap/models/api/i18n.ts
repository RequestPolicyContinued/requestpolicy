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

import * as L10nUtils from "bootstrap/lib/utils/l10n-utils";
import {Module} from "lib/classes/module";
import {AsyncLocaleData} from "./i18n/async-locale-data";

export class I18n extends Module {
  protected moduleName = "i18n";
  protected subModules = {
    localeData: new AsyncLocaleData(),
  };

  public get backgroundApi() {
    return {
      getMessage: this.getMessage.bind(this),
      getUILanguage: this.getUILanguage.bind(this),
    };
  }

  public get contentApi() {
    const api = this.backgroundApi;
    return {
      getMessage: api.getMessage,
      getUILanguage: api.getUILanguage,
    };
  }

  get legacyApi() {
    return {
      matchKeyPattern: L10nUtils.matchKeyPattern.bind(this),
      updateDocument: L10nUtils.updateDocument.bind(null, this),
      updateString: L10nUtils.updateString.bind(null, this),
    };
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
  public getMessage(messageName: string, substitutions: any) {
    return this.subModules.localeData.
        localizeMessage(messageName, substitutions);
  }

  /**
   * Gets the UI language of the browser.
   *
   * @return {string} The browser UI language code as a BCP 47 tag.
   */
  public getUILanguage() {
    return this.subModules.localeData.getAppLocale();
  }
}
