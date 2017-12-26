/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");

chai.use(chaiAsPromised);
const {assert, expect} = chai;

// Loads mocking classes
// Those mocks are needed because some scripts loads XPCOM objects like :
// const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm");
const MockNetUtil = require("./lib/mock-netutil");
const MockComponents = require("./lib/mock-components");

describe("ChromeFilesUtils", function() {
  let ChromeFilesUtils = null;
  let stubHttpRequest = null;

  before(function() {
    let mockComp = new MockComponents();
    let mockNu = new MockNetUtil();

    let mockHttp = {httpRequest: function(url, option) {}};
    stubHttpRequest = sinon.stub(mockHttp, "httpRequest");

    sinon.stub(mockComp.utils, "import")
      .withArgs("resource://gre/modules/NetUtil.jsm")
      .returns({NetUtil: mockNu})
      .withArgs("resource://gre/modules/Http.jsm")
      .returns(mockHttp);

    // Replaces global declaration done in bootstrap.js
    global.Cu = mockComp.utils;

    ChromeFilesUtils = require("content/lib/utils/chrome-files-utils");
  });

  afterEach(function() {
    stubHttpRequest.reset();
  });

  describe("getChromeUrl(path)", function() {
    it("Map path to file", function() {
      let path = "content/foo.ext";
      let expected = "chrome://rpcontinued/content/foo.ext";
      assert.strictEqual(ChromeFilesUtils.getChromeUrl(path), expected);
    });

    it("Map path to directory", function() {
      let path = "content/bar/";
      let expected = "chrome://rpcontinued/content/bar/";
      assert.strictEqual(ChromeFilesUtils.getChromeUrl(path), expected);
    });

    it("Should remove leading /", function() {
      let path = "/content/bar/";
      let expected = "chrome://rpcontinued/content/bar/";
      assert.strictEqual(ChromeFilesUtils.getChromeUrl(path), expected);
    });

    it("Should remove leading ./", function() {
      let path = "./content/bar/";
      let expected = "chrome://rpcontinued/content/bar/";
      assert.strictEqual(ChromeFilesUtils.getChromeUrl(path), expected);
    });
  });

  describe("readDirectory(chromePath)", function() {
    it("Should be rejected if path is null", function() {
      let promise = ChromeFilesUtils.readDirectory(null);
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be fullfilled with empty list if response is empty", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad("", {status: 200});
      });

      let promise = ChromeFilesUtils.readDirectory("bar/");
      return expect(promise).to.be.eventually.fulfilled
        .with.an("array").that.is.empty;
    });

    it("Should be fullfilled with empty list if response is null", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad(null, {status: 200});
      });

      let promise = ChromeFilesUtils.readDirectory("bar/");
      return expect(promise).to.be.eventually.fulfilled
        .with.an("array").that.is.empty;
    });

    it("Should be rejected if status code isn't 200", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad("", {status: 404});
      });

      let promise = ChromeFilesUtils.readDirectory("bar/");
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be rejected if status code is null", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad("", {status: null});
      });

      let promise = ChromeFilesUtils.readDirectory("bar/");
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be rejected if httpRequest throws", function() {
      stubHttpRequest.throws();

      let promise = ChromeFilesUtils.readDirectory("bar/");
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be fulfilled with file and dir", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad("201: foo.ext 0 0 FILE\n"
        + "201: barDir 0 0 DIRECTORY", {status: 200});
      });

      let promise = ChromeFilesUtils.readDirectory("bar/");
      return expect(promise).to.be.eventually.fulfilled
        .with.an("array").that.deep.include({name: "foo.ext", isDir: false})
        .and.deep.include({name: "barDir", isDir: true});
    });
  });

  after(function() {
    global.Cu = null;
  });
});
