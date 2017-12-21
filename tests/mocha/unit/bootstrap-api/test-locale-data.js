/*
 * ***** BEGIN LICENSE BLOCK *****
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * ***** END LICENSE BLOCK *****
 */
 
const {assert} = require("chai");
const {LocaleData} = require("content/lib/i18n/locale-data");


function resetConsoleErrors() {
  if ("reset" in console.error) {
    console.error.reset();
  }
}


describe("LocaleData", function() {
  describe("has(locale)", function() {
    it("Should return true with loaded locale", function() {
      let data = new LocaleData();
      data.addLocale("en-US", {});
      assert.isTrue(data.has("en-US"));
    });

    it("Should return false with unknown locale", function() {
      let data = new LocaleData();
      data.addLocale("en-US", {});
      assert.isFalse(data.has("fr"));
    });
  });

  describe("availableLocales getter", function() {
    function initLocaleData(selectedLocale, defaultLocale) {
      let result = new LocaleData();
      result.addLocale("en-US", {});
      result.addLocale("fr", {});
      result.selectedLocale = selectedLocale;
      result.defaultLocale = defaultLocale;
      return result;
    }

    it("Should return only locales with loaded messages", function() {
      let data = initLocaleData("fr", "en-US");
      let result = data.availableLocales;
      assert.strictEqual(result.size, 2);
      assert.isFalse(result.has(data.BUILTIN));
      assert.isTrue(result.has("fr"));
      assert.isTrue(result.has("en-US"));
    });

    it("Shouldn't return a locale not defined as selected or default", function() {
      let data = initLocaleData("en-US", "en-US");
      let result = data.availableLocales;
      assert.strictEqual(result.size, 1);
      assert.isFalse(result.has(data.BUILTIN));
      assert.isFalse(result.has("fr"));
      assert.isTrue(result.has("en-US"));
    });
  });

  describe("localizeMessage(message, substitutions, options)", function() {
    function initLocaleData() {
      let data = new LocaleData();
      data.addLocale("fr", {
        "msg_1": {message: "Message remplacé"},
        "msg_2": {message: "Message avec substitution : $1"},
        "msg_builtin": {message: "Un message"},
      });
      data.addLocale("en", {
        "msg_1": {message: "Replaced message"},
        "msg_3": {message: "Message fallback"},
        "msg_builtin": {message: "Some message"},
      });
      data.addLocale(data.BUILTIN, {
        "msg_builtin": {message: "Built-in message"},
      });
      data.selectedLocale = "fr";
      data.defaultLocale = "en";
      return data;
    }

    it("Simple message replacement", function() {
      let data = initLocaleData();
      let result = data.localizeMessage("msg_1");
      assert.strictEqual(result, "Message remplacé");
    });

    it("Message with substitutions", function() {
        let data = initLocaleData();
        let result = data.localizeMessage("msg_2", ["test"]);
        assert.strictEqual(result, "Message avec substitution : test");
    });

    it("Message key search should be case insensitive", function() {
      let data = initLocaleData();
      let result = data.localizeMessage("MSG_1");
      assert.strictEqual(result, "Message remplacé");
    });

    it("Should return built-in locale message first", function() {
      let data = initLocaleData();
      let result = data.localizeMessage("msg_builtin");
      assert.strictEqual(result, "Built-in message");
    });

    it("Should return default locale message as fallback", function() {
      let data = initLocaleData();
      let result = data.localizeMessage("msg_3");
      assert.strictEqual(result, "Message fallback");
    });

    it("Should use options.locale in key search", function() {
      let data = initLocaleData();
      let result = data.localizeMessage("msg_1", [], {locale: "en"});
      assert.strictEqual(result, "Replaced message");
    });

    it("Should return empty string if key not found", function() {
      let data = initLocaleData();
      let result = data.localizeMessage("randomKey");
      assert.strictEqual(result, "");
      resetConsoleErrors();
    });

    it("Should return options.defaultValue if key not found", function() {
      let data = initLocaleData();
      let result = data.localizeMessage("randomKey", [], {defaultValue: "message"});
      assert.strictEqual(result, "message");
      resetConsoleErrors();
    });
  });

  describe("localize(str, locale)", function() {
    function initLocaleData() {
      let data = new LocaleData();
      data.addLocale("fr", {
        "msg_1": {message: "Message remplacé"},
      });
      data.addLocale("en", {
        "msg_1": {message: "Replaced message"},
      });
      data.selectedLocale = "fr";
      data.defaultLocale = "en";
      return data;
    }

    it("Simple message replacement", function() {
      let data = initLocaleData();
      let result = data.localize("__MSG_msg_1__");
      assert.strictEqual(result, "Message remplacé");
    });

    it("Should use specified locale in key search", function() {
      let data = initLocaleData();
      let result = data.localize("__MSG_msg_1__", "en");
      assert.strictEqual(result, "Replaced message");
    });
  });

  describe("addLocale(locale, messages)", function() {
    it("JSON with only message entries", function() {
      let json = {
          "msg_1": {
            "message": "My message 1",
          },
          "msg_2": {
            "message": "My message 2",
          },
      };

      let data = new LocaleData();
      data.addLocale("en", json);
      assert.isTrue(data.messages.has("en"));
      let locale = data.messages.get("en");
      assert.strictEqual(locale.size, 2);
      assert.strictEqual(locale.get("msg_1"), "My message 1");
      assert.strictEqual(locale.get("msg_2"), "My message 2");
    });

    it("JSON with description entries", function() {
      let json = {
          "msg_1": {
            "message": "My message",
            "description": "A message.",
          },
      };

      let data = new LocaleData();
      data.addLocale("en", json);
      assert.isTrue(data.messages.has("en"));
      let locale = data.messages.get("en");
      assert.strictEqual(locale.size, 1);
      assert.strictEqual(locale.get("msg_1"), "My message");
    });

    it("JSON with placeholders", function() {
      let json = {
          "msg_ph": {
            "message": "Place holder: $HOLDER$",
            "placeholders": {
              "holder": {
                "content": "$1",
              },
            },
          },
          "msg_direct_ph": {
            "message": "Direct place holder: $1",
          },
      };

      let data = new LocaleData();
      data.addLocale("en", json);
      assert.isTrue(data.messages.has("en"));
      let locale = data.messages.get("en");
      assert.strictEqual(locale.size, 2);
      assert.strictEqual(locale.get("msg_ph"), "Place holder: $1");
      assert.strictEqual(locale.get("msg_direct_ph"), "Direct place holder: $1");
    });
  });

  describe("messages.get(key)", function() {
    it("should ignore the case", function() {
      let json = {
          "msg_1": {
            "message": "My message 1",
          },
          "MSG_2": {
            "message": "My message 2",
          },
      };

      let data = new LocaleData();
      data.addLocale("en", json);
      assert.isTrue(data.messages.has("en"));
      let locale = data.messages.get("en");
      assert.strictEqual(locale.size, 2);
      assert.strictEqual(locale.get("MsG_1"), "My message 1");
      assert.strictEqual(locale.get("mSg_2"), "My message 2");
    });
  });
});
