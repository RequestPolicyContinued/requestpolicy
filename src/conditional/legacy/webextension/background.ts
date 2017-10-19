import {Controllers} from "webextension/lib/classes/controllers";

import {
  WebextSideSettingsMigrationController,
} from "webextension/controllers/webext-side-settings-migration-controller";

const controllers = new Controllers([
  WebextSideSettingsMigrationController,
]);

console.log("Embedded WebExtension is being loaded.");
controllers.startup();

window.addEventListener("unload", () => {
  // Only synchronous tasks can be done here.
  console.log("Embedded WebExtension is being unloaded.");
  controllers.shutdown();
});
