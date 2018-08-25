/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008 Justin Samuel
 * Copyright (c) 2014 Martin Kimmerle
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

/**
 * Remove all children of one or more DOM element.
 */
export function removeChildren(aElements: Element | Element[]) {
  // If aElements is not an Array, put the element in an Array.
  const elements = Array.isArray(aElements) ? aElements : [aElements];
  // Note on `isArray` (above):
  //     using `instanceof` did not work. For details see
  // tslint:disable-next-line:max-line-length
  //     https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray

  for (const el of elements) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }
}

function isThisElementVisible(aElement: Element) {
  if (!aElement || !aElement.getClientRects) {
    return false;
  }
  const rects = aElement.getClientRects();
  if (rects.length === 0) {
    return false;
  }
  const rect = rects[0];
  return rect.width > 0 && rect.height > 0;
}

/**
 * Check if the element and all of its parent elements is visible.
 */
export function isElementVisible(aElement: Element): boolean {
  if (!isThisElementVisible(aElement)) {
    return false;
  }
  const parent = aElement.parentElement;
  return parent !== null ? isElementVisible(parent) : true;
}
