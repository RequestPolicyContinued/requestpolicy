const stableApiFx = require("sinon-chrome/config/stable-api-ff.json");
const Api = require("sinon-chrome/api");

for (let ns of stableApiFx) {
  if (ns.namespace === "management") {
    if (!("events" in ns)) ns.events = [];
    ns.events.push({
      "name": "onEnabled",
      "type": "function",
      "parameters": [
        {
          "name": "info",
          "$ref": "management.ExtensionInfo",
          "description": "info about the add-on that was enabled.",
        },
      ],
    });
    ns.events.push({
      "name": "onDisabled",
      "type": "function",
      "parameters": [
        {
          "name": "info",
          "$ref": "management.ExtensionInfo",
          "description": "info about the add-on that was disabled.",
        },
      ],
    });
  }
}

const browser = new Api(stableApiFx).create();

module.exports = browser;
