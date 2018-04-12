/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */

const {expect} = require("chai");

describe("I18nUtils", function() {
  let I18nUtils;

  before(function() {
    I18nUtils = require("bootstrap/api/i18n/i18n-utils");
  });

  describe("normalizeToBCP47(tag)", function() {
    it("Standard cases", function() {
      let cases = ["fr", "en_US", "de_de", "FR_FR"];
      let expected = ["fr", "en-us", "de-de", "fr-fr"];
      for (let i=0; i < cases.length; i++) {
        let result = I18nUtils.normalizeToBCP47(cases[i]);
        expect(result).to.equal(expected[i]);
      }
    });

    it("Weird BCP 47 tags", function() {
      let cases = ["th_TH_u_nu_thai", "es_419"];
      let expected = ["th-th-u-nu-thai", "es-419"];
      for (let i=0; i < cases.length; i++) {
        let result = I18nUtils.normalizeToBCP47(cases[i]);
        expect(result).to.equal(expected[i]);
      }
    });

    it("Error cases", function() {
      let cases = ["", "en_US_", "_en_US"];
      for (let i=0; i < cases.length; i++) {
        let fn = function() {
          return I18nUtils.normalizeToBCP47(cases[i]);
        };
        expect(fn).to.throw(RangeError);
      }
    });
  });

  describe("getBestAvailableLocale(availableLocales, locale)", function() {
    it("Should return exact match", function() {
      let result = I18nUtils.getBestAvailableLocale(["en-US"], "en-US");
      expect(result).to.not.be.undefined;
      expect(result.toLowerCase()).to.equal("en-us");
    });

    it("Shouldn't be case sensitive on requested locale", function() {
      let result = I18nUtils.getBestAvailableLocale(["en-us"], "en-US");
      expect(result).to.not.be.undefined;
      expect(result.toLowerCase()).to.equal("en-us");
    });

    it("Shouldn't be case sensitive on available locales", function() {
      let result = I18nUtils.getBestAvailableLocale(["en-US"], "en-us");
      expect(result).to.not.be.undefined;
      expect(result.toLowerCase()).to.equal("en-us");
    });

    it("Should return closest match", function() {
      let locales = ["fr"];
      let result = I18nUtils.getBestAvailableLocale(locales, "fr-CA");
      expect(result).to.not.be.undefined;
      expect(result.toLowerCase()).to.equal("fr");

      locales.push("fr-CA");
      result = I18nUtils.getBestAvailableLocale(locales, "fr-CA");
      expect(result).to.not.be.undefined;
      expect(result.toLowerCase()).to.equal("fr-ca");

      result = I18nUtils.getBestAvailableLocale(locales, "fr-CA-1694acad");
      expect(result).to.not.be.undefined;
      expect(result.toLowerCase()).to.equal("fr-ca");
    });

    it("Should return undefined if no match", function() {
      let result = I18nUtils.getBestAvailableLocale(["en-US"], "fr");
      expect(result).to.be.undefined;
    });
  });
});
