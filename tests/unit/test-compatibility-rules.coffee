{assert} = require "chai"
{strictEqual} = assert

browser = require "./lib/sinon-chrome"

{CompatibilityRules} = require "lib/classes/compatibility-rules"

describe "CompatibilityRules", ->
  before () ->
    global.browser = browser
    browser.runtime.getBrowserInfo.resolves {
      name: "Firefox"
    }

  describe "whenReady() returns a Promise which resolves", ->
    it "specs: none; installed add-ons: none", ->
      browser.management.getAll.resolves []
      cr = new CompatibilityRules({}, [])
      cr.whenReady

  after () ->
    browser.flush()
    delete global.browser
