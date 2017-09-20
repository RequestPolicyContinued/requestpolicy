browser = require "sinon-chrome/webextensions"

EventsCache = require "sinon-chrome/api/events"
eventsCache = new EventsCache()
browser.management.onEnabled = eventsCache.createEvent()
browser.management.onDisabled = eventsCache.createEvent()

module.exports = browser
