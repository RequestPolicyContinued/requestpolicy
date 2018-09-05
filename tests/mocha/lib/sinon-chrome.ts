// @ts-ignore
import * as Api from "sinon-chrome/api";
import * as SinonChrome from "sinon-chrome";
import * as ApiEvent from "sinon-chrome/events";
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

export function createBrowserApi(): typeof SinonChrome {
  return new Api(stableApiFx).create();
}

export function createPort(sinon) {
  const port = {
    onMessage: new ApiEvent(),
    postMessage: sinon.stub(),
  };
  sinon.spy(port.onMessage, "addListener");
  sinon.spy(port.onMessage, "removeListener");
  sinon.spy(port.onMessage, "hasListener");
  return port;
}
