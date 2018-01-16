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
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
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

import {I18n} from "content/bootstrap/content/models/browser/i18n";

/**
 * Replace all |__MSG_(.*)__| tokens with the matching string from
 * the current locale.
 * Aimed to be used with HTML page.
 */
const MSG_REGEXP = /__MSG_([A-Za-z0-9@_]+?)__/g;

export function matchKeyPattern(aString) {
  // eslint-disable-next-line no-extra-parens
  if (!aString || (typeof aString !== "string"
    && !(aString instanceof String))) {
    return false;
  }
  return MSG_REGEXP.test(aString);
}

export function updateString(aString) {
  return aString.replace(MSG_REGEXP, (matched, message) => {
    return I18n.instance.getMessage(message, [], {defaultValue: matched});
  });
}

export function updateDocument(document) {
  let texts = document.evaluate(
    "descendant::text()[contains(self::text(), \"__MSG_\")]",
    document,
    null,
    7, // XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
    null
  );
  for (let i = 0, maxi = texts.snapshotLength; i < maxi; i++) {
    let text = texts.snapshotItem(i);
    text.nodeValue = updateString(text.nodeValue);
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
    attribute.value = updateString(attribute.value);
  }
}
