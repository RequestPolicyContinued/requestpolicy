/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2008-2012 Justin Samuel
 * Copyright (c) 2014-2015 Martin Kimmerle
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

/* exported DOMUtils */
this.EXPORTED_SYMBOLS = ["DOMUtils"];

//==============================================================================
// DOMUtils
//==============================================================================

var DOMUtils = (function() {
  let self = {};

  /**
   * Function that takes a DOM Element or an Array of DOM elements and removes
   * all their children.
   */
  self.removeChildren = function(aElements) {
    // If aElements is not an Array, put the element in an Array.
    let elements = Array.isArray(aElements) ? aElements : [aElements];
    // Note on `isArray` (above):
    //     using `instanceof` did not work. For details see
    //     https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray

    for (let el of elements) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }
  };

  function isThisElementVisible(aElement) {
    let rects = aElement.getClientRects();
    if (rects.length === 0) {
      return false;
    }
    let rect = rects[0];
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Check if the element and all of its parent elements is visible.
   *
   * @param  {Element} aElement
   * @return {boolean}
   */
  self.isElementVisible = function(aElement) {
    if (!isThisElementVisible(aElement)) {
      return false;
    }
    let parent = aElement.parentElement;
    return parent !== null ? self.isElementVisible(parent) : true;
  };

  return self;
}());
