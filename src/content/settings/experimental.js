/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * RequestPolicy - A Firefox extension for control over cross-site requests.
 * Copyright (c) 2016 Martin Kimmerle
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

(function() {
  var {RequestProcessor} = browser.extension.getBackgroundPage();

  // ===========================================================================

  function getNRequestResultObjects(aRequestSet) {
    var n = 0;
    var origins = aRequestSet._origins;
    for (var originURI in origins) {
      var originUriRequests = origins[originURI];
      for (var destBase in originUriRequests) {
        var destBaseRequests = originUriRequests[destBase];
        for (var destIdent in destBaseRequests) {
          var destIdentRequests = destBaseRequests[destIdent];
          for (var destURI in destIdentRequests) {
            var destUriRequests = destIdentRequests[destURI];
            n += Object.getOwnPropertyNames(destUriRequests).length;
          }
        }
      }
    }
    return n;
  }

  function getMemoryInfo() {
    var nRRAllowed = getNRequestResultObjects(
        RequestProcessor._allowedRequests);
    var nRRDenied = getNRequestResultObjects(
        RequestProcessor._rejectedRequests);
    return {
      nRRAllowed: nRRAllowed,
      nRRDenied: nRRDenied,
      nRRTotal: nRRAllowed + nRRDenied,
      nClickedLinks: Object.
          getOwnPropertyNames(RequestProcessor.clickedLinks).length,
      nFaviconRequests: Object.
          getOwnPropertyNames(RequestProcessor.faviconRequests).length,
    };
  }

  /**
   * Delete all own properties of an object.
   *
   * @param {Object} obj
   */
  function deleteOwnProperties(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        delete obj[key];
      }
    }
  }

  function freeMemory() {
    var memoryInfo = getMemoryInfo();

    deleteOwnProperties(RequestProcessor._allowedRequests._origins);
    deleteOwnProperties(RequestProcessor._rejectedRequests._origins);
    deleteOwnProperties(RequestProcessor.clickedLinks);
    deleteOwnProperties(RequestProcessor.clickedLinksReverse);
    deleteOwnProperties(RequestProcessor.faviconRequests);

    return memoryInfo;
  }

  window.onload = function() {
    var info = $("#memory-information");
    info.html("Some numbers:");
    var list = $("<ul>");
    info.append(list);

    var {nRRAllowed, nRRDenied, nRRTotal, nClickedLinks, nFaviconRequests,
        } = getMemoryInfo();
    list.append("<li>RequestResult objects: " + nRRTotal +
        " (" + nRRAllowed + " allowed requests, " +
        nRRDenied + " denied requests)</li>");
    list.append("<li>Clicked links: " + nClickedLinks + "</li>");
    list.append("<li>Favicon requests: " + nFaviconRequests + "</li>");
  };

  window.freeMemory = function() {
    var results = $("#free-memory-results");
    results.html("<br />Starting to free memory... ");

    var {nRRTotal, nClickedLinks, nFaviconRequests} = freeMemory();

    results.append(" DONE.<br />Successfully removed...");
    var list = $("<ul>");
    results.append(list);
    list.append("<li>" + nRRTotal + " RequestResult objects</li>");
    list.append("<li>" + nClickedLinks + " clicked links</li>");
    list.append("<li>" + nFaviconRequests + " favicon requests</li>");
  };
})();
