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
import {Services as MockServices} from "./lib/mock-services";

import {AsyncLocaleData} from "bootstrap/api/i18n/async-locale-data";
import {ChromeFileService} from "bootstrap/api/services/chrome-file-service";
import { CIMap } from "lib/classes/case-insensitive-map";

let sandbox = sinon.createSandbox();

type stubbedCFS = ChromeFileService & { parseJSON: sinon.SinonStub };

function createMockTryCatchUtils(appLocale: string) {
  return { getAppLocale() { return appLocale; } }
}

describe("AsyncLocaleData", function() {
  let chromeFileService: stubbedCFS;
  let asyncLocaleData: AsyncLocaleData;

  let mockNu: MockNetUtil;
  let mockServices: MockServices;
  let mockTryCatchUtils;

  before(function() {
    mockNu = new MockNetUtil();
    mockServices = new MockServices();
    const mockHttp = {httpRequest: function(url, option) {}};
    mockTryCatchUtils = createMockTryCatchUtils("en-US");

    const cfs = new ChromeFileService(mockNu as any, mockHttp as any);
    sinon.stub(cfs, "parseJSON");
    chromeFileService = cfs as stubbedCFS;
  });

  beforeEach(function() {
    asyncLocaleData = new AsyncLocaleData(
        mockTryCatchUtils, chromeFileService, mockServices as any,
    );
  });

  afterEach(function() {
    sandbox.restore();
    mockServices.locale = {};
  });

  describe("getAppLocale()", function() {
    it("Should return normalized BCP 47 tag", function() {
      asyncLocaleData = new AsyncLocaleData(
          createMockTryCatchUtils("fr-FR") as any,
          chromeFileService,
          mockServices as any,
      );

      let result = asyncLocaleData.getAppLocale();
      expect(result).to.equal("fr-fr");
    });

    it("Should throw RangeError if not a valid BCP 47 tag", function() {
      asyncLocaleData = new AsyncLocaleData(
          createMockTryCatchUtils("-invalid tag") as any,
          chromeFileService,
          mockServices as any,
      );

      let fn = function() {
        return asyncLocaleData.getAppLocale();
      };
      expect(fn).to.throws(RangeError);
    });
  });

  describe("getDefaultLocale()", function() {
    it("Should return value from manifest.json", function() {
      chromeFileService.parseJSON.
          withArgs("chrome://rpcontinued/content/bootstrap-data/manifest.json").
          resolves({default_locale: "zh"});

      let promise = asyncLocaleData.getDefaultLocale();
      return expect(promise).to.be.eventually.fulfilled.
          with.a("string").which.equal("zh");
    });

    it("Should return a normalized BCP 47 tag", function() {
      chromeFileService.parseJSON.
          withArgs("chrome://rpcontinued/content/bootstrap-data/manifest.json").
          resolves({default_locale: "fr_CA"});

      let promise = asyncLocaleData.getDefaultLocale();
      return expect(promise).to.be.eventually.fulfilled.
          with.a("string").which.equal("fr-ca");
    });

    it("Should reject if default_locale isn't present", function() {
      chromeFileService.parseJSON.
          withArgs("chrome://rpcontinued/content/bootstrap-data/manifest.json").
          resolves({name: "RPC"});

      let promise = asyncLocaleData.getDefaultLocale();
      return expect(promise).to.be.eventually.rejectedWith(Error);
    });

    it("Should reject if can't parse manifest.json", function() {
      chromeFileService.parseJSON.
          withArgs("chrome://rpcontinued/content/bootstrap-data/manifest.json").
          rejects();

      let promise = asyncLocaleData.getDefaultLocale();
      return expect(promise).to.be.eventually.rejectedWith(Error);
    });
  });

  describe("getAvailableLocales()", function() {
    it("Should return a map of available locales", function() {
      chromeFileService.parseJSON.resolves(["fr", "en"]);
      let promise = asyncLocaleData.getAvailableLocales();
      return expect(promise).to.be.eventually.fulfilled.
          with.a("map").which.have.all.keys("fr", "en").
          and.include("fr").
          and.include("en");
    });

    it("Should normalize tag", function() {
      chromeFileService.parseJSON.resolves(["Fr_fR", "eN_Us"]);
      let promise = asyncLocaleData.getAvailableLocales();
      return expect(promise).to.be.eventually.fulfilled.
          with.a("map").which.have.all.keys("fr-fr", "en-us").
          and.include("Fr_fR").
          and.include("eN_Us");
    });

    it("Should be rejected on parseJSON rejection", function() {
      chromeFileService.parseJSON.rejects();
      let promise = asyncLocaleData.getAvailableLocales();
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be rejected on parseJSON exception", function() {
      chromeFileService.parseJSON.returns(new Promise((resolve, reject) => {
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
      chromeFileService.parseJSON.
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
      chromeFileService.parseJSON.
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
      asyncLocaleData.messages = new Map([["en", new CIMap()], ["fr", new CIMap()]]);
      let result = asyncLocaleData.updateLocalesPrefs("en-US", "de");
      expect(result.default).to.equal("en");
      expect(asyncLocaleData.defaultLocale).to.equal("en");
    });

    it("Should find best match for ui locale", function() {
      asyncLocaleData.messages = new Map([["en", new CIMap()], ["fr", new CIMap()]]);
      let result = asyncLocaleData.updateLocalesPrefs("en", "fr-FR");
      expect(result.selected).to.equal("fr");
      expect(asyncLocaleData.selectedLocale).to.equal("fr");
    });

    it("Should throw error if no match for default locale", function() {
      asyncLocaleData.messages = new Map([["en", new CIMap()], ["fr", new CIMap()]]);
      let fn = () => asyncLocaleData.updateLocalesPrefs("de", "fr");
      expect(fn).to.throw(Error);
    });

    it("Should use fallback if no match for ui locale", function() {
      asyncLocaleData.messages = new Map([["en", new CIMap()], ["fr", new CIMap()]]);
      let result = asyncLocaleData.updateLocalesPrefs("en", "de");
      expect(result.selected).to.equal("de");
      expect(asyncLocaleData.selectedLocale).to.equal("de");
    });

    it("Should normalized locales tag during search", function() {
      asyncLocaleData.messages = new Map([["en", new CIMap()], ["fr", new CIMap()]]);
      let result = asyncLocaleData.updateLocalesPrefs("En-uS", "fR-fR");
      expect(result.default).to.equal("en");
      expect(result.selected).to.equal("fr");
      expect(asyncLocaleData.defaultLocale).to.equal("en");
      expect(asyncLocaleData.selectedLocale).to.equal("fr");
    });
  });
});
