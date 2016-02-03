/* exported run_test */

Cu.import("chrome://rpcontinued/content/lib/classes/map-of-sets.jsm");


function run_test() {
  "use strict";

  test_0();
}


function test_0() {
  "use strict";

  let map = new MapOfSets();
  strictEqual(false, map.has("a"));

  let first = {};
  let second = {};

  // Adding a first element to the "a" set.
  map.addToSet("a", first);
  strictEqual(true, map.has("a"));
  strictEqual(1, map.get("a").size);

  // Adding a second element to the same set.
  map.addToSet("a", second);
  strictEqual(true, map.has("a"));
  strictEqual(2, map.get("a").size);

  // Removing a nonexistant element.
  map.deleteFromSet("a", {});
  strictEqual(2, map.get("a").size);

  // Removing a nonexistant element from nonexistant map "b".
  map.deleteFromSet("b", {});
  strictEqual(false, map.has("b"));

  // Removing the first element again.
  map.deleteFromSet("a", first);
  strictEqual(true, map.has("a"));
  strictEqual(1, map.get("a").size);

  // Add "second" to "b"
  map.addToSet("b", second);
  strictEqual(true, map.has("b"));
  strictEqual(1, map.get("b").size);

  // Remove all remaining elements
  map.deleteFromSet("a", second);
  map.deleteFromSet("b", second);
  strictEqual(false, map.has("a"));
  strictEqual(false, map.has("b"));
}
