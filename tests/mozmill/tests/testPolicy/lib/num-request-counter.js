/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var {assert, expect} = require(rootDir + "lib/assertions");
var rpUtils = require(rpRootDir + "lib/rp-utils");



function NumRequestsCounter(controller) {
  let counter = {};

  let self = this;

  let rpcMenuButton = findElement.ID(controller.window.document,
                                    'rpcontinuedToolbarButton');
  let rpcMenuPopup = findElement.ID(controller.window.document, 'rpc-popup');


  function initOriginAndDest(originHostname, destHostname) {
    counter.$total = counter.$total ||
        {allowed: 0, denied: 0, $total: 0};
    counter[originHostname] = counter[originHostname] ||
        {$total: {allowed: 0, denied: 0, $total: 0}};
    counter[originHostname][destHostname] = counter[originHostname][destHostname] ||
        {allowed: 0, denied: 0, $total: 0};
  }

  self.accumulate = function(originHostname, destHostname, numRequestsToAdd,
      isAllowed) {
    let action = isAllowed ? 'allowed' : 'denied';

    initOriginAndDest(originHostname, destHostname);

    numRequestsToAdd = parseInt(numRequestsToAdd);

    counter[originHostname][destHostname][action] += numRequestsToAdd;
    counter[originHostname][destHostname].$total += numRequestsToAdd;
    counter[originHostname].$total[action] += numRequestsToAdd;
    counter[originHostname].$total.$total += numRequestsToAdd;
    counter.$total[action] += numRequestsToAdd;
    counter.$total.$total += numRequestsToAdd;
  };

  self.accumulateNonIframeRequests = function(doc) {
    var element = rpUtils.getElementById(doc,
                                         'num-additional-samedomain-requests');
    var numRequestsToAdd = element.textContent;
    var hostname = doc.location.hostname;

    self.accumulate(hostname, hostname, numRequestsToAdd, true);
  };

  self.reset = function() {
    counter = {};
  };

  self.checkIfIsCorrect = function() {
    // open the menu
    rpcMenuButton.click();
    rpcMenuPopup.waitForElement();

    {
      let rpOriginNumReq = rpUtils.getElementById(controller.window.document,
                                                  "rp-origin-num-requests");
      let total = counter.$total.$total;
      let totalAllow = counter.$total.allowed;
      let totalDeny = counter.$total.denied;

      let re = /^\s*([0-9]+)\s*(?:\(\s*([0-9]+)\s*\+\s*([0-9]+)\s*\))?\s*$/;
      let reResult = re.exec(rpOriginNumReq.value);
      assert.ok(reResult !== null, "The numRequests field of #rp-origin " +
                "has the correct format, either 'num' or 'num (num + num)'.");
      assert.ok(reResult[1] > total, "The total number of requests" +
                " is correct.");

      /*
      if (totalAllow == 0 || totalDeny == 0) {
        re = new RegExp("^\s*" + total + "\s*$");
      } else {
        let addWhitespace = function() {
          let str = "\s*";
          for (let i = 0, len = arguments.length; i < len; ++i) {
            str += arguments[i] + "\s*";
          }
        };

        re = new RegExp("^" + addWhitespace(total, "\(", totalDeny, "\+",
                                            totalAllow, "\)") + "$");
      }
      assert.ok(re.test(rpOriginNumReq.value), "The total number of requests" +
                " is displayed correctly: " +
                "'" + total + " ("+totalDeny+" + "+totalAllow+")'.");
      */
    }


    /**
     * check whether all requests are correct,
     * whether the request counter is correct,
     * ...
     */

    // close the menu
    rpcMenuPopup.keypress('VK_ESCAPE');
  };

  return self;
}

exports.NumRequestsCounter = NumRequestsCounter;
