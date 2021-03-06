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
 * This class is used to store localized message for i18n support.
 * Original source code is from Mozilla's Gecko ExtensionCommon.jsm module,
 * and was modified to suite RequestPolicy needs.
 * See https://github.com/mozilla/gecko,
 * gecko/toolkit/components/extensions/ExtensionCommon.jsm
 * revision bc6315c22e6950b7022f6caf8929428399a1499f.
 */

import {CIMap} from "lib/classes/case-insensitive-map";

export class LocaleData {
  public static BUILTIN = "@@BUILTIN_MESSAGES";
  public get BUILTIN() { return LocaleData.BUILTIN; }

  public defaultLocale = "";
  public selectedLocale = "";

  // Map(locale-name -> CIMap(message-key -> localized-string))
  // Contains a key for each loaded locale, each of which is a
  // Map of message keys to their localized strings.
  public messages = new Map<string, CIMap<any>>();

  private warnedMissingKeys = new Set();

  // Representation of the object to send to content processes. This
  // should include anything the content process might need.
  public serialize() {
    return {
      defaultLocale: this.defaultLocale,
      messages: this.messages,
      selectedLocale: this.selectedLocale,
    };
  }

  public has(locale: string) {
    return this.messages.has(locale);
  }

  /**
   * Gets the localized string for the specified message. If the message
   * can't be found in messages.json, returns "" and log an error.
   *
   * https://developer.chrome.com/extensions/i18n
   * Note: Special messages starting with @@ (e.g @@bidi, @@ui_locale)
   * are not supported
   *
   * @param {string} messageName The name of the message, as specified in
   * the messages.json file.
   * @param {any} substitutions string or array of string. A single
   * substitution string, or an array of substitution strings.
   * @return {string} Message localized for current locale.
   */
  public localizeMessage(
      message: string,
      substitutions = [],
      options: any = {},
  ) {
    const defaultOptions = {
      cloneScope: null,
      defaultValue: "",
    };

    let locales = this.availableLocales;
    if (options.locale) {
      locales = new Set([this.BUILTIN, options.locale, this.defaultLocale]
                        .filter((locale: string) => this.messages.has(locale)));
    }

    options = Object.assign(defaultOptions, options);

    // Message names are case-insensitive, so normalize them to lower-case.
    // tslint:disable-next-line:prefer-const
    for (let locale of locales) {
      const messages = this.messages.get(locale)!;
      if (messages.has(message)) {
        const str = messages.get(message);

        if (!str.includes("$")) {
          return str;
        }

        if (!Array.isArray(substitutions)) {
          substitutions = [substitutions];
        }

        const replacer = (
            matched: string,
            index: string,
            dollarSigns: string,
        ) => {
          if (index) {
            // This is not quite Chrome-compatible. Chrome consumes any number
            // of digits following the $, but only accepts 9 substitutions. We
            // accept any number of substitutions.
            const intIndex = parseInt(index, 10) - 1;
            return intIndex in substitutions ? substitutions[intIndex] : "";
          }
          // For any series of contiguous `$`s, the first is dropped, and
          // the rest remain in the output string.
          return dollarSigns;
        };
        return str.replace(/\$(?:([1-9]\d*)|(\$+))/g, replacer);
      }
    }

    if (!this.warnedMissingKeys.has(message)) {
      const error = `Unknown localization message ${message}`;
      console.error(error);
      this.warnedMissingKeys.add(message);
    }
    return options.defaultValue;
  }

  /**
   * Localize a string, replacing all |__MSG_(.*)__| tokens with the
   * matching string from the current local. Should be only used for
   * substitution in HTML files.
   */
  public localize(str?: string, locale = this.selectedLocale) {
    if (!str) {
      return str;
    }

    return str.replace(/__MSG_([A-Za-z0-9@_]+?)__/g, (matched, message) => {
      return this.localizeMessage(message, [], {locale, defaultValue: matched});
    });
  }

  // Validates the contents of a locale JSON file, normalizes the
  // messages into a CIMap of message key -> localized string pairs.
  public addLocale(locale: string, messages: any) {
    const result = new CIMap();

    // eslint-disable-next-line no-extra-parens
    const isPlainObject =
        (obj: any): boolean => (obj && typeof obj === "object");

    // Chrome does not document the semantics of its localization
    // system very well. It handles replacements by pre-processing
    // messages, replacing |$[a-zA-Z0-9@_]+$| tokens with the value of their
    // replacements. Later, it processes the resulting string for
    // |$[0-9]| replacements.
    //
    // Again, it does not document this, but it accepts any number
    // of sequential |$|s, and replaces them with that number minus
    // 1. It also accepts |$| followed by any number of sequential
    // digits, but refuses to process a localized string which
    // provides more than 9 substitutions.
    if (!isPlainObject(messages)) {
      console.error(`Invalid locale data for ${locale}`);
      return result;
    }

    // tslint:disable-next-line:prefer-const
    for (let key of Object.keys(messages)) {
      const msg = messages[key];

      // eslint-disable-next-line no-extra-parens
      if (!isPlainObject(msg) || typeof(msg.message) !== "string") {
        console.error(`Invalid locale message data for ${locale},
          message ${JSON.stringify(key)}`);
        continue;
      }

      // Substitutions are case-insensitive, so normalize all of their names
      // to lower-case.
      const placeholders = new CIMap();
      if (isPlainObject(msg.placeholders)) {
        // tslint:disable-next-line:prefer-const
        for (let key2 of Object.keys(msg.placeholders)) {
          placeholders.set(key2, msg.placeholders[key2]);
        }
      }

      const replacer = (match: string, name: string) => {
        const replacement: any = placeholders.get(name);
        if (isPlainObject(replacement) && "content" in replacement) {
          return replacement.content;
        }
        return "";
      };

      const value = msg.message.replace(/\$([A-Za-z0-9@_]+)\$/g, replacer);

      // Message names are also case-insensitive
      result.set(key, value);
    }

    this.messages.set(locale, result);
    return result;
  }

  get availableLocales() {
    return new Set([this.BUILTIN, this.selectedLocale, this.defaultLocale]
                   .filter((locale: string) => this.messages.has(locale)));
  }
}
