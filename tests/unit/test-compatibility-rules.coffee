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

  describe "forEach()", () ->
    genTest = (aAppSpec, aExtSpec, aAddons, aNExpectedRules) ->
      () ->
        browser.management.getAll.resolves(aAddons)
        cr = new CompatibilityRules(aAppSpec, aExtSpec)

        cr.whenReady.then(() ->
          addedRules = []
          cr.forEach((rule) ->
            addedRules.push(rule)
          )
          assert.lengthOf(addedRules, aNExpectedRules)
        )

    it "specs: none; installed add-ons: none", genTest(
      {}, [], [], 0
    )

    it "specs: app:'all'; installed add-ons: none", genTest(
      {
        all: [["foo:", "bar:"]]
      }, [], [], 1
    )

    it "specs: app:'Firefox'; installed add-ons: none", genTest(
      {
        Firefox: [["bar:", "baz:"]]
      }, [], [], 1
    )

    it "specs: apps:'all','Firefox'; installed add-ons: none", genTest(
      {
        Firefox: [["bar:", "baz:"]]
        all: [["foo:", "bar:"]]
      }, [], [], 2
    )

    it "specs: add-on:'example'; installed add-ons: none", genTest(
      {}, [
        {
          ids: ["addon@example.com"]
          rules: [
            ["baz:", "foo:"]
          ]
        }
      ], [], 0
    )

    it "specs: add-on:'example'; installed add-ons: 'example' (not enabled)", genTest(
      {}, [
        {
          ids: ["addon@example.com"]
          rules: [
            ["baz:", "foo:"]
          ]
        }
      ],
      [
        {
          id: "addon@example.com"
          enabled: false
        }
      ],
      0
    )

    it "specs: add-on:'example'; installed add-ons: 'example'", genTest(
      {}, [
        {
          ids: ["addon@example.com"]
          rules: [
            ["baz:", "foo:"]
          ]
        }
      ],
      [
        {
          id: "addon@example.com"
          enabled: true
        }
      ],
      1
    )

    it "specs: apps:'all','Firefox', add-on:'example'; installed add-ons: 'example'", genTest(
      {
        Firefox: [["bar:", "baz:"]]
        all: [["foo:", "bar:"]]
      },
      [
        {
          ids: ["addon@example.com"]
          rules: [
            ["baz:", "foo:"]
          ]
        }
      ],
      [
        {
          id: "addon@example.com"
          enabled: true
        }
      ], 3
    )

  after () ->
    browser.flush()
    delete global.browser
