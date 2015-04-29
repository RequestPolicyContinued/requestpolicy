/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var rpRootDir = "../../";
var rpConst = require(rpRootDir + "lib/constants");
var rootDir = rpRootDir + rpConst.mozmillTestsRootDir;

var prefs = require(rootDir + "lib/prefs");
var tabs = require(rootDir + "firefox/lib/tabs");

var rpUtils = require(rpRootDir + "lib/rp-utils");
var requestLogUtils = require(rpRootDir + "lib/request-log-utils");

const TEST_URL = "http://www.maindomain.test/scheme-unknown-and-without-host-2.html";
const SCHEME = "rpc";


var setupModule = function (aModule) {
  aModule.controller = mozmill.getBrowserController();
  aModule.tabBrowser = new tabs.tabBrowser(aModule.controller);
  aModule.tabBrowser.closeAllTabs();

  aModule.requestLog = new requestLogUtils.RequestLog(aModule.controller);
  aModule.requestLog.open();
  aModule.requestLog.clear();
};

var teardownModule = function (aModule) {
  aModule.requestLog.close();
  aModule.tabBrowser.closeAllTabs();
};

var teardownTest = function (aModule) {
  prefs.clearUserPref(rpConst.PREF_DEFAULT_ALLOW);
  removeRules();
}


var RowUtils = {
  getPolicy: function (row) {
    return row.children[0].textContent;
  },
  getOrigin: function (row) {
    return row.children[1].textContent;
  },
  getDest: function (row) {
    return row.children[2].textContent;
  },
  getRuleSet: function (row) {
    return row.children[3].textContent;
  },
  removeRule: function (row) {
    findElement.Elem(row.children[4].getElementsByTagName("a")[0]).click();
  },
  countTableRows: function (tbody) {
    return tbody.children.length;
  }
};


/**
 * Get all table row (html: <tr>) elements whose content of the
 * "detination" column contains the specified string.
 */
function getTableRowElements(aTbody, aDestinationString) {
  var rows = Array.prototype.slice.call(aTbody.children);

  var filteredRows = rows.filter(function (row) {
    if (RowUtils.getDest(row).indexOf(aDestinationString) === -1) {
      return false;
    }

    return true;
  });

  return filteredRows;
}

/**
 * Add a rule that either allows or denies requests to
 * the scheme SCHEME.
 */
function addRule(aIsAllowRule) {
  controller.open("about:requestpolicy?yourpolicy");
  controller.waitForPageLoad();

  var doc = controller.window.content.document;
  var tbody = doc.getElementById("rules");

  function numberOfRules() {
    return RowUtils.countTableRows(tbody);
  }

  var numberOfRulesBefore = numberOfRules();

  // fill the form
  {
    let destSchemeField = findElement.Name(doc, "destscheme");
    destSchemeField.sendKeys(SCHEME);
    let radioButtonId = aIsAllowRule ? "allowrule" : "denyrule";
    findElement.ID(doc, radioButtonId).select();
  }

  // submit the form
  {
    let button = findElement.XPath(doc, "//button[@data-string='addRule']");
    button.click();
  }

  //
  // below, do checks whether the rule has been added correctly
  //

  controller.waitFor(function () {
    return numberOfRules() > numberOfRulesBefore;
  }, "The number of rules in the table has increased.");

  assert.equal(numberOfRules() - numberOfRulesBefore, 1,
               "The number of rules added is exactly one.");

  var rows = getTableRowElements(tbody, SCHEME + ":");

  assert.equal(rows.length, 1,
               "There is exactly one rule with '" + SCHEME + "' " +
               "being the destination scheme.");

  // check the content of every single cell of that table row
  {
    let row = rows[0];

    expect.equal(RowUtils.getPolicy(row), aIsAllowRule ? "Allow" : "Block",
                 "The policy of the rule is correct.");
    expect.equal(RowUtils.getOrigin(row),
                 "",
                 "The origin of the rule is correct.");
    expect.equal(RowUtils.getDest(row),
                 SCHEME + ":*",
                 "The destination of the rule is correct.");
    expect.equal(RowUtils.getRuleSet(row), "User",
                 "The Rule Set of the rule is correct.");
  }
}

/**
 * Remove all rules that specify the scheme SCHEME.
 */
function removeRules() {
  controller.open("about:requestpolicy?yourpolicy");
  controller.waitForPageLoad();

  var doc = controller.window.content.document;
  var tbody = doc.getElementById("rules");

  // remove the rules
  {
    let rows = getTableRowElements(tbody, SCHEME + ":");
    rows.forEach(function (row) {
      RowUtils.removeRule(row);
    });
  }

  // do final checks
  {
    let rows = getTableRowElements(tbody, SCHEME + ":");
    expect.equal(rows.length, 0, "There are no more rules for " +
                 "URI scheme '" + SCHEME + "'.");
  }
}

/**
 * Return the string that is displayed in the table of rules.
 */
function isAllowedToString(aIsAllowed) {
  return aIsAllowed ? "allowed" : "denied";
}


/**
 * Do anything that has to be done before the test URL is opened.
 */
function setupTestCase({isDefaultAllow, allowRuleExists, denyRuleExists}) {
  prefs.setPref(rpConst.PREF_DEFAULT_ALLOW, isDefaultAllow);

  if (allowRuleExists) {
    addRule(true);
  }
  if (denyRuleExists) {
    addRule(false);
  }

  requestLog.clear();
}


/**
 * Common function for all test cases
 */
function runTestCase(aTestCase) {
  var {isDefaultAllow, allowRuleExists, denyRuleExists,
       requestShouldBeAllowed} = aTestCase;

  setupTestCase(aTestCase);

  assert.ok(requestLog.treeView.rowCount === 0,
            "The request log is empty.");

  controller.open(TEST_URL);
  controller.waitForPageLoad();

  var iframeURI = controller.window.content.document
      .getElementsByTagName("iframe")[0].src;

  assert.ok(iframeURI.indexOf(SCHEME + ":") === 0,
            "The iframe's URI starts with the correct scheme: '" +
            SCHEME + "'.");

  var rows = requestLog.getRowsByDestination(iframeURI);
  assert.equal(rows.length, 1,
               "There is exactly one entry in the request log with '" +
               iframeURI + "' as the destination.");

  // check the decision (allow or deny) on the request
  {
    let expectedDecision = isAllowedToString(requestShouldBeAllowed);
    let actualDecision = isAllowedToString(rows[0].hasBeenAllowed);
    assert.equal(actualDecision, expectedDecision,
                 "The request has been " + expectedDecision + ".");
  }
}

//
// below, generate the test cases
//

var testDefaultDeny = runTestCase.bind(null,
    {
      isDefaultAllow: false,
      allowRuleExists: false,
      denyRuleExists: false,
      requestShouldBeAllowed: false
    });

var testDefaultDenyWithAllowRule = runTestCase.bind(null,
    {
      isDefaultAllow: false,
      allowRuleExists: true,
      denyRuleExists: false,
      requestShouldBeAllowed: true
    });

var testDefaultAllow = runTestCase.bind(null,
    {
      isDefaultAllow: true,
      allowRuleExists: false,
      denyRuleExists: false,
      requestShouldBeAllowed: true
    });

var testDefaultAllowWithDenyRule = runTestCase.bind(null,
    {
      isDefaultAllow: true,
      allowRuleExists: false,
      denyRuleExists: true,
      requestShouldBeAllowed: false
    });
