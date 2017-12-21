/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * MIT License
 *
 * Copyright (c) 2016-2017 YUKI "Piro" Hiroshi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * ***** END LICENSE BLOCK *****
 */

 /*
  * Original file from https://github.com/piroor/webextensions-lib-l10n
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
