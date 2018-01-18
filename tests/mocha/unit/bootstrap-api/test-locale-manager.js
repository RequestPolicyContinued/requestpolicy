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
const {expect} = chai;

const {LocaleData} = require("content/lib/i18n/locale-data");

// Loads mocking classes
// Those mocks are needed because some scripts loads XPCOM objects like :
// const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm");
const MockNetUtil = require("./lib/mock-netutil");
const MockComponents = require("./lib/mock-components");
const MockServices = require("./lib/mock-services");

let sandbox = sinon.createSandbox();

describe("LocaleManager", function() {
  let ChromeFilesUtils = null;
  let LocaleManager = null;

  before(function() {
    let mockComp = new MockComponents();
    let mockNu = new MockNetUtil();
    let mockHttp = {httpRequest: function(url, option) {}};
    let mockServices = new MockServices();

    sinon.stub(mockComp.utils, "import")
      .withArgs("resource://gre/modules/NetUtil.jsm")
      .returns({NetUtil: mockNu})
      .withArgs("resource://gre/modules/Http.jsm")
      .returns(mockHttp);

    // Replaces global declaration done in bootstrap.js
    global.Cu = mockComp.utils;
    global.Services = mockServices;

    ChromeFilesUtils = require("content/lib/utils/chrome-files");
    LocaleManager = require("content/lib/i18n/locale-manager").LocaleManager.instance;

    // Create stubs
    sinon.stub(ChromeFilesUtils, "parseJSON");
  });

  afterEach(function() {
    sandbox.restore();
    global.Services.locale = {};
    LocaleManager.localeData = new LocaleData();
  });

  after(function() {
    global.Cu = null;
    global.Services = null;
  });

  describe("getAppLocale()", function() {
    it("Should always use getAppLocaleAsBCP47 if available", function() {
      global.Services.locale = {
        getAppLocaleAsBCP47: function() {
          return "fr";
        },
        getApplicationLocale: function() {
          return "en";
        },
      };

      let result = LocaleManager.getAppLocale();
      expect(result).to.equal("fr");
    });

    it("Should use getApplicationLocale as fallback", function() {
      global.Services.locale = {
        getApplicationLocale: function() {
          return {getCategory: () => "fr"};
        },
      };

      let result = LocaleManager.getAppLocale();
      expect(result).to.equal("fr");
    });

    it("Should return normalized BCP 47 tag", function() {
      global.Services.locale = {
        getAppLocaleAsBCP47: function() {
          return "fr-FR";
        },
      };

      let result = LocaleManager.getAppLocale();
      expect(result).to.equal("fr-fr");
    });

    it("Should throw RangeError if not a valid BCP 47 tag", function() {
      global.Services.locale = {
        getAppLocaleAsBCP47: function() {
          return "-invalid tag";
        },
      };

      let fn = function() {
        return LocaleManager.getAppLocale();
      };
      expect(fn).to.throws(RangeError);
    });
  });

  describe("getDefaultLocale()", function() {
    it("Should return value from manifest.json", function() {
      ChromeFilesUtils.parseJSON
        .withArgs("chrome://rpcontinued/content/bootstrap/data/manifest.json")
        .resolves({default_locale: "zh"});

      let promise = LocaleManager.getDefaultLocale();
      return expect(promise).to.be.eventually.fulfilled
        .with.a("string").which.equal("zh");
    });

    it("Should return a normalized BCP 47 tag", function() {
      ChromeFilesUtils.parseJSON
        .withArgs("chrome://rpcontinued/content/bootstrap/data/manifest.json")
        .resolves({default_locale: "fr_CA"});

      let promise = LocaleManager.getDefaultLocale();
      return expect(promise).to.be.eventually.fulfilled
        .with.a("string").which.equal("fr-ca");
    });

    it("Should reject if default_locale isn't present", function() {
      ChromeFilesUtils.parseJSON
        .withArgs("chrome://rpcontinued/content/bootstrap/data/manifest.json")
        .resolves({name: "RPC"});

      let promise = LocaleManager.getDefaultLocale();
      return expect(promise).to.be.eventually.rejectedWith(Error);
    });

    it("Should reject if can't parse manifest.json", function() {
      ChromeFilesUtils.parseJSON
        .withArgs("chrome://rpcontinued/content/bootstrap/data/manifest.json")
        .rejects();

      let promise = LocaleManager.getDefaultLocale();
      return expect(promise).to.be.eventually.rejectedWith(Error);
    });
  });

  describe("getAvailableLocales()", function() {
    it("Should return a map of available locales", function() {
      ChromeFilesUtils.parseJSON.resolves(["fr", "en"]);
      let promise = LocaleManager.getAvailableLocales();
      return expect(promise).to.be.eventually.fulfilled
        .with.a("map").which.have.all.keys("fr", "en")
        .and.include("fr")
        .and.include("en");
    });

    it("Should normalize tag", function() {
      ChromeFilesUtils.parseJSON.resolves(["Fr_fR", "eN_Us"]);
      let promise = LocaleManager.getAvailableLocales();
      return expect(promise).to.be.eventually.fulfilled
        .with.a("map").which.have.all.keys("fr-fr", "en-us")
        .and.include("Fr_fR")
        .and.include("eN_Us");
    });

    it("Should be rejected on parseJSON rejection", function() {
      ChromeFilesUtils.parseJSON.rejects();
      let promise = LocaleManager.getAvailableLocales();
      return expect(promise).to.be.rejectedWith(Error);
    });

    it("Should be rejected on parseJSON exception", function() {
      ChromeFilesUtils.parseJSON.returns(new Promise((resolve, reject) => {
        throw new Error();
      }));
      let promise = LocaleManager.getAvailableLocales();
      return expect(promise).to.be.rejectedWith(Error);
    });
  });

  describe("getBestMatches(requestedLocales, localesMap)", function() {
    let localesMap = new Map([["fr", "fr"], ["en-us", "en_US"], ["de", "de"]]);

    it("Should return only requested locales", function() {
      let result = LocaleManager.getBestMatches(["fr", "en-us"], localesMap);
      return expect(result).to.be.a("map")
        .which.have.all.keys("fr", "en-us")
        .and.include("fr")
        .and.include("en_US")
        .and.to.not.have.any.keys("de");
    });

    it("Should return best match", function() {
      let result = LocaleManager.getBestMatches(["fr-FR", "en-us"], localesMap);
      return expect(result).to.be.a("map")
        .which.have.all.keys("fr", "en-us")
        .and.include("fr")
        .and.include("en_US")
        .and.to.not.have.any.keys("de");
    });

    it("Shouldn't return duplicates", function() {
      let result = LocaleManager.getBestMatches(["fr-FR", "fr"], localesMap);
      return expect(result).to.be.a("map").which.have.property("size", 1);
    });

    it("Shouldn't empty map if no match", function() {
      let result = LocaleManager.getBestMatches(["zn"], localesMap);
      return expect(result).to.be.a("map").which.have.property("size", 0);
    });
  });

  describe("loadLocalesMessages(localesMap)", function() {
    it("Should load all requested locale", function() {
      let localesMap = new Map([["fr", "fr"], ["en-us", "en_US"]]);
      ChromeFilesUtils.parseJSON
        .withArgs("chrome://rpcontinued/content/_locales/fr/messages.json")
        .resolves("des messages")
        .withArgs("chrome://rpcontinued/content/_locales/en_US/messages.json")
        .resolves("some messages");
      let promise = LocaleManager.loadLocalesMessages(localesMap);
      return expect(promise).to.be.eventually.fulfilled
        .with.an("array")
        .which.deep.include({locale: "fr", messages: "des messages"})
        .and.deep.include({locale: "en-us", messages: "some messages"});
    });

    it("Should be rejected if JSON parsing fails", function() {
      let localesMap = new Map([["fr", "fr"], ["en-us", "en_US"]]);
      ChromeFilesUtils.parseJSON
        .withArgs("chrome://rpcontinued/content/_locales/fr/messages.json")
        .resolves("des messages")
        .withArgs("chrome://rpcontinued/content/_locales/en_US/messages.json")
        .rejects();

      let promise = LocaleManager.loadLocalesMessages(localesMap);
      return expect(promise).to.be.eventually.rejectedWith(Error);
    });
  });

  describe("updateLocalesPrefs(defaultLocale, uiLocale)", function() {
    it("Should find best match for default locale", function() {
      LocaleManager.localeData.messages = new Map([["en", {}], ["fr", {}]]);
      let result = LocaleManager.updateLocalesPrefs("en-US", "de");
      expect(result.default).to.equal("en");
      expect(LocaleManager.localeData.defaultLocale).to.equal("en");
    });

    it("Should find best match for ui locale", function() {
      LocaleManager.localeData.messages = new Map([["en", {}], ["fr", {}]]);
      let result = LocaleManager.updateLocalesPrefs("en", "fr-FR");
      expect(result.selected).to.equal("fr");
      expect(LocaleManager.localeData.selectedLocale).to.equal("fr");
    });

    it("Should throw error if no match for default locale", function() {
      LocaleManager.localeData.messages = new Map([["en", {}], ["fr", {}]]);
      let fn = () => LocaleManager.updateLocalesPrefs("de", "fr");
      expect(fn).to.throw(Error);
    });

    it("Should use fallback if no match for ui locale", function() {
      LocaleManager.localeData.messages = new Map([["en", {}], ["fr", {}]]);
      let result = LocaleManager.updateLocalesPrefs("en", "de");
      expect(result.selected).to.equal("de");
      expect(LocaleManager.localeData.selectedLocale).to.equal("de");
    });

    it("Should normalized locales tag during search", function() {
      LocaleManager.localeData.messages = new Map([["en", {}], ["fr", {}]]);
      let result = LocaleManager.updateLocalesPrefs("En-uS", "fR-fR");
      expect(result.default).to.equal("en");
      expect(result.selected).to.equal("fr");
      expect(LocaleManager.localeData.defaultLocale).to.equal("en");
      expect(LocaleManager.localeData.selectedLocale).to.equal("fr");
    });
  });
});
