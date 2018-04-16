/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";

chai.use(chaiAsPromised);
const {assert, expect} = chai;

// Loads mocking classes
// Those mocks are needed because some scripts loads XPCOM objects like :
// const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm");
import {NetUtil as MockNetUtil} from "./lib/mock-netutil";
import {Components as MockComponents} from "./lib/mock-components";
import {ChromeFileService} from "bootstrap/api/services/chrome-file-service";

describe("ChromeFileService", function() {
  let chromeFileService: ChromeFileService = null;
  let stubHttpRequest = null;

  before(function() {
    const mockNetUtil = new MockNetUtil();
    const mockHttp = {
      httpRequest: sinon.stub(),
    };
    stubHttpRequest = mockHttp.httpRequest;

    chromeFileService = new ChromeFileService(mockNetUtil as any, mockHttp as any);
  });

  afterEach(function() {
    stubHttpRequest.reset();
  });

  describe("getChromeUrl(path)", function() {
    it("Map path to file", function() {
      let path = "foo.ext";
      let expected = "chrome://rpcontinued/content/foo.ext";
      assert.strictEqual(chromeFileService.getChromeUrl(path), expected);
    });

    it("Map path to directory", function() {
      let path = "bar/";
      let expected = "chrome://rpcontinued/content/bar/";
      assert.strictEqual(chromeFileService.getChromeUrl(path), expected);
    });

    it("Should remove leading /", function() {
      let path = "/content/bar/";
      let expected = "chrome://rpcontinued/content/bar/";
      assert.strictEqual(chromeFileService.getChromeUrl(path), expected);
    });

    it("Should remove leading ./", function() {
      let path = "./content/bar/";
      let expected = "chrome://rpcontinued/content/bar/";
      assert.strictEqual(chromeFileService.getChromeUrl(path), expected);
    });
  });

  describe("readDirectory(chromePath)", function() {
    it("Should be rejected if path is null", function() {
      let promise = chromeFileService.readDirectory(null);
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be fullfilled with empty list if response is empty", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad("", {status: 200});
      });

      let promise = chromeFileService.readDirectory("bar/");
      return expect(promise).
          to.be.eventually.fulfilled.with.an("array").
          that.is.empty;
    });

    it("Should be fullfilled with empty list if response is null", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad(null, {status: 200});
      });

      let promise = chromeFileService.readDirectory("bar/");
      return expect(promise).
          to.be.eventually.fulfilled.with.an("array").
          that.is.empty;
    });

    it("Should be rejected if status code isn't 200", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad("", {status: 404});
      });

      let promise = chromeFileService.readDirectory("bar/");
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be rejected if status code is null", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad("", {status: null});
      });

      let promise = chromeFileService.readDirectory("bar/");
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be rejected if httpRequest throws", function() {
      stubHttpRequest.throws();

      let promise = chromeFileService.readDirectory("bar/");
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be fulfilled with file and dir", function() {
      stubHttpRequest.callsFake(function(url, option) {
        option.onLoad("201: foo.ext 0 0 FILE\n"
        + "201: barDir 0 0 DIRECTORY", {status: 200});
      });

      let promise = chromeFileService.readDirectory("bar/");
      return expect(promise).
          to.be.eventually.fulfilled.with.an("array").
          that.deep.include({name: "foo.ext", isDir: false}).
          and.deep.include({name: "barDir", isDir: true});
    });
  });

  after(function() {
    (global as any).Cu = null;
  });
});
