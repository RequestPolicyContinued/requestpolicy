const {assert} = require("chai");
const sinon = require("sinon");

// Loads mocking classes
// Those mocks are needed because some scripts loads XPCOM objects like :
// const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm");
const MockNetUtil = require("./lib/mock-netutil");
const MockServices = require("./lib/mock-services");
const MockComponents = require("./lib/mock-components");


describe("Api.browser.runtime", function() {
  let runtime = null;

  before(function() {
    let mockComp = new MockComponents();
    let mockNu = new MockNetUtil();

    // Stubbing in order to return a Manifest object with empty permissions
    // Needed because of manifestHasPermission() in api.js
    sinon.stub(mockNu, "readInputStreamToString")
      .returns(`{"permissions" : []}`);

    // Stubbing in order to perform imports in api.js and required scripts
    sinon.stub(mockComp.utils, "import")
      .withArgs("resource://gre/modules/NetUtil.jsm").returns({NetUtil: mockNu})
      .withArgs("resource://gre/modules/AddonManager.jsm", {}).returns({});

    // Replaces global declaration done in bootstrap.js
    global.Cu = mockComp.utils;
    global.Ci = mockComp.interfaces;
    global.Services = new MockServices();

    let {LocaleManager} = require("content/lib/i18n/locale-manager");
    sinon.stub(LocaleManager, "init").resolves();
    // eslint-disable-next-line no-unused-vars
    let {Api, ContentScriptsApi} = require("content/web-extension-fake-api/models/api");
    runtime = Api.browser.runtime;
  });

  describe("getURL(path)", function() {
    it("Mapping into about:requestpolicy nominal case", function() {
      let path = "content/settings/pref.html";
      let expected = "about:requestpolicy?pref";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into about:requestpolicy if relative path doesn't start with /", function() {
      let path = "content/settings/prefs.html";
      let expected = "about:requestpolicy?prefs";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into about:requestpolicy if relative path starts with ./", function() {
      let path = "./content/settings/prefs.html";
      let expected = "about:requestpolicy?prefs";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into about:requestpolicy if mix-cased extension", function() {
      let path = "./content/settings/extmixcase.HtMl";
      let expected = "about:requestpolicy?extmixcase";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into about:requestpolicy if upper-cased extension", function() {
      let path = "./content/settings/extupcase.HTML";
      let expected = "about:requestpolicy?extupcase";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into about:requestpolicy if double extension", function() {
      let path = "/content/settings/doubleext.html.html";
      let expected = "about:requestpolicy?doubleext.html";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into about:requestpolicy if special chars in filename", function() {
      let path = "/content/settings/.sp3c1@l-_[char].html";
      let expected = "about:requestpolicy?.sp3c1@l-_[char]";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into about:requestpolicy if mix-cased filename", function() {
      let path = "/content/settings/CaSe.html";
      let expected = "about:requestpolicy?CaSe";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into chrome://rpcontinued/ if subdir name contains .html", function() {
      let path = "/content/settings/subdir.html/foo.css";
      let expected = "chrome://rpcontinued/content/settings/subdir.html/foo.css";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into chrome://rpcontinued/ if other extension than html", function() {
      let path = "/content/settings/otherext.css";
      let expected = "chrome://rpcontinued/content/settings/otherext.css";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into chrome://rpcontinued/ if upper-cased path", function() {
      let path = "/CONTENT/SETTINGS/prefs.html";
      let expected = "chrome://rpcontinued/CONTENT/SETTINGS/prefs.html";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Should map into chrome://rpcontinued/ if other path but html extension", function() {
      let path = "/content/foo/otherpath.html";
      let expected = "chrome://rpcontinued/content/foo/otherpath.html";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Mapping into chrome://rpcontinued/ with file in root dir", function() {
      let path = "/root.ext";
      let expected = "chrome://rpcontinued/root.ext";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Mapping into chrome://rpcontinued/ with file without extension", function() {
      let path = "/noext";
      let expected = "chrome://rpcontinued/noext";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Mapping into chrome://rpcontinued/ with a long path", function() {
      let path = "/a/quite/very/depth/and/long/path/foo.bar";
      let expected = "chrome://rpcontinued/a/quite/very/depth/and/long/path/foo.bar";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Mapping into chrome://rpcontinued/ with relative path not starting with /", function() {
      let path = "content/settings/otherext.css";
      let expected = "chrome://rpcontinued/content/settings/otherext.css";
      assert.strictEqual(runtime.getURL(path), expected);
    });

    it("Mapping into chrome://rpcontinued/ with relative path starting with ./", function() {
      let path = "./content/settings/otherext.css";
      let expected = "chrome://rpcontinued/content/settings/otherext.css";
      assert.strictEqual(runtime.getURL(path), expected);
    });
  });

  after(function() {
    global.Cu = null;
    global.Ci = null;
    global.Services = null;
  });
});
