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
const {expect} = chai;

// Loads mocking classes
// Those mocks are needed because some scripts loads XPCOM objects like :
// const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm");
import {NetUtil as MockNetUtil} from "./lib/mock-netutil";
import {Components as MockComponents} from "./lib/mock-components";
import {Services as MockServices} from "./lib/mock-services";

let sandbox = sinon.createSandbox();

describe("AsyncLocaleData", function() {
  let ChromeFilesUtils = null;
  let asyncLocaleData = null;
  let AsyncLocaleData;

  let mockComp: MockComponents;
  let mockNu: MockNetUtil;
  let mockServices: MockServices;

  before(function() {
    mockComp = new MockComponents();
    mockNu = new MockNetUtil();
    mockServices = new MockServices();
    let mockHttp = {httpRequest: function(url, option) {}};

    sinon.stub(mockComp.utils, "import").
        withArgs("resource://gre/modules/NetUtil.jsm").
        returns({NetUtil: mockNu}).
        withArgs("resource://gre/modules/Http.jsm").
        returns(mockHttp);

    // Replaces global declaration done in bootstrap.js
    (global as any).Cu = mockComp.utils;
    (global as any).Services = mockServices;

    ({AsyncLocaleData} = require("bootstrap/models/api/i18n/async-locale-data"));
    ChromeFilesUtils = require("bootstrap/lib/utils/chrome-files-utils");

    // Create stubs
    sinon.stub(ChromeFilesUtils, "parseJSON");
  });

  beforeEach(function() {
    asyncLocaleData = new AsyncLocaleData(() => "en-US");
  });

  afterEach(function() {
    sandbox.restore();
    mockServices.locale = {};
  });

  after(function() {
    (global as any).Cu = null;
    (global as any).Services = null;
  });

  describe("getAppLocale()", function() {
    it("Should return normalized BCP 47 tag", function() {
      asyncLocaleData = new AsyncLocaleData(() => "fr-FR");

      let result = asyncLocaleData.getAppLocale();
      expect(result).to.equal("fr-fr");
    });

    it("Should throw RangeError if not a valid BCP 47 tag", function() {
      asyncLocaleData = new AsyncLocaleData(() => "-invalid tag");

      let fn = function() {
        return asyncLocaleData.getAppLocale();
      };
      expect(fn).to.throws(RangeError);
    });
  });

  describe("getDefaultLocale()", function() {
    it("Should return value from manifest.json", function() {
      ChromeFilesUtils.parseJSON.
          withArgs("chrome://rpcontinued/content/bootstrap-data/manifest.json").
          resolves({default_locale: "zh"});

      let promise = asyncLocaleData.getDefaultLocale();
      return expect(promise).to.be.eventually.fulfilled.
          with.a("string").which.equal("zh");
    });

    it("Should return a normalized BCP 47 tag", function() {
      ChromeFilesUtils.parseJSON.
          withArgs("chrome://rpcontinued/content/bootstrap-data/manifest.json").
          resolves({default_locale: "fr_CA"});

      let promise = asyncLocaleData.getDefaultLocale();
      return expect(promise).to.be.eventually.fulfilled.
          with.a("string").which.equal("fr-ca");
    });

    it("Should reject if default_locale isn't present", function() {
      ChromeFilesUtils.parseJSON.
          withArgs("chrome://rpcontinued/content/bootstrap-data/manifest.json").
          resolves({name: "RPC"});

      let promise = asyncLocaleData.getDefaultLocale();
      return expect(promise).to.be.eventually.rejectedWith(Error);
    });

    it("Should reject if can't parse manifest.json", function() {
      ChromeFilesUtils.parseJSON.
          withArgs("chrome://rpcontinued/content/bootstrap-data/manifest.json").
          rejects();

      let promise = asyncLocaleData.getDefaultLocale();
      return expect(promise).to.be.eventually.rejectedWith(Error);
    });
  });

  describe("getAvailableLocales()", function() {
    it("Should return a map of available locales", function() {
      ChromeFilesUtils.parseJSON.resolves(["fr", "en"]);
      let promise = asyncLocaleData.getAvailableLocales();
      return expect(promise).to.be.eventually.fulfilled.
          with.a("map").which.have.all.keys("fr", "en").
          and.include("fr").
          and.include("en");
    });

    it("Should normalize tag", function() {
      ChromeFilesUtils.parseJSON.resolves(["Fr_fR", "eN_Us"]);
      let promise = asyncLocaleData.getAvailableLocales();
      return expect(promise).to.be.eventually.fulfilled.
          with.a("map").which.have.all.keys("fr-fr", "en-us").
          and.include("Fr_fR").
          and.include("eN_Us");
    });

    it("Should be rejected on parseJSON rejection", function() {
      ChromeFilesUtils.parseJSON.rejects();
      let promise = asyncLocaleData.getAvailableLocales();
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be rejected on parseJSON exception", function() {
      ChromeFilesUtils.parseJSON.returns(new Promise((resolve, reject) => {
        throw new Error();
      }));
      let promise = asyncLocaleData.getAvailableLocales();
      return expect(promise).to.be.rejectedWith(Error);
    });
  });

  describe("getBestMatches(requestedLocales, localesMap)", function() {
    let localesMap = new Map([["fr", "fr"], ["en-us", "en_US"], ["de", "de"]]);

    it("Should return only requested locales", function() {
      let result = asyncLocaleData.getBestMatches(["fr", "en-us"], localesMap);
      return expect(result).to.be.a("map").
          which.have.all.keys("fr", "en-us").
          and.include("fr").
          and.include("en_US").
          and.to.not.have.any.keys("de");
    });

    it("Should return best match", function() {
      let result = asyncLocaleData.getBestMatches(["fr-FR", "en-us"], localesMap);
      return expect(result).to.be.a("map").
          which.have.all.keys("fr", "en-us").
          and.include("fr").
          and.include("en_US").
          and.to.not.have.any.keys("de");
    });

    it("Shouldn't return duplicates", function() {
      let result = asyncLocaleData.getBestMatches(["fr-FR", "fr"], localesMap);
      return expect(result).to.be.a("map").which.have.property("size", 1);
    });

    it("Shouldn't empty map if no match", function() {
      let result = asyncLocaleData.getBestMatches(["zn"], localesMap);
      return expect(result).to.be.a("map").which.have.property("size", 0);
    });
  });

  describe("loadLocalesMessages(localesMap)", function() {
    it("Should load all requested locale", function() {
      let localesMap = new Map([["fr", "fr"], ["en-us", "en_US"]]);
      ChromeFilesUtils.parseJSON.
          withArgs("chrome://rpcontinued/content/_locales/fr/messages.json").
          resolves("des messages").
          withArgs("chrome://rpcontinued/content/_locales/en_US/messages.json").
          resolves("some messages");
      let promise = asyncLocaleData.loadLocalesMessages(localesMap);
      return expect(promise).to.be.eventually.fulfilled.
          with.an("array").
          which.deep.include({locale: "fr", messages: "des messages"}).
          and.deep.include({locale: "en-us", messages: "some messages"});
    });

    it("Should be rejected if JSON parsing fails", function() {
      let localesMap = new Map([["fr", "fr"], ["en-us", "en_US"]]);
      ChromeFilesUtils.parseJSON.
          withArgs("chrome://rpcontinued/content/_locales/fr/messages.json").
          resolves("des messages").
          withArgs("chrome://rpcontinued/content/_locales/en_US/messages.json").
          rejects();

      let promise = asyncLocaleData.loadLocalesMessages(localesMap);
      return expect(promise).to.be.eventually.rejectedWith(Error);
    });
  });

  describe("updateLocalesPrefs(defaultLocale, uiLocale)", function() {
    it("Should find best match for default locale", function() {
      asyncLocaleData.messages = new Map([["en", {}], ["fr", {}]]);
      let result = asyncLocaleData.updateLocalesPrefs("en-US", "de");
      expect(result.default).to.equal("en");
      expect(asyncLocaleData.defaultLocale).to.equal("en");
    });

    it("Should find best match for ui locale", function() {
      asyncLocaleData.messages = new Map([["en", {}], ["fr", {}]]);
      let result = asyncLocaleData.updateLocalesPrefs("en", "fr-FR");
      expect(result.selected).to.equal("fr");
      expect(asyncLocaleData.selectedLocale).to.equal("fr");
    });

    it("Should throw error if no match for default locale", function() {
      asyncLocaleData.messages = new Map([["en", {}], ["fr", {}]]);
      let fn = () => asyncLocaleData.updateLocalesPrefs("de", "fr");
      expect(fn).to.throw(Error);
    });

    it("Should use fallback if no match for ui locale", function() {
      asyncLocaleData.messages = new Map([["en", {}], ["fr", {}]]);
      let result = asyncLocaleData.updateLocalesPrefs("en", "de");
      expect(result.selected).to.equal("de");
      expect(asyncLocaleData.selectedLocale).to.equal("de");
    });

    it("Should normalized locales tag during search", function() {
      asyncLocaleData.messages = new Map([["en", {}], ["fr", {}]]);
      let result = asyncLocaleData.updateLocalesPrefs("En-uS", "fR-fR");
      expect(result.default).to.equal("en");
      expect(result.selected).to.equal("fr");
      expect(asyncLocaleData.defaultLocale).to.equal("en");
      expect(asyncLocaleData.selectedLocale).to.equal("fr");
    });
  });
});
