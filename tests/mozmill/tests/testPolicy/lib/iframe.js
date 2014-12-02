/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";

var {DefaultPolicyManager} = require("default-policy-iterator");
var {DomainUtil} = require(rpRootDir + "lib/domain-util");

function Iframe(aIframe) {
  // wait for the iframe to be loaded
  findElement.Elem(aIframe).waitForElement();

  this.ownerDoc = aIframe.ownerDocument;
  this.iframeDoc = aIframe.contentDocument;
  assert.ok(this.iframeDoc, 'iframe #'+aIframe.id+ ' has a content document.');

  this.ownerHostname = this.ownerDoc.location.hostname;
  this.iframeDocHostname = this.iframeDoc.location.hostname;
  // extract hostname from the "src" attribute
  this.iframeSrcHostname = /^http:\/\/([^/]+)\//.exec(aIframe.src)[1];
}
Iframe.prototype.getContentDocument = function() {
  return this.iframeDoc;
};
Iframe.prototype.isAllowedByCurrentPref = function() {
  return DefaultPolicyManager.isDefaultAllow() ||
      DomainUtil.isSameDomain(this.ownerHostname, this.iframeSrcHostname) ||
      (DomainUtil.isSameBaseDomain(this.ownerHostname, this.iframeSrcHostname) &&
          DefaultPolicyManager.isInterSubdomainAllowed());
};
Iframe.prototype.hasIframeRequestBeenAllowed = function() {
  return this.iframeSrcHostname == this.iframeDocHostname;
};
Iframe.prototype.doChecks = function() {
  var hasRequestBeenAllowed = this.hasIframeRequestBeenAllowed();
  var shouldRequestHaveBeenAllowed = this.isAllowedByCurrentPref();

  var text = "iframe with location '" + this.iframeSrcHostname + "' on '" +
      this.ownerHostname + "' has " +
      (shouldRequestHaveBeenAllowed ? "" : "not ") + "been loaded.";
  assert.ok(hasRequestBeenAllowed === shouldRequestHaveBeenAllowed, text);
};
Iframe.prototype.accumulateNumRequests = function(numRequestCounter) {
  let isAllowed = this.hasIframeRequestBeenAllowed();
  numRequestCounter.accumulate(this.ownerHostname, this.iframeSrcHostname, 1,
      isAllowed);
  //if (isAllowed) {
  //  NumRequestsCounter.accumulateAdditionalRequestsToSamedomain(doc);
  //}
};


function* allIframesOnDocument(doc) {
  var iframes = doc.getElementsByTagName("iframe");
  for (var i = 0, len = iframes.length; i < len; ++i) {
    let iframe = new Iframe(iframes[i]);

    yield iframe;

    // continue only if the request has been allowed,
    //   in other words: if the iframe has been loaded.
    if (iframe.hasIframeRequestBeenAllowed()) {
      yield* allIframesOnDocument(iframe.getContentDocument());
    }
  }
}

function* recursivelyGetAllDocs(aDoc) {
  yield aDoc;

  for (let iframe of allIframesOnDocument(aDoc)) {
    if (iframe.hasIframeRequestBeenAllowed()) {
      yield* recursivelyGetAllDocs(iframe.getContentDocument());
    }
  }
}

function* recursivelyGetAllDOMNodesWithRequests(aDoc) {
  for (let doc of allIframesOnDocument(aDoc)) {
    for (let node of doc.querySelectorAll("[src]")) {
      yield node;
    }
  }
}

exports.Iframe = Iframe;
exports.allIframesOnDocument = allIframesOnDocument;
exports.recursivelyGetAllDocs = recursivelyGetAllDocs;
exports.recursivelyGetAllDOMNodesWithRequests =
    recursivelyGetAllDOMNodesWithRequests;
