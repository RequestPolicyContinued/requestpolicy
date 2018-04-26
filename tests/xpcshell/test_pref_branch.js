/* exported run_test */

const {XPConnectService} = require("bootstrap/api/services/xpconnect-service");
const xpconnectService = new XPConnectService();

const {JSMService} = require("bootstrap/api/services/jsm-service");
const jsmService = new JSMService(Cu);
const mozServices = jsmService.getServices();

const {PrefBranch} = require("bootstrap/api/storage/pref-branch");
const rpPrefBranch = new PrefBranch(
    Ci,
    mozServices.prefs,
    xpconnectService,
    "extensions.requestpolicy."
);

// @ts-ignore
function run_test() {
  run_next_test();
}

add_test(function() {
  // exercise
  const result = rpPrefBranch.get("nonexistant");

  // verify
  Assert.strictEqual(result, undefined);

  run_next_test();
});

add_test(function() {
  // exercise
  rpPrefBranch.reset("nonexistant");  // should not throw

  run_next_test();
});

[true, 42, "something"].forEach((testValue) => {
  add_test(function() {
    // setup
    rpPrefBranch.set("someRandomPrefName", testValue);

    // exercise
    const result = rpPrefBranch.get("someRandomPrefName");

    // verify
    Assert.strictEqual(result, testValue);

    // cleanup
    rpPrefBranch.get("someRandomPrefName");

    run_next_test();
  });
});

add_test(function() {
  // setup
  rpPrefBranch.set("someRandomPrefName", "foo");
  let observedPrefName;
  const observer = {
    observe(subject, topic, data) {
      observedPrefName = data;
    },
  };
  rpPrefBranch.addObserver("", observer);

  // exercise
  rpPrefBranch.set("someRandomPrefName", "bar");

  // verify
  Assert.strictEqual(observedPrefName, "someRandomPrefName");

  // cleanup
  rpPrefBranch.removeObserver("", observer);
  rpPrefBranch.reset("someRandomPrefName");

  run_next_test();
});
