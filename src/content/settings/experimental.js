/* global window, $ */

(function() {
  /* global Components */
  const {utils: Cu} = Components;

  var {ScriptLoader: {importModule}} = Cu.import(
      "chrome://rpcontinued/content/lib/script-loader.jsm", {});
  var {RequestProcessor} = importModule("lib/request-processor");

  //============================================================================

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

    var {nRRAllowed, nRRDenied, nRRTotal, nClickedLinks, nFaviconRequests
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

}());
