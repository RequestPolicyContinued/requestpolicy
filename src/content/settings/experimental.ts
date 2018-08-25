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

import { RequestSet } from "lib/classes/request-set";
import { BackgroundPage } from "main";

(() => {
  const {
    rp,
  } = (browser.extension.getBackgroundPage() as any) as typeof BackgroundPage;
  const {metadataMemory, requestMemory} = rp.webRequest;

  // ===========================================================================

  function getNRequestResultObjects(aRequestSet: RequestSet) {
    let n = 0;
    const origins = aRequestSet.origins;
    // tslint:disable:forin
    for (const originURI in origins) {
      const originUriRequests = origins[originURI];
      for (const destBase in originUriRequests) {
        const destBaseRequests = originUriRequests[destBase];
        for (const destIdent in destBaseRequests) {
          const destIdentRequests = destBaseRequests[destIdent];
          for (const destURI in destIdentRequests) {
            const destUriRequests = destIdentRequests[destURI];
            n += Object.getOwnPropertyNames(destUriRequests).length;
          }
        }
      }
    }
    return n;
  }

  function getMemoryInfo() {
    const nRRAllowed = getNRequestResultObjects(
        requestMemory.requestSets.allowedRequests,
    );
    const nRRDenied = getNRequestResultObjects(
        requestMemory.requestSets.rejectedRequests,
    );
    return {
      nClickedLinks: Object.
          getOwnPropertyNames(metadataMemory.ClickedLinks).length,
      nFaviconRequests: Object.
          getOwnPropertyNames(metadataMemory.FaviconRequests).length,
      nRRAllowed,
      nRRDenied,
      nRRTotal: nRRAllowed + nRRDenied,
    };
  }

  /**
   * Delete all own properties of an object.
   */
  function deleteOwnProperties(obj: any) {
    /* eslint-disable no-param-reassign */
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        delete obj[key];
      }
    }
  }

  function freeMemory() {
    const memoryInfo = getMemoryInfo();

    deleteOwnProperties(requestMemory.requestSets.allowedRequests.origins);
    deleteOwnProperties(requestMemory.requestSets.rejectedRequests.origins);
    deleteOwnProperties(metadataMemory.ClickedLinks);
    deleteOwnProperties(metadataMemory.ClickedLinksReverse);
    deleteOwnProperties(metadataMemory.FaviconRequests);

    return memoryInfo;
  }

  window.onload = () => {
    const info = $("#memory-information");
    info.html("Some numbers:");
    const list = $("<ul>");
    info.append(list);

    const {nRRAllowed, nRRDenied, nRRTotal, nClickedLinks, nFaviconRequests,
    } = getMemoryInfo();
    list.append(`<li>RequestResult objects: ${nRRTotal
    } (${nRRAllowed} allowed requests, ${
      nRRDenied} denied requests)</li>`);
    list.append(`<li>Clicked links: ${nClickedLinks}</li>`);
    list.append(`<li>Favicon requests: ${nFaviconRequests}</li>`);
  };

  (window as any).freeMemory = () => {
    const results = $("#free-memory-results");
    results.html("<br />Starting to free memory... ");

    const {nRRTotal, nClickedLinks, nFaviconRequests} = freeMemory();

    results.append(" DONE.<br />Successfully removed...");
    const list = $("<ul>");
    results.append(list);
    list.append(`<li>${nRRTotal} RequestResult objects</li>`);
    list.append(`<li>${nClickedLinks} clicked links</li>`);
    list.append(`<li>${nFaviconRequests} favicon requests</li>`);
  };
})();
