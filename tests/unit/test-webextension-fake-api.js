var {assert} = require("chai");
var sinon = require("sinon");

// Loads mocking classes
// Those mocks are needed because some scripts loads XPCOM objects like :
// const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm");
var MockNetUtil = require("./lib/mock-netutil");
var MockServices = require("./lib/mock-services");
var MockComponents = require("./lib/mock-components");


describe("Api.browser.runtime", function() {

  let runtime = null;

  before(function() {
    let mockComp = new MockComponents();
    let mockNu = new MockNetUtil();

    // Stubbing in order to return a Manifest object with empty permissions
    // Needed because of manifestHasPermission() in api.js
    sinon.stub(mockNu, "readInputStreamToString")
      .returns('{"permissions" : []}');

    // Stubbing in order to perform imports in api.js and required scripts
    sinon.stub(mockComp.utils, "import")
      .withArgs("resource://gre/modules/NetUtil.jsm").returns({NetUtil: mockNu})
      .withArgs("resource://gre/modules/AddonManager.jsm", {}).returns({});

    // Replaces global declaration done in bootstrap.js
    global.Cu = mockComp.utils;
    global.Ci = mockComp.interfaces;
    global.Services = new MockServices();

    let {Api, ContentScriptsApi} = require("content/web-extension-fake-api/models/api");
    runtime = Api.browser.runtime;
  });

  describe("getURL(path)", function() {
    it("dummy", function() {
      //assert.strictEqual(runtime.getURL("hey"), "hey");
    });
  });

  after(function() {
    global.Cu = null;
    global.Ci = null;
    global.Services = null;
  });
});
