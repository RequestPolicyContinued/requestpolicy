/* exported run_test */

const {JsonPrefs} = require("bootstrap/models/api/storage/json-prefs");

function run_test() {
  run_next_test();
}

add_test(function() {
  // exercise
  const allJsonPrefs = JsonPrefs.getAll();

  // verify
  Assert.deepEqual(allJsonPrefs, {});

  run_next_test();
});

add_test(function() {
  // setup
  createRPFile("policies/foo/foo1.json", `{"foo": 1}`);
  createRPFile("policies/foo/foo2.json", `{"foo": 2}`);
  createRPFile("policies/bar/barA.json", `{"bar": "A"}`);
  createRPFile("policies/bar/barB.json", `{"bar": "B"}`);

  // exercise
  const allJsonPrefs = JsonPrefs.getAll();

  // verify
  Assert.deepEqual(allJsonPrefs, {
    "policies/foo/foo1": {foo: 1},
    "policies/foo/foo2": {foo: 2},
    "policies/bar/barA": {bar: "A"},
    "policies/bar/barB": {bar: "B"},
  });

  // cleanup
  removeAllRPFiles();

  run_next_test();
});
