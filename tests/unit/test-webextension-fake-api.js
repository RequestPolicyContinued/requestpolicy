var {assert} = require("chai");
var sinon = require("sinon");

var mockNetUtil = require("./lib/mock-netutil");
var mockServices = require("./lib/mock-services");

var Cu = {
  import: function(p) {
    return {
      NetUtil : new mockNetUtil(),
      AddonManager: {}
    }
  }
};

global.Cu = Cu;
global.Services = new mockServices();
//global.Ci = {nsIPrefBranch2: null}

var {Api, ContentScriptsApi} = require("content/web-extension-fake-api/models/api");

describe("Api.browser.runtime", function() {
  describe("getUrl()", function() {
    it("", function() {
      //assert.strictEqual(Api.browser.runtime.getUrl("hey"), "hey");
    });
  });
});
