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

import {CIMap} from "content/lib/classes/case-insensitive-map";

export function LocaleData() {
  this.defaultLocale = "";
  this.selectedLocale = "";
  this.warnedMissingKeys = new Set();

  // Map(locale-name -> CIMap(message-key -> localized-string))
  // Contains a key for each loaded locale, each of which is a
  // Map of message keys to their localized strings.
  this.messages = new Map();
}

LocaleData.prototype = {
  // Representation of the object to send to content processes. This
  // should include anything the content process might need.
  serialize() {
    return {
      defaultLocale: this.defaultLocale,
      selectedLocale: this.selectedLocale,
      messages: this.messages,
    };
  },

  BUILTIN: "@@BUILTIN_MESSAGES",

  has(locale) {
    return this.messages.has(locale);
  },

  // https://developer.chrome.com/extensions/i18n
  // Note: Special messages starting with @@ (e.g @@bidi, @@ui_locale)
  // are not supported
  localizeMessage(message, substitutions = [], options = {}) {
    let defaultOptions = {
      defaultValue: "",
      cloneScope: null,
    };

    let locales = this.availableLocales;
    if (options.locale) {
      locales = new Set([this.BUILTIN, options.locale, this.defaultLocale]
                        .filter(locale => this.messages.has(locale)));
    }

    options = Object.assign(defaultOptions, options);

    // Message names are case-insensitive, so normalize them to lower-case.
    for (let locale of locales) {
      let messages = this.messages.get(locale);
      if (messages.has(message)) {
        let str = messages.get(message);

        if (!str.includes("$")) {
          return str;
        }

        if (!Array.isArray(substitutions)) {
          substitutions = [substitutions];
        }

        let replacer = (matched, index, dollarSigns) => {
          if (index) {
            // This is not quite Chrome-compatible. Chrome consumes any number
            // of digits following the $, but only accepts 9 substitutions. We
            // accept any number of substitutions.
            index = parseInt(index, 10) - 1;
            return index in substitutions ? substitutions[index] : "";
          }
          // For any series of contiguous `$`s, the first is dropped, and
          // the rest remain in the output string.
          return dollarSigns;
        };
        return str.replace(/\$(?:([1-9]\d*)|(\$+))/g, replacer);
      }
    }

    if (!this.warnedMissingKeys.has(message)) {
      let error = `Unknown localization message ${message}`;
      console.error(error);
      this.warnedMissingKeys.add(message);
    }
    return options.defaultValue;
  },

  // Localize a string, replacing all |__MSG_(.*)__| tokens with the
  // matching string from the current locale, as determined by
  // |this.selectedLocale|.
  //
  // This may not be called before calling either |initLocale| or
  // |initAllLocales|.
  localize(str, locale = this.selectedLocale) {
    if (!str) {
      return str;
    }

    return str.replace(/__MSG_([A-Za-z0-9@_]+?)__/g, (matched, message) => {
      return this.localizeMessage(message, [], {locale, defaultValue: matched});
    });
  },

  // Validates the contents of a locale JSON file, normalizes the
  // messages into a CIMap of message key -> localized string pairs.
  addLocale(locale, messages) {
    let result = new CIMap();

    // eslint-disable-next-line no-extra-parens
    let isPlainObject = obj => (obj && typeof obj === "object");

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

    for (let key of Object.keys(messages)) {
      let msg = messages[key];

      // eslint-disable-next-line no-extra-parens
      if (!isPlainObject(msg) || typeof(msg.message) !== "string") {
        console.error(`Invalid locale message data for ${locale},
          message ${JSON.stringify(key)}`);
        continue;
      }

      // Substitutions are case-insensitive, so normalize all of their names
      // to lower-case.
      let placeholders = new CIMap();
      if (isPlainObject(msg.placeholders)) {
        for (let key of Object.keys(msg.placeholders)) {
          placeholders.set(key, msg.placeholders[key]);
        }
      }

      let replacer = (match, name) => {
        let replacement = placeholders.get(name);
        if (isPlainObject(replacement) && "content" in replacement) {
          return replacement.content;
        }
        return "";
      };

      let value = msg.message.replace(/\$([A-Za-z0-9@_]+)\$/g, replacer);

      // Message names are also case-insensitive
      result.set(key, value);
    }

    this.messages.set(locale, result);
    return result;
  },

  get availableLocales() {
    return new Set([this.BUILTIN, this.selectedLocale, this.defaultLocale]
                   .filter(locale => this.messages.has(locale)));
  },
};
