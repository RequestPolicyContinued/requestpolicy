import * as Api from "sinon-chrome/api";
const stableApiFx = require("sinon-chrome/config/stable-api-ff.json");

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

export function createBrowserApi() {
  return new Api(stableApiFx).create();
}
