/*
license: The MIT License, Copyright (c) 2016-2017 YUKI "Piro" Hiroshi
original:
http://github.com/piroor/webextensions-lib-l10n
*/

/* global document */

/**
 * Replace all |__MSG_(.*)__| tokens with the matching string from
 * the current locale.
 * Aimed to be used with HTML page.
 */
export const l10n = (function() {
  const regexp = /__MSG_([A-Za-z0-9@_]+?)__/g;

  let l10n = {
    matchKeyPattern(aString) {
      // eslint-disable-next-line no-extra-parens
      if (!aString || (typeof aString !== "string"
        && !(aString instanceof String))) {
        return false;
      }
      return regexp.test(aString);
    },

    updateString(aString) {
      return aString.replace(regexp, (matched, message) => {
        return browser.i18n.getMessage(message, [], {defaultValue: matched});
      });
    },

    updateDocument() {
      let texts = document.evaluate(
        "descendant::text()[contains(self::text(), \"__MSG_\")]",
        document,
        null,
        7, // XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
        null
      );
      for (let i = 0, maxi = texts.snapshotLength; i < maxi; i++) {
        let text = texts.snapshotItem(i);
        text.nodeValue = this.updateString(text.nodeValue);
      }

      let attributes = document.evaluate(
        "descendant::*/attribute::*[contains(., \"__MSG_\")]",
        document,
        null,
        7, // XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
        null
      );
      for (let i = 0, maxi = attributes.snapshotLength; i < maxi; i++) {
        let attribute = attributes.snapshotItem(i);
        attribute.value = this.updateString(attribute.value);
      }
    },
  };

  return l10n;
})();
